import * as THREE from 'three';
import {
  IndexedTokenPoint,
  QuadtreeNode,
  SpatialBoundingBox,
  ScreenPolygonPoint,
  ClusterMetrics,
  BiomeBreakdown
} from '../types/spatial';
import { SEMANTIC_BIOMES } from './semanticBiomes';

const MAX_DEPTH = 5;
const MAX_POINTS_PER_LEAF = 64;

export class SpatialTokenIndex {
  private root: QuadtreeNode | null = null;
  private heightmap: Float32Array | null = null;
  private terrainSize: number = 300;
  private terrainHalfSize: number = 150;
  private gridW: number = 64;
  private gridH: number = 64;
  private allPoints: IndexedTokenPoint[] = [];

  public build(
    points: IndexedTokenPoint[],
    heightmap: Float32Array,
    terrainSize: number = 300,
    gridW: number = 64,
    gridH: number = 64
  ): void {
    this.allPoints = points;
    this.heightmap = heightmap;
    this.terrainSize = terrainSize;
    this.terrainHalfSize = terrainSize / 2;
    this.gridW = gridW;
    this.gridH = gridH;

    const bounds: SpatialBoundingBox = {
      minX: -this.terrainHalfSize,
      maxX: this.terrainHalfSize,
      minZ: -this.terrainHalfSize,
      maxZ: this.terrainHalfSize,
    };

    this.root = this.createNode(bounds, 0);
    for (let i = 0; i < points.length; i++) {
      this.insert(this.root, points[i]);
    }
  }

  private createNode(bounds: SpatialBoundingBox, depth: number): QuadtreeNode {
    return {
      bounds,
      points: [],
      children: undefined,
      isLeaf: true,
      depth,
    };
  }

  private insert(node: QuadtreeNode, point: IndexedTokenPoint): void {
    if (node.isLeaf) {
      if (node.points.length < MAX_POINTS_PER_LEAF || node.depth >= MAX_DEPTH) {
        node.points.push(point);
        return;
      }
      this.subdivide(node);
    }

    const { minX, maxX, minZ, maxZ } = node.bounds;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;

    const isNorth = point.worldZ < midZ;
    const isWest = point.worldX < midX;

    if (node.children) {
      if (isNorth && isWest) this.insert(node.children[0], point);      // NW
      else if (isNorth && !isWest) this.insert(node.children[1], point); // NE
      else if (!isNorth && isWest) this.insert(node.children[2], point); // SW
      else this.insert(node.children[3], point);                        // SE
    }
  }

  private subdivide(node: QuadtreeNode): void {
    const { minX, maxX, minZ, maxZ } = node.bounds;
    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;
    const nextDepth = node.depth + 1;

    node.children = [
      this.createNode({ minX, maxX: midX, minZ, maxZ: midZ }, nextDepth),      // NW
      this.createNode({ minX: midX, maxX, minZ, maxZ: midZ }, nextDepth),      // NE
      this.createNode({ minX, maxX: midX, minZ: midZ, maxZ }, nextDepth),      // SW
      this.createNode({ minX: midX, maxX, minZ: midZ, maxZ }, nextDepth),      // SE
    ];
    node.isLeaf = false;

    // Re-insert existing points into children
    const pointsToRedistribute = node.points;
    node.points = [];
    for (let i = 0; i < pointsToRedistribute.length; i++) {
      this.insert(node, pointsToRedistribute[i]);
    }
  }

  public queryNearest(worldX: number, worldZ: number, maxRadius: number = 8): IndexedTokenPoint | null {
    if (!this.root) return null;
    let closestPoint: IndexedTokenPoint | null = null;
    let minDistanceSq = maxRadius * maxRadius;

    const search = (node: QuadtreeNode) => {
      // Distance from point to bounding box
      const dx = Math.max(node.bounds.minX - worldX, 0, worldX - node.bounds.maxX);
      const dz = Math.max(node.bounds.minZ - worldZ, 0, worldZ - node.bounds.maxZ);
      if (dx * dx + dz * dz > minDistanceSq) return;

      if (node.isLeaf) {
        for (let i = 0; i < node.points.length; i++) {
          const pt = node.points[i];
          const distSq = (pt.worldX - worldX) ** 2 + (pt.worldZ - worldZ) ** 2;
          if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
            closestPoint = pt;
          }
        }
      } else if (node.children) {
        for (let i = 0; i < 4; i++) {
          search(node.children[i]);
        }
      }
    };

