/* ─────────────────────────────────────────────────────────────────────
 * Coordinate Cache — IndexedDB storage for UMAP terrain coordinates
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

const DB_NAME = 'token-cosmos-terrain';
const DB_VERSION = 1;
const STORE_NAME = 'coordinates';

interface CachedCoordinates {
  modelId: string;
  vocabSize: number;
  coordinates: Float32Array;  // Interleaved [x0, y0, x1, y1, ...]
  version: number;
  cachedAt: number;
}

// ─── Database Init ──────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'modelId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ─── Get Cached Coordinates ─────────────────────────────────────────

export async function getCachedCoordinates(modelId: string): Promise<CachedCoordinates | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(modelId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Reconstruct Float32Array from stored ArrayBuffer
          resolve({
            ...result,
            coordinates: new Float32Array(result.coordinates),
          });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    console.warn('[CoordCache] IndexedDB unavailable, skipping cache');
    return null;
  }
}

// ─── Store Coordinates ──────────────────────────────────────────────

export async function setCachedCoordinates(data: CachedCoordinates): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Store as plain ArrayBuffer (Float32Array isn't directly storable in IDB)
      const storable = {
        ...data,
        coordinates: data.coordinates.buffer,
      };

      const request = store.put(storable);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    console.warn('[CoordCache] Failed to cache coordinates');
  }
}

// ─── Clear Cache ────────────────────────────────────────────────────

export async function clearCoordinateCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    console.warn('[CoordCache] Failed to clear cache');
  }
}
