/* ─────────────────────────────────────────────────────────────────────
 * TelemetryWorker.ts — Native IndexedDB Persistent Telemetry Ledger
 * 100% Persistent, Client-Side Audit Storage with Zero Network Egress.
 * Direct IndexedDB transactions with zero-copy transferable buffer recycling
 * and automated LRU disk ring buffer pruning (capped at 50,000 records).
 * The Token Cosmos v4.9
 * ───────────────────────────────────────────────────────────────────── */

const DB_NAME = 'TokenCosmosTelemetryDB';
const DB_VERSION = 1;
const STORE_NAME = 'telemetry_records';
const MAX_PERSISTED_RECORDS = 50000; // Cap persistent storage to prevent disk bloat (~5MB)

let dbInstance: IDBDatabase | null = null;
const pendingBatches: ArrayBuffer[] = [];

// ─── 1. Initialize Persistent Local IndexedDB Database ──────────────
function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('stepIndex', 'stepIndex', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.warn('[TelemetryWorker] IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

// Kick off async DB initialization
initDatabase()
  .then((db) => {
    // Process any batches that queued while DB was opening
    while (pendingBatches.length > 0) {
      const buf = pendingBatches.shift()!;
      persistBatch(db, buf);
    }
  })
  .catch((err) => {
    console.warn('[TelemetryWorker] Running in fallback mode:', err);
  });

// ─── 2. Persist Batch to IndexedDB with LRU Disk Pruning ────────────
function persistBatch(db: IDBDatabase, buffer: ArrayBuffer): void {
  try {
    const view = new Float32Array(buffer);
    const recordCount = Math.floor(view.length / 5);
    const now = Date.now();

    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (let i = 0; i < recordCount; i++) {
      const offset = i * 5;
      store.add({
        timestamp: now + view[offset + 0],
        stepIndex: Math.round(view[offset + 1]),
        tokenId: Math.round(view[offset + 2]),
        probability: view[offset + 3],
        entropy: view[offset + 4],
      });
    }

    // LRU Ring Buffer Pruning: Check count and prune oldest if exceeding limit
    const countReq = store.count();
    countReq.onsuccess = () => {
      const currentTotal = countReq.result;
      if (currentTotal > MAX_PERSISTED_RECORDS) {
        const excess = currentTotal - MAX_PERSISTED_RECORDS;
        let deleted = 0;
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor && deleted < excess) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };

    transaction.oncomplete = () => {
      // ── Zero-Copy Transfer Buffer Back to Main Thread Pool ─────────
      (self as unknown as Worker).postMessage(
        {
          type: 'BUFFER_RECYCLED',
          buffer,
        },
        [buffer]
      );
    };

    transaction.onerror = () => {
      // Return buffer even if transaction errors to prevent buffer starvation
      (self as unknown as Worker).postMessage(
        {
          type: 'BUFFER_RECYCLED',
          buffer,
        },
        [buffer]
      );
    };
  } catch (_err) {
    (self as unknown as Worker).postMessage(
      {
        type: 'BUFFER_RECYCLED',
        buffer,
      },
      [buffer]
    );
  }
}

// ─── 3. Message Dispatcher & Telemetry Query Handlers ───────────────
self.onmessage = (e: MessageEvent) => {
  const data = e.data;

  if (data.type === 'LOG_BATCH' && data.buffer) {
    const buffer = data.buffer as ArrayBuffer;

    if (dbInstance) {
      persistBatch(dbInstance, buffer);
    } else {
      pendingBatches.push(buffer);
    }
  } else if (data.type === 'QUERY_STATS') {
    if (!dbInstance) {
      (self as unknown as Worker).postMessage({
        type: 'STATS_RESULT',
        stats: { totalRecords: 0, averageEntropy: 0, isPersisted: false },
      });
      return;
    }

    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      (self as unknown as Worker).postMessage({
        type: 'STATS_RESULT',
        stats: {
          totalRecords: countRequest.result,
          databaseName: DB_NAME,
          storageType: 'Persistent IndexedDB (Zero-Egress)',
          maxCapacity: MAX_PERSISTED_RECORDS,
        },
      });
    };
  } else if (data.type === 'EXPORT_LOGS') {
    if (!dbInstance) {
      (self as unknown as Worker).postMessage({ type: 'EXPORT_RESULT', records: [] });
      return;
    }

    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      (self as unknown as Worker).postMessage({
        type: 'EXPORT_RESULT',
        records: getAllRequest.result,
      });
    };
  } else if (data.type === 'CLEAR_DB') {
    if (dbInstance) {
      const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
    }
  }
};
