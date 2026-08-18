/* ─────────────────────────────────────────────────────────────────────
 * WebGPU Inference Worker
 * Runs @mlc-ai/web-llm in a dedicated Web Worker thread.
 * Intercepts raw logits via LogitProcessor before sampling.
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

import {
  MLCEngine,
  prebuiltAppConfig,
  type AppConfig,
  type InitProgressReport,
  type LogitProcessor,
  type ChatCompletionMessageParam,
} from '@mlc-ai/web-llm';

import type {
  WorkerInbound,
  WorkerOutbound,
  LogitSnapshotTransfer,
} from './types';

export const CHATML_STOP_SEQUENCES = [
  '<|im_end|>',
  '<|endoftext|>',
  '<|im_start|>',
  '\n<|im_start|>',
  '\n<|im_end|>',
];

export interface SamplingConfig {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  logit_bias?: Record<string, number>;
}

// ─── Custom Model Registration ──────────────────────────────────────

const EXTRA_MODELS: AppConfig['model_list'] = [
  {
    model: "https://huggingface.co/mlc-ai/SmolLM2-135M-Instruct-q4f16_1-MLC/",
    model_id: "SmolLM2-135M-Instruct-q4f16_1-MLC",
    model_lib: "https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/SmolLM2-135M-Instruct-q4f16_1_cs1k-webgpu.wasm",
    vram_required_MB: 180,
    low_resource_required: true,
    required_features: ["shader-f16"],
    overrides: { context_window_size: 4096 },
  },
];

const CUSTOM_APP_CONFIG: AppConfig = {
  model_list: [
    ...prebuiltAppConfig.model_list,
    ...EXTRA_MODELS.filter(
      (customModel) => !prebuiltAppConfig.model_list.some((model) => model.model_id === customModel.model_id),
    ),
  ],
};

// ─── State ───────────────────────────────────────────────────────────

let engine: MLCEngine | null = null;
let currentModelId: string | null = null;
let activeAbortController: AbortController | null = null;

// Logit capture buffer — filled by LogitProcessor, read after each step
let capturedLogits: Float32Array | null = null;
let capturedStepIndex = 0;

// Triple Buffer memory pool for zero-allocation transferable array buffers
const bufferPool: ArrayBuffer[] = [];

function acquireBuffer(byteLength: number): ArrayBuffer {
  if (bufferPool.length > 0) {
    const buf = bufferPool.pop()!;
    if (buf.byteLength === byteLength) {
      return buf;
    }
  }
  return new ArrayBuffer(byteLength);
}

// ─── Logit Interceptor ──────────────────────────────────────────────

class CosmosLogitProcessor implements LogitProcessor {
  /**
   * Called by WebLLM with the raw logits tensor BEFORE sampling.
   * We clone the full array for visualization, then return it unmodified
   * so the engine samples normally.
   */
  processLogits(logits: Float32Array): Float32Array {
    // Clone — the engine may reuse the buffer
    capturedLogits = new Float32Array(logits);
    return logits;
  }

  /**
   * Called after a token is sampled. Required by LogitProcessor interface.
   */
  processSampledToken(_token: number): void {
    // No-op — we only need logits, not the sampling result
  }

  resetState(): void {
    capturedLogits = null;
    capturedStepIndex = 0;
  }
}

// ─── Post Message Helper ────────────────────────────────────────────

function post(msg: WorkerOutbound, transfer?: Transferable[]) {
  if (transfer) {
    (self as unknown as Worker).postMessage(msg, transfer);
  } else {
    self.postMessage(msg);
  }
}

function decodeTopCandidates(
  topLogprobs: Array<{ token: string; logprob: number }> | null | undefined,
): Array<{ tokenId: number; tokenStr: string; rawLogit: number }> {
  return (topLogprobs ?? []).map((candidate, index) => ({
    // WebLLM exposes text and logprob here but not the internal token ID.
    // Negative IDs keep these presentation candidates out of terrain lookups.
    tokenId: -1 - index,
    tokenStr: candidate.token,
    rawLogit: candidate.logprob,
  }));
}

/**
 * Proactively initializes WebGPU context and registers the device.lost event listener.
 * Broadcasts ENGINE_ERROR and error status to the main thread upon VRAM exhaustion / context loss.
 */
