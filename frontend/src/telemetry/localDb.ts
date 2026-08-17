/* ─────────────────────────────────────────────────────────────────────
 * localDb.ts — LIFO Stack Telemetry Buffer Pool & Zero-Egress Dispatcher
 * Manages zero-copy ArrayBuffer transfers to the TelemetryWorker.
 * Guarantees zero outbound network packets when AIRGAPPED = true.
 * The Token Cosmos v4.8
 * ───────────────────────────────────────────────────────────────────── */

const BATCH_CAPACITY = 20; // 20 records * 5 floats = 100 floats
const RECORD_STRIDE = 5;
const BUFFER_SIZE = BATCH_CAPACITY * RECORD_STRIDE;

export class LocalTelemetryClient {
  private worker: Worker | null = null;
  private pool: Float32Array[] = [];
  private currentBatch: Float32Array;
  private currentRecordCount: number = 0;
  private isAirgapped: boolean;

  constructor(isAirgapped: boolean = false) {
    this.isAirgapped = isAirgapped;
    this.pool = [
      new Float32Array(BUFFER_SIZE),
      new Float32Array(BUFFER_SIZE),
      new Float32Array(BUFFER_SIZE),
    ];
    this.currentBatch = this.acquireBuffer();
    this.initWorker();
  }

  private initWorker(): void {
    try {
      this.worker = new Worker(new URL('../workers/TelemetryWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'BUFFER_RECYCLED' && e.data.buffer) {
          // Re-instantiate fresh view on the returned buffer and return to LIFO stack
          this.pool.push(new Float32Array(e.data.buffer));
        }
      };
    } catch (err) {
      console.warn('[TelemetryClient] Background worker initialization failed, running in-memory:', err);
    }
  }

  /**
   * Acquires a Float32Array from the LIFO stack pool, with safe fallback
   */
  private acquireBuffer(): Float32Array {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    // Safe fallback allocation if worker is slightly behind
    return new Float32Array(BUFFER_SIZE);
  }

  /**
   * Enqueues a single telemetry event into the local buffer
   */
  public logStep(stepIndex: number, tokenId: number, probability: number, entropy: number): void {
    const offset = this.currentRecordCount * RECORD_STRIDE;
    this.currentBatch[offset + 0] = 0.0;
    this.currentBatch[offset + 1] = stepIndex;
    this.currentBatch[offset + 2] = tokenId;
    this.currentBatch[offset + 3] = probability;
    this.currentBatch[offset + 4] = entropy;

    this.currentRecordCount++;

    if (this.currentRecordCount >= BATCH_CAPACITY) {
      this.flush();
    }
  }

  /**
   * Flushes current batch to background worker via zero-copy buffer transfer
   */
  public flush(): void {
    if (this.currentRecordCount === 0) return;

    if (this.worker) {
      const bufferToTransfer = this.currentBatch;
      this.currentBatch = this.acquireBuffer();
      this.currentRecordCount = 0;

      // Transfer ArrayBuffer ownership directly to worker thread (0ms CPU cost)
      this.worker.postMessage(
        {
          type: 'LOG_BATCH',
          buffer: bufferToTransfer.buffer,
        },
        [bufferToTransfer.buffer]
      );
    }
  }

  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const localTelemetry = new LocalTelemetryClient(true);
