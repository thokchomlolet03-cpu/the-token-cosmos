export interface SpatialBoundingBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface IndexedTokenPoint {
  token_id: number;
  token_str: string;
  worldX: number;
  worldZ: number;
  elevation: number;
  biomeId: string;
  probability?: number;
  rawLogit?: number;
  rank?: number;
}

export interface QuadtreeNode {
  bounds: SpatialBoundingBox;
  points: IndexedTokenPoint[];
  children?: [QuadtreeNode, QuadtreeNode, QuadtreeNode, QuadtreeNode]; // NW, NE, SW, SE
  isLeaf: boolean;
  depth: number;
}

export interface ScreenPolygonPoint {
  x: number;
  y: number;
}

export interface BiomeBreakdown {
  biomeId: string;
  label: string;
  color: string;
  count: number;
  percentage: number;
}

export interface ClusterMetrics {
  tokenCount: number;
  topTokens: Array<{
    token_id: number;
    token_str: string;
    probability: number;
    rank: number;
    biomeId: string;
  }>;
  shannonEntropy: number;
  averageProbability: number;
  biomeBreakdown: BiomeBreakdown[];
  dominantBiome: string;
}

export interface LassoSelectionEvent {
  points: ScreenPolygonPoint[];
  selectedTokens: IndexedTokenPoint[];
  metrics: ClusterMetrics;
  screenCentroid: { x: number; y: number };
}