export async function initializeWebGPUContext(): Promise<any> {
  if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
    throw new Error('WebGPU is not supported on this browser.');
  }

  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No appropriate GPU adapter found.');
  }

  const device = await adapter.requestDevice();

  // 1. Trap the inevitable device loss event
  device.lost.then((info: any) => {
    const reasonStr = info?.reason ?? 'unknown';
    const messageStr = info?.message ?? 'GPU device context dropped.';
    console.error(`[WebGPUWorker] Device Lost: ${messageStr} (Reason: ${reasonStr})`);
    
    // 2. Broadcast the fatal error to the React main thread
    post({
      type: 'ENGINE_ERROR',
      payload: {
        code: 'WEBGPU_DEVICE_LOST',
        message: `GPU context was lost (${reasonStr}): ${messageStr}. Please reload the application.`,
      },
    });

    post({
      type: 'STATUS',
      status: 'error',
      progress: 0,
      text: `WebGPU Device Lost (${reasonStr}): ${messageStr}`,
    });
  });

  return device;
}

// ─── Model Loading ──────────────────────────────────────────────────

async function loadModel(modelId: string) {
  try {
    post({ type: 'STATUS', status: 'downloading', progress: 0, text: `Downloading ${modelId}...` });

    // Initialize WebGPU context and register device.lost listeners
    try {
      await initializeWebGPUContext();
    } catch (gpuErr) {
      console.warn('[WebGPUWorker] initializeWebGPUContext notice:', gpuErr);
    }

    // Always unload any previous engine instance cleanly
    if (engine) {
      try {
        await engine.unload();
      } catch (_ignored) {}
      engine = null;
      currentModelId = null;
    }

    const logitProcessor = new CosmosLogitProcessor();

    engine = new MLCEngine({
      appConfig: CUSTOM_APP_CONFIG,
      initProgressCallback: (report: InitProgressReport) => {
        const progress = Math.round(report.progress * 100);
        const status = progress < 100 ? 'downloading' : 'loading';
        post({
          type: 'STATUS',
          status,
          progress,
          text: report.text || `Loading ${modelId}... ${progress}%`,
        });
      },
      logitProcessorRegistry: new Map([
        [modelId, logitProcessor],
      ]),
    });

    await engine.reload(modelId);
    currentModelId = modelId;

    // Extract vocabulary list from the tokenizer
    let vocabList: string[] = [];
    try {
      const pipeline = (engine as any).loadedModelIdToPipeline.get(modelId);
      if (pipeline && pipeline.tokenizer) {
        const tokenizer = pipeline.tokenizer;
        const size = tokenizer.getVocabSize();
        vocabList = new Array(size);
        for (let i = 0; i < size; i++) {
          let token = '';
          try {
            token = tokenizer.decode(new Int32Array([i]));
          } catch (_e) {
            token = tokenizer.idToToken(i) || '';
          }
          // Clean up standard space tokens
          token = token.replace(/Ġ/g, ' ').replace(/ /g, ' ');
          vocabList[i] = token || `Token #${i}`;
        }
      }
    } catch (e) {
      console.warn("Failed to extract vocab list from tokenizer:", e);
    }

    if (vocabList.length > 0) {
      post({
        type: 'VOCAB_LOADED',
        modelId,
        vocabList,
      });
    }

    // Probe vocab size by generating a single dummy token
    // The logit processor will capture the full array
    logitProcessor.resetState();

    await engine.chat.completions.create({
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1,
      temperature: 1.0,
    });

    const vocabSize = capturedLogits?.length ?? 0;
    logitProcessor.resetState();

    post({
      type: 'MODEL_LOADED',
      modelId,
      vocabSize,
    });

    post({
      type: 'STATUS',
      status: 'ready',
      progress: 100,
      text: `${modelId} ready (vocab: ${vocabSize.toLocaleString()})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', message: `Model load failed: ${message}` });
    post({ type: 'STATUS', status: 'error', progress: 0, text: message });
  }
}

/**
 * Executes chat completion with explicit stop sequence trapping and signal cancellation.
 */
export async function executeInferenceStep(
  engineInstance: MLCEngine,
  messages: ChatCompletionMessageParam[],
  params: SamplingConfig,
  onTokenChunk?: (chunk: string) => void
) {
  // 1. Abort any active in-flight generation task
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  // 2. Instantiate a fresh controller for the current session
  activeAbortController = new AbortController();
  const currentSignal = activeAbortController.signal;

  try {
    const response = await engineInstance.chat.completions.create({
      messages,
      temperature: params.temperature ?? 0.7,
      top_p: params.top_p ?? 0.95,
      max_tokens: params.max_tokens ?? 256,
      frequency_penalty: params.frequency_penalty ?? 0.0,
      presence_penalty: params.presence_penalty ?? 0.0,
      logit_bias: params.logit_bias ?? {},
      // Explicit ChatML delimiters to prevent runaway repetition loops
      stop: [
        "<|im_end|>",
        "<|endoftext|>",
        "<|im_start|>",
        "\n<|im_start|>",
        "\n<|im_end|>"
      ],
      stream: true,
    });

    let fullGeneratedText = "";

    for await (const chunk of response) {
      if (currentSignal.aborted) {
        break;
      }
      const token = chunk.choices[0]?.delta?.content || "";
      if (token) {
        fullGeneratedText += token;
        if (onTokenChunk) {
          onTokenChunk(token);
        }
      }
    }

    return fullGeneratedText;
  } catch (error: any) {
    // Gracefully catch abort signals without emitting worker-level errors
    if (error?.name === "AbortError" || currentSignal.aborted) {
      console.info("[WebGPUWorker] In-flight inference cleanly cancelled.");
      return null;
    }
    console.error("[WebGPUWorker] Inference execution error:", error);
    throw error;
  } finally {
    // Release controller reference if this was the active task
    if (activeAbortController?.signal === currentSignal) {
      activeAbortController = null;
    }
  }
}

// ─── Full Logit Extraction (single forward pass) ────────────────────

async function getFullLogits(messages: Array<{ role: string; content: string }>, systemPrompt?: string) {
  if (!engine || !currentModelId) {
    post({ type: 'ERROR', message: 'No model loaded' });
    return;
  }

  // Abort any active in-flight task
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }
  activeAbortController = new AbortController();
  const currentSignal = activeAbortController.signal;

  try {
    post({ type: 'STATUS', status: 'generating', progress: 0, text: 'Computing logits...' });

    capturedStepIndex = 0;
    capturedLogits = null;

    // Instruct model framing: ensure direct completion without conversational filler
    const currentMessages: Array<{ role: string; content: string }> = [];
    const sysPrompt = (systemPrompt && systemPrompt.trim().length > 0)
      ? systemPrompt.trim()
      : 'You are a precise AI assistant. Complete user requests directly and concisely.';
    currentMessages.push({ role: 'system', content: sysPrompt });
    currentMessages.push(...messages);

    // Single-token generation to capture the logit distribution for the NEXT token
    const response = await engine.chat.completions.create({
      messages: currentMessages as any,
      max_tokens: 1,
      temperature: 1.0, // Temperature doesn't affect raw logits, only sampling
      logprobs: true,
      top_logprobs: 5,
      stop: CHATML_STOP_SEQUENCES,
    });

    if (currentSignal.aborted) {
      console.info('[WebGPUWorker] In-flight inference cleanly cancelled.');
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Computation cancelled' });
      return;
    }

    if (!capturedLogits) {
      post({ type: 'ERROR', message: 'LogitProcessor did not fire — no logits captured' });
      return;
    }

    // Type assertion needed: TS can't track that the LogitProcessor callback
    // mutated capturedLogits during the async engine.chat.completions.create() call
    const captured = capturedLogits as unknown as Float32Array;
    const tokenStr = response.choices?.[0]?.message?.content ?? '';

    // Transfer the buffer to main thread (zero-copy with buffer recycling)
    const buffer = acquireBuffer(captured.byteLength);
    new Float32Array(buffer).set(captured);
    const snapshot: LogitSnapshotTransfer = {
      stepIndex: 0,
      rawLogitsBuffer: buffer,
      tokenId: -1, // We don't get token IDs from chat API directly
      tokenStr,
      prompt: messages.map(m => m.content).join('\n'), // Pass combined text for UI fallback logging if needed
      isThinking: false, // Initial token is never inside <think>
      timestamp: Date.now(),
      topCandidates: decodeTopCandidates(response.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs),
    };

    post(
      { type: 'LOGITS_READY', snapshot },
      [buffer]
    );

    post({
      type: 'STATUS',
      status: 'ready',
      progress: 100,
      text: `Logits ready (${captured.length.toLocaleString()} tokens)`,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || currentSignal.aborted) {
      console.info('[WebGPUWorker] In-flight inference cleanly cancelled.');
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Computation cancelled' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', message: `Logit extraction failed: ${message}` });
    post({ type: 'STATUS', status: 'error', progress: 0, text: message });
  } finally {
    if (activeAbortController?.signal === currentSignal) {
      activeAbortController = null;
    }
  }
}

// ─── Loop Cycle Detection ───────────────────────────────────────────

function checkRepetitionLoop(tokens: string[]): { detected: boolean; phrase: string } | null {
  if (tokens.length < 4) return null;

  for (const n of [1, 2, 3, 4, 5]) {
    if (tokens.length < n * 3) continue;
    const lastN = tokens.slice(-n).join('');
    const prevN = tokens.slice(-2 * n, -n).join('');
    const prevPrevN = tokens.slice(-3 * n, -2 * n).join('');

    if (lastN.length > 0 && lastN === prevN && prevN === prevPrevN) {
      return { detected: true, phrase: lastN.trim() };
    }
  }
  return null;
}

// ─── Multi-Step Generation ──────────────────────────────────────────

async function generateSteps(messages: Array<{ role: string; content: string }>, maxTokens: number, maxThinkingTokens?: number, systemPrompt?: string) {
  if (!engine || !currentModelId) {
    post({ type: 'ERROR', message: 'No model loaded' });
    return;
  }

  // 1. Abort any active in-flight generation task
  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  // 2. Instantiate a fresh controller for the current session
  activeAbortController = new AbortController();
  const currentSignal = activeAbortController.signal;

  try {
    post({ type: 'STATUS', status: 'generating', progress: 0, text: 'Generating...' });

    capturedStepIndex = 0;
    
    let isThinking = false;
    let accumulatedText = '';
    const generatedTokens: string[] = [];
    
    // Construct full message context (Context-Restoration Guarantee)
    const currentMessages: Array<{ role: string; content: string }> = [];
    const sysPrompt = (systemPrompt && systemPrompt.trim().length > 0)
      ? systemPrompt.trim()
      : 'You are a precise AI assistant. Complete user requests directly and concisely.';
    currentMessages.push({ role: 'system', content: sysPrompt });
    currentMessages.push(...messages);

    let hasTruncated = false;
    let totalSteps = 0;

    // Use streaming to capture logits at each step with explicit stop sequences and signal
    let stream = await engine.chat.completions.create({
      messages: currentMessages as any,
      max_tokens: maxTokens,
      temperature: 1.0,
      logprobs: true,
      top_logprobs: 5,
      stop: CHATML_STOP_SEQUENCES,
      stream: true,
    });

    while (true) {
      for await (const chunk of stream) {
        if (currentSignal.aborted) break;

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta && capturedLogits) {
          accumulatedText += delta;
          generatedTokens.push(delta);
          
          // In-Worker Loop Detection
          const loop = checkRepetitionLoop(generatedTokens);
          if (loop) {
            if (activeAbortController) {
              activeAbortController.abort();
            }
            if (engine) {
              await engine.interruptGenerate();
              await engine.resetChat();
            }
            post({
              type: 'LOOP_ABORTED',
              message: 'Autoregressive loop detected. Stream aborted safely.',
              repeatedPhrase: loop.phrase,
            });
            post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Loop detected & aborted safely' });
            return;
          }

          // Detect <think> tags
          if (accumulatedText.includes('<think>') && !accumulatedText.includes('</think>')) {
              isThinking = true;
          } else if (accumulatedText.includes('</think>')) {
              isThinking = false;
          }

          const captured = capturedLogits as unknown as Float32Array;
          // Transfer logits for this step (zero-copy with buffer recycling)
          const buffer = acquireBuffer(captured.byteLength);
          new Float32Array(buffer).set(captured);
          const snapshot: LogitSnapshotTransfer = {
            stepIndex: capturedStepIndex,
            rawLogitsBuffer: buffer,
            tokenId: -1,
            tokenStr: delta,
            prompt: messages.map(m => m.content).join('\n'), // Pass combined text for UI fallback logging if needed
            isThinking,
            timestamp: Date.now(),
            topCandidates: decodeTopCandidates(chunk.choices?.[0]?.logprobs?.content?.[0]?.top_logprobs),
          };

          post(
            { type: 'LOGITS_READY', snapshot },
            [buffer]
          );

          post({
            type: 'TOKEN_GENERATED',
            tokenId: -1,
            tokenStr: delta,
            stepIndex: capturedStepIndex,
          });

          capturedStepIndex++;
          totalSteps++;
          
          // Truncation check
          if (isThinking && maxThinkingTokens && capturedStepIndex >= maxThinkingTokens) {
              hasTruncated = true;
              break; // Break the stream iteration
          }
        }
      }
      
      if (currentSignal.aborted) break;
      
      if (hasTruncated) {
          hasTruncated = false;
          // Force exit by injecting </think>
          accumulatedText += '</think>\n';
          const continuationMessages: Array<{ role: string; content: string }> = [];
          if (systemPrompt && systemPrompt.trim().length > 0) {
            continuationMessages.push({ role: 'system', content: systemPrompt.trim() });
          }
          continuationMessages.push(...messages);
          continuationMessages.push({ role: 'assistant', content: accumulatedText });
          
          isThinking = false;
          stream = await engine.chat.completions.create({
            messages: continuationMessages as any,
            max_tokens: maxTokens - capturedStepIndex,
            temperature: 1.0,
            logprobs: true,
            top_logprobs: 5,
            stop: CHATML_STOP_SEQUENCES,
            stream: true,
          });
          continue;
      }
      
      break; // Generation completed normally
    }

    if (currentSignal.aborted) {
      console.info('[WebGPUWorker] In-flight inference cleanly cancelled.');
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Generation aborted' });
      return;
    }

    post({ type: 'GENERATION_COMPLETE', totalSteps });
    post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Generation complete' });
  } catch (err: any) {
    if (err?.name === 'AbortError' || currentSignal.aborted) {
      console.info('[WebGPUWorker] In-flight inference cleanly cancelled.');
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Generation aborted' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'ERROR', message: `Generation failed: ${message}` });
    post({ type: 'STATUS', status: 'error', progress: 0, text: message });
  } finally {
    if (activeAbortController?.signal === currentSignal) {
      activeAbortController = null;
    }
  }
}

// ─── Message Handler ────────────────────────────────────────────────

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const msg = event.data;

  switch (msg.type) {
    case 'LOAD_MODEL':
      await loadModel(msg.modelId);
      break;

    case 'GET_FULL_LOGITS':
      await getFullLogits(msg.messages, msg.systemPrompt);
      break;

    case 'RETURN_BUFFER':
      if (msg.buffer && msg.buffer instanceof ArrayBuffer) {
        bufferPool.push(msg.buffer);
      }
      break;

    case 'GENERATE_STEP':
      await generateSteps(msg.messages, msg.maxTokens, msg.maxThinkingTokens, msg.systemPrompt);
      break;

    case 'RESET_CHAT':
      if (engine) {
        await engine.resetChat();
      }
      capturedLogits = null;
      capturedStepIndex = 0;
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Context reset' });
      break;

    case 'ABORT':
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      if (engine) {
        await engine.interruptGenerate();
        await engine.resetChat();
      }
      post({ type: 'STATUS', status: 'ready', progress: 100, text: 'Generation aborted' });
      break;

    case 'UNLOAD':
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      if (engine) {
        await engine.unload();
        engine = null;
        currentModelId = null;
      }
      post({ type: 'STATUS', status: 'idle', progress: 0, text: 'Model unloaded' });
      break;
  }
};

// ─── Global Error & WebGPU Rejection Traps ───────────────────────────

self.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (msg.toLowerCase().includes('device lost') || msg.toLowerCase().includes('device is lost') || msg.toLowerCase().includes('webgpu')) {
    console.error('[WebGPUWorker] Unhandled WebGPU rejection caught:', reason);
    post({
      type: 'ENGINE_ERROR',
      payload: {
        code: 'WEBGPU_DEVICE_LOST',
        message: `GPU context was lost: ${msg}. Please reload the application.`,
      },
    });
    post({
      type: 'STATUS',
      status: 'error',
      progress: 0,
      text: `WebGPU Device Error: ${msg}`,
    });
  }
});

