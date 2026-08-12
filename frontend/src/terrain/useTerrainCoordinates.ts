/* ─────────────────────────────────────────────────────────────────────
 * useTerrainCoordinates — React Hook
 * Loads pre-computed UMAP 2D coordinates from static binary assets
 * or IndexedDB cache. Returns a Map of tokenId → (x, y) positions.
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import { getCachedCoordinates, setCachedCoordinates } from './coordinateCache';

// ─── Known Pre-computed Asset Paths ─────────────────────────────────

const PRECOMPUTED_ASSETS: Record<string, string> = {
  'SmolLM2-135M-Instruct-q4f16_1-MLC': '/terrain/smollm2-135m-umap.bin',
  'Qwen2.5-0.5B-Instruct-q4f16_1-MLC': '/terrain/qwen2.5-0.5b-umap.bin',
  'Qwen2.5-1.5B-Instruct-q4f16_1-MLC': '/terrain/qwen2.5-0.5b-umap.bin', // Shares vocab
};

// ─── Return Type ────────────────────────────────────────────────────

export interface TerrainCoordinates {
  // State
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
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

  const buffer = await response.arrayBuffer();
  const header = new Uint32Array(buffer, 0, 2);
  const vocabSize = header[0];
  // const version = header[1]; // Reserved for future use

  const coordinates = new Float32Array(buffer, 8, vocabSize * 2);
  return { vocabSize, coordinates };
}

// ─── Generate Fallback Coordinates ──────────────────────────────────
// When no pre-computed UMAP data is available, generate a spiral layout
// as a deterministic fallback. This is NOT semantically meaningful,
// but keeps the renderer functional.

function generateFallbackCoordinates(vocabSize: number): Float32Array {
  const coords = new Float32Array(vocabSize * 2);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399

  for (let i = 0; i < vocabSize; i++) {
    const r = Math.sqrt(i / vocabSize); // Uniform disk distribution
    const theta = i * goldenAngle;
    coords[i * 2] = r * Math.cos(theta);     // x ∈ [-1, 1]
    coords[i * 2 + 1] = r * Math.sin(theta); // y ∈ [-1, 1]
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
  const [currentModelId, setCurrentModelId] = useState<string | null>(initialModelId || null);

  const loadForModel = useCallback(async (modelId: string) => {
    setCurrentModelId(modelId);
    setIsLoading(true);
    setError(null);

    try {
      // 1. Check IndexedDB cache first
      const cached = await getCachedCoordinates(modelId);
      if (cached) {
        setRawCoordinates(cached.coordinates);
        setVocabSize(cached.vocabSize);
        setIsLoading(false);
        console.log(`[Terrain] Loaded cached coordinates for ${modelId} (${cached.vocabSize} tokens)`);
        return;
      }

      // 2. Check for pre-computed static asset
      const assetPath = PRECOMPUTED_ASSETS[modelId];
      if (assetPath) {
        try {
          const { vocabSize: vs, coordinates } = await loadBinaryCoordinates(assetPath);
          setRawCoordinates(coordinates);
          setVocabSize(vs);
          setIsLoading(false);

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

      // 3. Fallback: generate fibonacci spiral coordinates
      // (visually interesting but not semantically meaningful)
      const fallbackSize = 49152; // SmolLM2-135M default
      const fallbackCoords = generateFallbackCoordinates(fallbackSize);
      setRawCoordinates(fallbackCoords);
      setVocabSize(fallbackSize);
      setIsLoading(false);

      console.log(`[Terrain] Generated fallback spiral coordinates (${fallbackSize} tokens)`);

    } catch (err) {
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
    vocabSize,
    rawCoordinates,
    getPosition,
    getRegionLabel: estimateRegion,
    loadForModel,
  };
}
