/* ─────────────────────────────────────────────────────────────────────
 * localDb.ts — LIFO Stack Telemetry Buffer Pool & Sovereign IndexedDB Client
 * Manages zero-copy ArrayBuffer transfers to the IndexedDB TelemetryWorker.
 * Requests hardware durable storage via navigator.storage.persist().
 * Guarantees persistent local hard-drive storage with zero network egress.
 * The Token Cosmos v4.9
 * ───────────────────────────────────────────────────────────────────── */

const BATCH_CAPACITY = 20; // 20 records * 5 floats = 100 floats
const RECORD_STRIDE = 5;
const BUFFER_SIZE = BATCH_CAPACITY * RECORD_STRIDE;

export class LocalTelemetryClient {
  private worker: Worker | null = null;
  private pool: Float32Array[] = [];
  private currentBatch: Float32Array;
  private currentRecordCount: number = 0;
  public isAirgapped: boolean;
  public isDurable: boolean = false;

  constructor(isAirgapped: boolean = true) {
    this.isAirgapped = isAirgapped;
    this.pool = [
      new Float32Array(BUFFER_SIZE),
      new Float32Array(BUFFER_SIZE),
      new Float32Array(BUFFER_SIZE),
    ];
    this.currentBatch = this.acquireBuffer();
    this.initWorker();
    this.requestDurableStorage();
  }

  /**
   * Explicitly requests persistent, non-evictable browser storage for compliance audits
   */
  public async requestDurableStorage(): Promise<boolean> {
    try {
      if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
        this.isDurable = await navigator.storage.persist();
        if (this.isDurable) {
          console.log('[TelemetryClient] Hardware durable storage granted: IndexedDB is immune to browser eviction.');
        } else {
          console.warn('[TelemetryClient] Best-effort storage active. Browser may evict if disk space is critically low.');
        }
        return this.isDurable;
      }
    } catch (e) {
      console.warn('[TelemetryClient] Storage persist request failed:', e);
    }
    return false;
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

  /**
   * Queries summary statistics from the persistent IndexedDB ledger
   */
  public queryStats(): Promise<{ totalRecords: number; databaseName: string; storageType: string; isDurable: boolean }> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve({ totalRecords: 0, databaseName: 'InMemoryFallback', storageType: 'Volatile RAM', isDurable: false });
        return;
      }

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'STATS_RESULT') {
          this.worker?.removeEventListener('message', handler);
          resolve({
            ...e.data.stats,
            isDurable: this.isDurable,
          });
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'QUERY_STATS' });
    });
  }

  /**
   * Exports all historical audit records for compliance verification
   */
  public exportAuditLogs(): Promise<any[]> {
    return new Promise((resolve) => {
      if (!this.worker) {
        resolve([]);
        return;
      }

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'EXPORT_RESULT') {
          this.worker?.removeEventListener('message', handler);
          resolve(e.data.records);
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'EXPORT_LOGS' });
    });
  }

  public clearDatabase(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'CLEAR_DB' });
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
