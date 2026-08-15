/* ─────────────────────────────────────────────────────────────────────
 * Engine Types — Inference Pipeline & Terrain Data Contracts
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

// ─── Inference Configuration ─────────────────────────────────────────

export interface InferenceConfig {
  modelId: string;          // e.g. 'SmolLM2-135M-Instruct-q4f16_1-MLC'
  device: 'webgpu' | 'wasm';
  maxTokens: number;
  vocabSize: number;
}

// ─── Logit Snapshot (per generation step) ────────────────────────────

export interface LogitSnapshot {
  stepIndex: number;
  rawLogits: Float32Array;    // Full vocab-size logit array
  tokenId: number;            // Selected token ID
  tokenStr: string;           // Decoded token string
  prompt: string;             // Prompt at this step
  isThinking: boolean;        // True if inside <think> block
  timestamp: number;
  topCandidates: DecodedTokenCandidate[];
}

export interface DecodedTokenCandidate {
  tokenId: number;
  tokenStr: string;
  rawLogit: number;
}

// ─── Inference State Machine ─────────────────────────────────────────

export type InferenceStatus =
  | 'idle'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export interface InferenceState {
  status: InferenceStatus;
  progress: number;           // 0-100 for download/init
  progressText: string;       // Human-readable status
  vramUsageMB: number | null;
  modelId: string | null;
  vocabSize: number | null;
  error: string | null;
}

// ─── Worker Messages (Main Thread ↔ Worker) ──────────────────────────

export type WorkerInbound =
  | { type: 'LOAD_MODEL'; modelId: string }
  | { type: 'GENERATE_STEP'; prompt: string; maxTokens: number; maxThinkingTokens?: number }
  | { type: 'GET_FULL_LOGITS'; prompt: string }
  | { type: 'RESET_CHAT' }
  | { type: 'ABORT' }
  | { type: 'UNLOAD' };

export type WorkerOutbound =
  | { type: 'STATUS'; status: InferenceStatus; progress: number; text: string }
  | { type: 'MODEL_LOADED'; modelId: string; vocabSize: number }
  | { type: 'VOCAB_LOADED'; modelId: string; vocabList: string[] }
  | { type: 'LOGITS_READY'; snapshot: LogitSnapshotTransfer }
  | { type: 'TOKEN_GENERATED'; tokenId: number; tokenStr: string; stepIndex: number }
  | { type: 'LOOP_ABORTED'; message: string; repeatedPhrase: string }
  | { type: 'GENERATION_COMPLETE'; totalSteps: number }
  | { type: 'ERROR'; message: string };

// Transferable version of LogitSnapshot (ArrayBuffer instead of Float32Array)
export interface LogitSnapshotTransfer {
  stepIndex: number;
  rawLogitsBuffer: ArrayBuffer; // Transferred ownership
  tokenId: number;
  tokenStr: string;
  prompt: string;
  isThinking: boolean;
  timestamp: number;
  topCandidates: DecodedTokenCandidate[];
}

// ─── Available Models ────────────────────────────────────────────────

export interface ModelOption {
  id: string;
  label: string;
  size: string;           // Human-readable, e.g. "~180MB"
  vocabSize: number;
  description: string;
  tier: 'light' | 'standard' | 'power';
  isReasoning?: boolean;  // True if it's a reasoning model (supports <think>)
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    label: 'SmolLM2 135M (q4f16)',
    size: '~180MB',
    vocabSize: 49152,
    description: 'Ultra-light local model for compatible WebGPU devices.',
    tier: 'light',
  },
  {
    id: 'SmolLM2-135M-Instruct-q0f16-MLC',
    label: 'SmolLM2 135M (q0f16)',
    size: '~360MB',
    vocabSize: 49152,
    description: 'Ultra-light unquantized float16 variant from WebLLM catalog.',
    tier: 'light',
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 0.5B',
    size: '~500MB',
    vocabSize: 151936,
    description: 'Deeper reasoning, larger vocabulary. Requires ~1GB VRAM.',
    tier: 'standard',
  },
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    label: 'Qwen2.5 1.5B',
    size: '~1.2GB',
    vocabSize: 151936,
    description: 'High-quality inference. Requires ~2GB VRAM.',
    tier: 'power',
  },
];

// ─── Terrain Coordinates ─────────────────────────────────────────────

export interface TerrainCoordinateSet {
  modelId: string;
  vocabSize: number;
  coordinates: Float32Array; // Interleaved [x0, y0, x1, y1, ...] length = vocabSize * 2
  version: number;
}

// ─── Sampling Parameters (re-exported from existing types for engine use) ──

export interface EngineSamplingParams {
  temperature: number;
  topK: number;
  topP: number;
  minP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  logitBiases: Record<number, number>; // tokenId → bias
}
