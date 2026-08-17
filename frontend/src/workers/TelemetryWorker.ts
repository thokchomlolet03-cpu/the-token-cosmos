/* ─────────────────────────────────────────────────────────────────────
 * TelemetryWorker.ts — Background Telemetry Ingestion & Buffer Recycling
 * Isolates local database writes from the 60 FPS main rendering thread.
 * Recycles transferred ArrayBuffers back to the main thread pool.
 * The Token Cosmos v4.8
 * ───────────────────────────────────────────────────────────────────── */

interface TelemetryRecord {
  timestamp: number;
  stepIndex: number;
  tokenId: number;
  probability: number;
  entropy: number;
}

const localDatabase: TelemetryRecord[] = [];

self.onmessage = (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'LOG_BATCH' && data.buffer) {
    const buffer = data.buffer as ArrayBuffer;
    const view = new Float32Array(buffer);
    
    // Each record has 5 floats: [timestamp_offset, stepIndex, tokenId, probability, entropy]
    const recordCount = Math.floor(view.length / 5);
    const now = Date.now();

    for (let i = 0; i < recordCount; i++) {
      const offset = i * 5;
      localDatabase.push({
        timestamp: now + view[offset + 0],
        stepIndex: Math.round(view[offset + 1]),
        tokenId: Math.round(view[offset + 2]),
        probability: view[offset + 3],
        entropy: view[offset + 4],
      });
    }

    // Keep database capped in memory (10,000 records)
    if (localDatabase.length > 10000) {
      localDatabase.splice(0, localDatabase.length - 10000);
    }

    // ── Zero-Copy Buffer Recycling ────────────────────────────────────
    // Transfer the cleaned buffer back to the main thread's LIFO stack pool
    (self as unknown as Worker).postMessage(
      {
        type: 'BUFFER_RECYCLED',
        buffer,
      },
      [buffer]
    );
  } else if (data.type === 'QUERY_STATS') {
    const total = localDatabase.length;
    const avgEntropy = total > 0 ? localDatabase.reduce((acc, r) => acc + r.entropy, 0) / total : 0;
    
    (self as unknown as Worker).postMessage({
      type: 'STATS_RESULT',
      stats: {
        totalRecords: total,
        averageEntropy: avgEntropy,
      },
    });
  }
};
