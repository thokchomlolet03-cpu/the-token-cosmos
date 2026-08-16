/* ─────────────────────────────────────────────────────────────────────
 * semanticBiomes.ts — Semantic Topographic Cartography
 * Defines the 4 Primary Continents, Regional Graticule Sectors,
 * and Biome Color Palettes for the 3D Token Cosmos Terrain.
 * The Token Cosmos v4.2
 * ───────────────────────────────────────────────────────────────────── */

export interface SemanticBiome {
  id: string;
  name: string;
  shortLabel: string;
  code: string;
  description: string;
  colorHex: string;
  rgb: [number, number, number];
  center: [number, number]; // normalized UMAP [-1, 1]
  radius: number;
  elevationBias: number; // Base topological height of this plateau
}

export const SEMANTIC_BIOMES: SemanticBiome[] = [
  {
    id: 'geo_entities',
    name: 'Entities & Geography',
    shortLabel: 'CAPITAL CITIES & GEOGRAPHY',
    code: 'GEO',
    description: 'Cities, countries, named entities, proper nouns & geographical references',
    colorHex: '#F59E0B', // Amber / Terracotta
    rgb: [0.96, 0.62, 0.04],
    center: [0.45, 0.45],
    radius: 0.55,
    elevationBias: 12.0, // High mountainous plateau
  },
  {
    id: 'abstract_verbs',
    name: 'Abstract Concepts & Verbs',
    shortLabel: 'ABSTRACT VERBS & CONCEPTS',
    code: 'VRB',
    description: 'Action verbs, mental processes, transitions, and philosophical abstractions',
    colorHex: '#818CF8', // Indigo / Cobalt
    rgb: [0.51, 0.55, 0.97],
    center: [-0.50, 0.15],
    radius: 0.55,
    elevationBias: 10.0, // Elevated rolling hills
  },
  {
    id: 'syntax_structure',
    name: 'Syntax & Structural Tokens',
    shortLabel: 'SYNTAX & BRACKETS',
    code: 'SYN',
    description: 'Punctuation, JSON syntax, markdown fences, braces & formatting delimiters',
    colorHex: '#64748B', // Basalt Slate
    rgb: [0.39, 0.45, 0.55],
    center: [0.0, -0.60],
    radius: 0.50,
    elevationBias: 4.0, // Low coastal shelf
  },
  {
    id: 'numeric_code',
    name: 'Numerics & Code Logic',
    shortLabel: 'NUMERICS & PROGRAMMING',
    code: 'NUM',
    description: 'Integers, floats, code keywords, hexadecimal bytes & mathematical symbols',
    colorHex: '#06B6D4', // Cyan / Emerald
    rgb: [0.02, 0.71, 0.83],
    center: [0.55, -0.25],
    radius: 0.50,
    elevationBias: 8.0, // Crystalline ridge
  },
  {
    id: 'core_grammar',
    name: 'Core High-Frequency Grammar',
    shortLabel: 'CORE GRAMMAR & STOPWORDS',
    code: 'COR',
    description: 'High-frequency function words, articles, prepositions, and universal roots',
    colorHex: '#E2E8F0', // Platinum
    rgb: [0.89, 0.91, 0.94],
    center: [0.0, 0.0],
    radius: 0.25,
    elevationBias: 15.0, // Central high spire / caldera
  },
];

// ─── Alphanumeric Graticule System ──────────────────────────────────
// 6 Columns: A, B, C, D, E, F (X axis: -1.0 to +1.0)
// 6 Rows:    01, 02, 03, 04, 05, 06 (Y axis: -1.0 to +1.0)

export const GRATICULE_COLS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const GRATICULE_ROWS = ['01', '02', '03', '04', '05', '06'];

export function getSectorCode(x: number, y: number): string {
  const normX = Math.max(0, Math.min(0.999, (x + 1.0) / 2.0));
  const normY = Math.max(0, Math.min(0.999, (y + 1.0) / 2.0));

  const colIdx = Math.floor(normX * GRATICULE_COLS.length);
  const rowIdx = Math.floor(normY * GRATICULE_ROWS.length);

  return `${GRATICULE_COLS[colIdx]}-${GRATICULE_ROWS[rowIdx]}`;
}

export function getDominantBiome(x: number, y: number): SemanticBiome {
  // Check Core first if within core radius
  const distCore = Math.sqrt(x * x + y * y);
  if (distCore < 0.22) {
    return SEMANTIC_BIOMES[4]; // Core
  }

  let bestBiome = SEMANTIC_BIOMES[0];
  let minDistance = Infinity;

  for (const biome of SEMANTIC_BIOMES.slice(0, 4)) {
    const dx = x - biome.center[0];
    const dy = y - biome.center[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDistance) {
      minDistance = dist;
      bestBiome = biome;
    }
  }

  return bestBiome;
}

export function computeBaseTopologicalHeight(x: number, y: number): number {
  let height = 0;
  for (const biome of SEMANTIC_BIOMES) {
    const dx = x - biome.center[0];
    const dy = y - biome.center[1];
    const distSq = dx * dx + dy * dy;
    const influence = Math.exp(-distSq / (2 * biome.radius * biome.radius));
    height += influence * biome.elevationBias;
  }
  return height;
}
