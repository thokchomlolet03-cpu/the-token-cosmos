/* ─────────────────────────────────────────────────────────────────────
 * useInferenceEngine — React Hook
 * Manages the WebGPU inference worker lifecycle, model loading,
 * logit extraction, and fallback to hardcoded sample data.
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  InferenceState,
  WorkerInbound,
  WorkerOutbound,
  LogitSnapshot,
  ModelOption,
  DecodedTokenCandidate,
} from './types';
import { AVAILABLE_MODELS } from './types';
import type { RawTokenCandidate } from '../types/sampling';

// ─── WebGPU Support Detection ───────────────────────────────────────

function detectWebGPU(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator;
}

// ─── Hook Return Type ───────────────────────────────────────────────

export interface InferenceEngine {
  // State
  state: InferenceState;
  isWebGPUAvailable: boolean;
  isModelLoaded: boolean;
  availableModels: ModelOption[];

  // Actions
  loadModel: (modelId: string) => void;
  getLogits: (prompt: string) => void;
  generateSteps: (prompt: string, maxTokens: number, maxThinkingTokens?: number) => void;
  resetChat: () => void;
  abort: () => void;
  unload: () => void;

  // Data
  latestLogits: Float32Array | null;
  latestSnapshot: LogitSnapshot | null;
  latestCandidates: DecodedTokenCandidate[];
  generatedTokens: Array<{ tokenStr: string; stepIndex: number }>;
  isLoopAborted: boolean;
  loopAbortedMessage: string | null;

  // Conversion: raw Float32Array logits → RawTokenCandidate[] for existing math pipeline
  logitsToRawCandidates: (logits: Float32Array, ragTokens?: Set<string>) => RawTokenCandidate[];
}

// ─── The Hook ───────────────────────────────────────────────────────

export function useInferenceEngine(): InferenceEngine {
  const workerRef = useRef<Worker | null>(null);
  const webGPUAvailable = useRef(detectWebGPU());

  const [state, setState] = useState<InferenceState>({
    status: 'idle',
    progress: 0,
    progressText: 'No model loaded',
    vramUsageMB: null,
    modelId: null,
    vocabSize: null,
    error: null,
  });

  const [latestLogits, setLatestLogits] = useState<Float32Array | null>(null);
  const [latestSnapshot, setLatestSnapshot] = useState<LogitSnapshot | null>(null);
  const [latestCandidates, setLatestCandidates] = useState<DecodedTokenCandidate[]>([]);
  const [generatedTokens, setGeneratedTokens] = useState<Array<{ tokenStr: string; stepIndex: number }>>([]);
  const [isLoopAborted, setIsLoopAborted] = useState<boolean>(false);
  const [loopAbortedMessage, setLoopAbortedMessage] = useState<string | null>(null);

  // Tokenizer vocabulary cache (token_id → string mapping)
  // Built lazily when we get the first logit snapshot
  const vocabMapRef = useRef<string[] | null>(null);

  // ─── Worker Initialization ──────────────────────────────────────

  useEffect(() => {
    if (!webGPUAvailable.current) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        progressText: 'WebGPU not available — using sample data',
      }));
      return;
    }

    // Create worker using Vite's worker import syntax
    const worker = new Worker(
      new URL('./WebGPUInferenceWorker.ts', import.meta.url),
      { type: 'module' }
    );

    worker.onmessage = (event: MessageEvent<WorkerOutbound>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'STATUS':
          setState(prev => ({
            ...prev,
            status: msg.status,
            progress: msg.progress,
            progressText: msg.text,
            error: msg.status === 'error' ? msg.text : prev.error,
          }));
          break;

        case 'MODEL_LOADED':
          setState(prev => ({
            ...prev,
            status: 'ready',
            modelId: msg.modelId,
            vocabSize: msg.vocabSize,
            error: null,
          }));
          break;

        case 'VOCAB_LOADED':
          vocabMapRef.current = msg.vocabList;
          break;

        case 'LOGITS_READY': {
          const logits = new Float32Array(msg.snapshot.rawLogitsBuffer);
          setLatestLogits(logits);
          setLatestSnapshot({
            stepIndex: msg.snapshot.stepIndex,
            rawLogits: logits,
            tokenId: msg.snapshot.tokenId,
            tokenStr: msg.snapshot.tokenStr,
            prompt: msg.snapshot.prompt,
            isThinking: msg.snapshot.isThinking,
            timestamp: msg.snapshot.timestamp,
            topCandidates: msg.snapshot.topCandidates,
          });
          setLatestCandidates(msg.snapshot.topCandidates);
          break;
        }

        case 'TOKEN_GENERATED':
          setGeneratedTokens(prev => [
            ...prev,
            { tokenStr: msg.tokenStr, stepIndex: msg.stepIndex },
          ]);
          break;

        case 'LOOP_ABORTED':
          setIsLoopAborted(true);
          setLoopAbortedMessage(msg.message);
          break;

        case 'GENERATION_COMPLETE':
          // State already updated by STATUS message
          break;

        case 'ERROR':
          setState(prev => ({
            ...prev,
            status: 'error',
            error: msg.message,
            progressText: msg.message,
          }));
          break;
      }
    };

    worker.onerror = (err) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: `Worker error: ${err.message}`,
        progressText: `Worker error: ${err.message}`,
      }));
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ─── Worker Message Sender ──────────────────────────────────────

  const send = useCallback((msg: WorkerInbound) => {
    workerRef.current?.postMessage(msg);
  }, []);

  // ─── Public API ─────────────────────────────────────────────────

  const loadModel = useCallback((modelId: string) => {
    setLatestLogits(null);
    setLatestSnapshot(null);
    setLatestCandidates([]);
    setGeneratedTokens([]);
    setIsLoopAborted(false);
    setLoopAbortedMessage(null);
    vocabMapRef.current = null;
    send({ type: 'LOAD_MODEL', modelId });
  }, [send]);

  const getLogits = useCallback((prompt: string) => {
    setGeneratedTokens([]);
    setIsLoopAborted(false);
    setLoopAbortedMessage(null);
    send({ type: 'GET_FULL_LOGITS', prompt });
  }, [send]);

  const generateSteps = useCallback((prompt: string, maxTokens: number, maxThinkingTokens?: number) => {
    setGeneratedTokens([]);
    setIsLoopAborted(false);
    setLoopAbortedMessage(null);
    send({ type: 'GENERATE_STEP', prompt, maxTokens, maxThinkingTokens });
  }, [send]);

  const resetChat = useCallback(() => {
    setIsLoopAborted(false);
    setLoopAbortedMessage(null);
    send({ type: 'RESET_CHAT' });
  }, [send]);

  const abort = useCallback(() => {
    send({ type: 'ABORT' });
  }, [send]);

  const unload = useCallback(() => {
    setLatestLogits(null);
    setLatestSnapshot(null);
    setLatestCandidates([]);
    setGeneratedTokens([]);
    setIsLoopAborted(false);
    setLoopAbortedMessage(null);
    vocabMapRef.current = null;
    send({ type: 'UNLOAD' });
  }, [send]);

  // ─── Logits → RawTokenCandidate[] Converter ────────────────────
  // Bridges the WebGPU full-vocab logits into the existing
  // samplingMath.ts pipeline format.

  const logitsToRawCandidates = useCallback(
    (logits: Float32Array, ragTokens?: Set<string>): RawTokenCandidate[] => {
      const candidates: RawTokenCandidate[] = [];

      // Full vocab logits are retained for terrain rendering. The decoded top
      // candidates provided by WebLLM are used for readable labels in the UI.
      for (let i = 0; i < logits.length; i++) {
        const logit = logits[i];

        // Skip -Infinity logits (padding tokens, etc.)
        if (!isFinite(logit) || logit < -1e6) continue;

        // Use vocab map if available, otherwise fall back to index
        const tokenStr = vocabMapRef.current?.[i] ?? `Token #${i}`;

        candidates.push({
          token_id: i,
          token_str: tokenStr,
          raw_logit: logit,
          is_rag_grounded: ragTokens?.has(tokenStr.toLowerCase()) ?? false,
        });
      }

      // Sort by raw_logit descending and take top 200 for visualization
      candidates.sort((a, b) => b.raw_logit - a.raw_logit);
      return candidates.slice(0, 200);
    },
    []
  );

  return {
    state,
    isWebGPUAvailable: webGPUAvailable.current,
    isModelLoaded: state.status === 'ready' && state.modelId !== null,
    availableModels: AVAILABLE_MODELS,

    loadModel,
    getLogits,
    generateSteps,
    resetChat,
    abort,
    unload,

    latestLogits,
    latestSnapshot,
    latestCandidates,
    generatedTokens,
    isLoopAborted,
    loopAbortedMessage,

    logitsToRawCandidates,
  };
}