    search(this.root);
    return closestPoint;
  }

  public queryLassoScreenSpace(
    polygon: ScreenPolygonPoint[],
    camera: THREE.Camera,
    screenWidth: number,
    screenHeight: number
  ): IndexedTokenPoint[] {
    if (!this.root || polygon.length < 3) return [];

    // 1. Compute 2D polygon bounding box in screen pixels
    let polyMinX = Infinity;
    let polyMaxX = -Infinity;
    let polyMinY = Infinity;
    let polyMaxY = -Infinity;

    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i];
      if (p.x < polyMinX) polyMinX = p.x;
      if (p.x > polyMaxX) polyMaxX = p.x;
      if (p.y < polyMinY) polyMinY = p.y;
      if (p.y > polyMaxY) polyMaxY = p.y;
    }

    const selected: IndexedTokenPoint[] = [];
    const tempVec = new THREE.Vector3();
    const camPos = camera.position;

    // Helper: Screen-space projection
    const toScreen = (wx: number, wy: number, wz: number) => {
      tempVec.set(wx, wy, wz).project(camera);
      return {
        x: ((tempVec.x + 1) * screenWidth) / 2,
        y: ((-tempVec.y + 1) * screenHeight) / 2,
        zNDC: tempVec.z,
      };
    };

    // Helper: 2D Point-in-Polygon (Jordan Curve Theorem Ray Casting)
    const isInsidePolygon = (px: number, py: number): boolean => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    // Helper: 3D DDA Line-of-sight occlusion ray marcher
    const isVisible3DDDA = (token: IndexedTokenPoint): boolean => {
      if (!this.heightmap) return true;

      const steps = 24; // Precision ray samples
      const x0 = camPos.x;
      const y0 = camPos.y;
      const z0 = camPos.z;

      const x1 = token.worldX;
      const y1 = token.elevation;
      const z1 = token.worldZ;

      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        const rx = x0 + t * (x1 - x0);
        const ry = y0 + t * (y1 - y0);
        const rz = z0 + t * (z1 - z0);

        // World to safe 1D grid offset
        const gridX = Math.floor(((rx + this.terrainHalfSize) / this.terrainSize) * this.gridW);
        const gridZ = Math.floor(((rz + this.terrainHalfSize) / this.terrainSize) * this.gridH);
        const safeX = Math.max(0, Math.min(this.gridW - 1, gridX));
        const safeZ = Math.max(0, Math.min(this.gridH - 1, gridZ));

        const terrainElevation = this.heightmap[safeZ * this.gridW + safeX];
        if (terrainElevation > ry + 1.2) {
          // Terrain occludes sightline
          return false;
        }
      }
      return true;
    };

    // Recursive Quadtree search with screen-space node AABB culling
    const searchNode = (node: QuadtreeNode) => {
      // Project 4 corners of node's 3D bounding box to 2D screen AABB
      const c1 = toScreen(node.bounds.minX, 0, node.bounds.minZ);
      const c2 = toScreen(node.bounds.maxX, 0, node.bounds.minZ);
      const c3 = toScreen(node.bounds.minX, 0, node.bounds.maxZ);
      const c4 = toScreen(node.bounds.maxX, 0, node.bounds.maxZ);

      // If all corners are behind camera, skip
      if (c1.zNDC > 1.0 && c2.zNDC > 1.0 && c3.zNDC > 1.0 && c4.zNDC > 1.0) return;

      const nodeMinX = Math.min(c1.x, c2.x, c3.x, c4.x);
      const nodeMaxX = Math.max(c1.x, c2.x, c3.x, c4.x);
      const nodeMinY = Math.min(c1.y, c2.y, c3.y, c4.y);
      const nodeMaxY = Math.max(c1.y, c2.y, c3.y, c4.y);

      // Screen AABB Overlap test
      if (nodeMaxX < polyMinX || nodeMinX > polyMaxX || nodeMaxY < polyMinY || nodeMinY > polyMaxY) {
        return; // Node completely outside lasso bounding box
      }

      if (node.isLeaf) {
        for (let i = 0; i < node.points.length; i++) {
          const pt = node.points[i];
          const screenPos = toScreen(pt.worldX, pt.elevation, pt.worldZ);

          if (screenPos.zNDC > 1.0) continue; // Behind camera

          if (
            screenPos.x >= polyMinX &&
            screenPos.x <= polyMaxX &&
            screenPos.y >= polyMinY &&
            screenPos.y <= polyMaxY &&
            isInsidePolygon(screenPos.x, screenPos.y)
          ) {
            // Check 3D DDA occlusion
            if (isVisible3DDDA(pt)) {
              selected.push(pt);
            }
          }
        }
      } else if (node.children) {
        for (let i = 0; i < 4; i++) {
          searchNode(node.children[i]);
        }
      }
    };

    searchNode(this.root);
    return selected;
  }

  public computeClusterMetrics(selectedTokens: IndexedTokenPoint[]): ClusterMetrics {
    if (selectedTokens.length === 0) {
      return {
        tokenCount: 0,
        topTokens: [],
        shannonEntropy: 0,
        averageProbability: 0,
        biomeBreakdown: [],
        dominantBiome: 'None',
      };
    }

    // Sort tokens by probability descending
    const sorted = [...selectedTokens].sort((a, b) => (b.probability || 0) - (a.probability || 0));

    // Top candidates
    const topTokens = sorted.slice(0, 5).map((t, idx) => ({
      token_id: t.token_id,
      token_str: t.token_str,
      probability: t.probability || 0,
      rank: idx + 1,
      biomeId: t.biomeId,
    }));

    // Shannon Entropy: H = - sum(p * log2(p))
    let entropy = 0;
    let probSum = 0;
    const biomeCounts: Record<string, number> = {};

    for (let i = 0; i < selectedTokens.length; i++) {
      const t = selectedTokens[i];
      const p = t.probability || 0.0001;
      probSum += p;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
      biomeCounts[t.biomeId] = (biomeCounts[t.biomeId] || 0) + 1;
    }

    // Biome breakdown
    const biomeBreakdown: BiomeBreakdown[] = Object.keys(biomeCounts).map((bId) => {
      const biomeConfig = SEMANTIC_BIOMES.find((b) => b.id === bId);
      const count = biomeCounts[bId];
      return {
        biomeId: bId,
        label: biomeConfig ? biomeConfig.name : bId,
        color: biomeConfig ? biomeConfig.colorHex : '#94A3B8',
        count,
        percentage: Math.round((count / selectedTokens.length) * 100),
      };
    });

    biomeBreakdown.sort((a, b) => b.count - a.count);
    const dominantBiome = biomeBreakdown[0] ? biomeBreakdown[0].label : 'General';

    return {
      tokenCount: selectedTokens.length,
      topTokens,
      shannonEntropy: Math.max(0, entropy),
      averageProbability: probSum / selectedTokens.length,
      biomeBreakdown,
      dominantBiome,
    };
  }
}

export const spatialIndex = new SpatialTokenIndex();
