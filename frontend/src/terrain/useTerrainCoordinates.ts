/* ─────────────────────────────────────────────────────────────────────
 * useTerrainCoordinates — React Hook
 * Loads pre-computed UMAP 2D coordinates from static binary assets
 * or IndexedDB cache. Returns a Map of tokenId → (x, y) positions.
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getCachedCoordinates, setCachedCoordinates } from './coordinateCache';

// ─── Known Pre-computed Asset Paths ─────────────────────────────────

const PRECOMPUTED_ASSETS: Record<string, string> = {
  'SmolLM2-135M-Instruct-q4f16_1-MLC': '/terrain/smollm2-135m-umap.bin',
  'SmolLM2-135M-Instruct-q0f16-MLC': '/terrain/smollm2-135m-umap.bin',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': '/terrain/qwen2.5-0.5b-umap.bin',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': '/terrain/qwen2.5-0.5b-umap.bin', // Shares vocab
};

// ─── Known Vocab Sizes ──────────────────────────────────────────────

const MODEL_VOCAB_SIZES: Record<string, number> = {
  'SmolLM2-135M-Instruct-q4f16_1-MLC': 49152,
  'SmolLM2-135M-Instruct-q0f16-MLC': 49152,
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': 151936,
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': 151936,
  '__SAMPLE_FALLBACK__': 49152, // Procedural terrain for sample data mode
};

// ─── Return Type ────────────────────────────────────────────────────

export interface TerrainCoordinates {
  // State
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  loadedModelId: string | null;
  vocabSize: number;

  // Data: raw interleaved [x0, y0, x1, y1, ...] for vertex shader
  rawCoordinates: Float32Array | null;

  // Lookup: get (x, y) for a specific token ID
  getPosition: (tokenId: number) => { x: number; y: number } | null;

  // Semantic region estimation from coordinates
  getRegionLabel: (x: number, y: number) => string;

  // Reload for a different model
  loadForModel: (modelId: string) => void;
}

// ─── Binary Format ──────────────────────────────────────────────────
// Header: [vocabSize: uint32, version: uint32] (8 bytes)
// Body:   [x0: f32, y0: f32, x1: f32, y1: f32, ...] (vocabSize * 2 * 4 bytes)

async function loadBinaryCoordinates(url: string): Promise<{
  vocabSize: number;
  coordinates: Float32Array;
}> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load coordinates: ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('Coordinate asset resolved to HTML instead of binary data');
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 8) throw new Error('Coordinate asset is missing its binary header');
  const header = new Uint32Array(buffer, 0, 2);
  const vocabSize = header[0];
  const expectedLength = 8 + vocabSize * 2 * Float32Array.BYTES_PER_ELEMENT;
  if (vocabSize === 0 || expectedLength !== buffer.byteLength) {
    throw new Error('Coordinate asset has an invalid binary length');
  }
  // const version = header[1]; // Reserved for future use

  const coordinates = new Float32Array(buffer, 8, vocabSize * 2);
  return { vocabSize, coordinates };
}

// ─── Deterministic PRNG (Mulberry32) ────────────────────────────────
// A fast, seedable 32-bit PRNG for reproducible procedural coordinates.

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Box-Muller transform for gaussian random numbers
function gaussianPair(rng: () => number): [number, number] {
  const u1 = rng();
  const u2 = rng();
  const r = Math.sqrt(-2.0 * Math.log(Math.max(u1, 1e-10)));
  const theta = 2.0 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

// ─── Generate Procedural UMAP-like Coordinates ──────────────────────
// Creates a multi-cluster gaussian layout that mimics real UMAP topology.
// Tokens are grouped into 16 semantic clusters with gaussian spread,
// producing visible continents, valleys, and topographic structure.

function generateFallbackCoordinates(vocabSize: number): Float32Array {
  const coords = new Float32Array(vocabSize * 2);
  const rng = mulberry32(42); // Fixed seed for determinism

  // Define 16 cluster centers arranged in a spread pattern
  const NUM_CLUSTERS = 16;
  const clusterCenters: Array<{ cx: number; cy: number; sigma: number }> = [];
  
  for (let c = 0; c < NUM_CLUSTERS; c++) {
    const angle = (c / NUM_CLUSTERS) * 2 * Math.PI + rng() * 0.3;
    const radius = 0.35 + rng() * 0.45; // Cluster centers between 0.35 and 0.8
    clusterCenters.push({
      cx: radius * Math.cos(angle),
      cy: radius * Math.sin(angle),
      sigma: 0.06 + rng() * 0.08, // Gaussian spread per cluster
    });
  }

  // Add a dense core cluster
  clusterCenters.push({ cx: 0, cy: 0, sigma: 0.12 });

  const totalClusters = clusterCenters.length;

  for (let i = 0; i < vocabSize; i++) {
    // Assign token to cluster based on hash (simulates semantic grouping)
    const clusterIdx = Math.floor(rng() * totalClusters);
    const cluster = clusterCenters[clusterIdx];
    
    const [gx, gy] = gaussianPair(rng);
    
    let x = cluster.cx + gx * cluster.sigma;
    let y = cluster.cy + gy * cluster.sigma;

    // Clamp to [-1, 1]
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));

    coords[i * 2] = x;
    coords[i * 2 + 1] = y;
  }

  return coords;
}

// ─── Semantic Region Estimator ──────────────────────────────────────
// Rough quadrant labels based on UMAP clustering patterns.
// These get refined once we analyze actual UMAP outputs.

function estimateRegion(x: number, y: number): string {
  const angle = Math.atan2(y, x);
  const r = Math.sqrt(x * x + y * y);

  if (r < 0.15) return 'Core (High Frequency)';

  if (angle >= -Math.PI / 4 && angle < Math.PI / 4) return 'East (Nouns / Entities)';
  if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) return 'North (Adjectives / Descriptors)';
  if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) return 'South (Code / Syntax)';
  return 'West (Function Words / Grammar)';
}

// ─── The Hook ───────────────────────────────────────────────────────

export function useTerrainCoordinates(initialModelId?: string): TerrainCoordinates {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vocabSize, setVocabSize] = useState(0);
  const [rawCoordinates, setRawCoordinates] = useState<Float32Array | null>(null);
  const [loadedModelId, setLoadedModelId] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const loadForModel = useCallback(async (modelId: string) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setError(null);
    setRawCoordinates(null);
    setVocabSize(0);

    const applyCoordinates = (coordinates: Float32Array, size: number) => {
      if (requestId !== loadRequestRef.current) return false;
      setRawCoordinates(coordinates);
      setVocabSize(size);
      setLoadedModelId(modelId);
      setIsLoading(false);
      return true;
    };

    try {
      // 1. Check IndexedDB cache first
      const cached = await getCachedCoordinates(modelId);
      if (cached) {
        if (!applyCoordinates(cached.coordinates, cached.vocabSize)) return;
        console.log(`[Terrain] Loaded cached coordinates for ${modelId} (${cached.vocabSize} tokens)`);
        return;
      }

      // 2. Check for pre-computed static asset
      const assetPath = PRECOMPUTED_ASSETS[modelId];
      if (assetPath) {
        try {
          const { vocabSize: vs, coordinates } = await loadBinaryCoordinates(assetPath);
          if (!applyCoordinates(coordinates, vs)) return;

          // Cache for next time
          await setCachedCoordinates({
            modelId,
            vocabSize: vs,
            coordinates,
            version: 1,
            cachedAt: Date.now(),
          });

          console.log(`[Terrain] Loaded pre-computed coordinates for ${modelId} (${vs} tokens)`);
          return;
        } catch (assetErr) {
          console.warn(`[Terrain] Pre-computed asset not found for ${modelId}, using fallback`);
        }
      }

      // 3. Fallback: generate procedural UMAP-like coordinates
      // (clusters are procedural, not semantically meaningful, but visually correct)
      const fallbackSize = MODEL_VOCAB_SIZES[modelId] || 151936;
      const fallbackCoords = generateFallbackCoordinates(fallbackSize);
      if (!applyCoordinates(fallbackCoords, fallbackSize)) return;

      console.log(`[Terrain] Generated procedural terrain coordinates for ${modelId} (${fallbackSize} tokens)`);

    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
    }
  }, []);

  // Auto-load on mount if initialModelId provided
  useEffect(() => {
    if (initialModelId) {
      loadForModel(initialModelId);
    }
  }, [initialModelId, loadForModel]);

  const getPosition = useCallback(
    (tokenId: number): { x: number; y: number } | null => {
      if (!rawCoordinates || tokenId < 0 || tokenId >= vocabSize) return null;
      return {
        x: rawCoordinates[tokenId * 2],
        y: rawCoordinates[tokenId * 2 + 1],
      };
    },
    [rawCoordinates, vocabSize]
  );

  return {
    isLoading,
    isLoaded: rawCoordinates !== null && rawCoordinates.length > 0,
    error,
    loadedModelId,
    vocabSize,
    rawCoordinates,
    getPosition,
    getRegionLabel: estimateRegion,
    loadForModel,
  };
}
