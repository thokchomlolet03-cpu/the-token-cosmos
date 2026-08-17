/* ─────────────────────────────────────────────────────────────────────
 * FlightPath.ts — Zero-Allocation Catmull-Rom Trajectory Engine
 * Pre-allocated 512-Quad Spline Buffer with Dynamic Arc-Length Parameterization
 * Hoisted Working Vectors (0 Heap Allocations per frame)
 * Gimbal-Lock & Zero-Distance NaN Protection with Buffer-Relative UV Scaling
 * The Token Cosmos v5.0
 * ───────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';

export interface TrajectoryAnomaly {
  type: 'DRIFT_JUMP' | 'REPETITION_LOOP';
  message: string;
  stepIndex: number;
  tokenStr: string;
  severity: 'warning' | 'critical';
  location: THREE.Vector3;
}

const RIBBON_VERTEX_SHADER = `
  varying vec2 v_uv;
  varying vec3 v_world_pos;

  void main() {
    v_uv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    v_world_pos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform float u_time;
  uniform vec3 u_head_color;
  uniform vec3 u_tail_color;
  uniform float u_has_anomaly;
  uniform float u_is_ghost;
  
  varying vec2 v_uv;
  varying vec3 v_world_pos;

  void main() {
    // v_uv.y maps from fading tail (0.0) to active head (1.0)
    float progress = v_uv.y;
    
    // Normal active neon glow vs crimson anomaly alert vs ghost trajectory
    vec3 baseCol = mix(u_tail_color, u_head_color, smoothstep(0.0, 1.0, progress));
    
    if (u_has_anomaly > 0.5) {
      vec3 anomalyCol = vec3(0.95, 0.20, 0.25); // Crimson warning
      baseCol = mix(baseCol, anomalyCol, 0.85);
    }
    
    if (u_is_ghost > 0.5) {
      vec3 ghostCol = vec3(0.38, 0.45, 0.65); // Ghost lavender-slate
      baseCol = mix(baseCol, ghostCol, 0.85);
    }
    
    // Edge glow falloff
    float edgeGlow = pow(sin(v_uv.x * 3.14159), 0.65);
    
    // Quadratic tail fade (progress^2) keeps tail cleanly dissolved
    float maxAlpha = (u_is_ghost > 0.5) ? 0.45 : 0.95;
    float alpha = pow(progress, 1.8) * edgeGlow * maxAlpha;
    
    gl_FragColor = vec4(baseCol * (u_is_ghost > 0.5 ? 1.0 : 1.8), alpha);
  }
`;

export class FlightPath {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  
  private rawWaypoints: THREE.Vector3[] = [];
  private maxWaypoints: number = 128;
  private subSteps: number = 4; // 128 * 4 = 512 quads (Power of 2 aligned)
  private isGhost: boolean;
  
  // ── True Zero-Allocation Pre-Allocated Reusable Pool ───────────────
  private cachedCurve = new THREE.CatmullRomCurve3([], false, 'catmullrom', 0.5);
  private vectorPool = Array.from({ length: 512 }, () => new THREE.Vector3());

  // ── Hoisted Working Vectors (0 Heap Allocations per frame) ─────────
  private _workingTangent = new THREE.Vector3();
  private _workingUp = new THREE.Vector3(0, 1, 0);
  private _workingSide = new THREE.Vector3();

  public onAnomalyDetected?: (anomaly: TrajectoryAnomaly) => void;

  constructor(maxPoints: number = 128, _ribbonWidth: number = 1.8, isGhost: boolean = false) {
    this.maxWaypoints = maxPoints;
    this.isGhost = isGhost;
    const maxQuads = this.maxWaypoints * this.subSteps; // 512 quads (1024 triangles)
    
    this.geometry = new THREE.BufferGeometry();
    
    // Positions: 512 quads * 2 vertices * 3 coords = 3,072 floats
    this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxQuads * 2 * 3), 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(maxQuads * 2 * 3), 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(maxQuads * 2 * 2), 2));

    // Build static quad index array
    const indices = new Uint16Array((maxQuads - 1) * 6);
    for (let i = 0; i < maxQuads - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      const idx = i * 6;
      indices[idx + 0] = v0;
      indices[idx + 1] = v1;
      indices[idx + 2] = v2;

      indices[idx + 3] = v1;
      indices[idx + 4] = v3;
      indices[idx + 5] = v2;
    }
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0.0 },
        u_head_color: { value: isGhost ? new THREE.Color(0x64748B) : new THREE.Color(0x06B6D4) },
        u_tail_color: { value: isGhost ? new THREE.Color(0x334155) : new THREE.Color(0x4F46E5) },
        u_has_anomaly: { value: 0.0 },
        u_is_ghost: { value: isGhost ? 1.0 : 0.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    // Hardware polygon depth offset for Ghost Trajectories to eliminate Z-fighting
    if (isGhost) {
      this.material.polygonOffset = true;
      this.material.polygonOffsetFactor = 1.0;
      this.material.polygonOffsetUnits = 1.0;
    }

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = isGhost ? 14 : 15;
    
    // ── Frustum Culling Bypass (Prevents ribbon from vanishing on camera orbit)
    this.mesh.frustumCulled = false;
  }

  /**
   * Appends a new generation step coordinate to the 3D trajectory spline
   */
  public addStep(
    tokenStr: string,
    stepIndex: number,
    point: THREE.Vector3,
    probability: number = 1.0,
    maxProbability: number = 1.0,
    rank: number = 1
  ): void {
    const elevatedPoint = point.clone();
    elevatedPoint.y += (this.isGhost ? 2.2 : 2.8);

    // ── Calibrated Anomaly Detection (Zero False Alarms on Step 1) ──
    if (!this.isGhost && stepIndex >= 2 && this.rawWaypoints.length >= 1) {
      const prev = this.rawWaypoints[this.rawWaypoints.length - 1];
      const dist = elevatedPoint.distanceTo(prev);

      // Only trigger if large jump (>250 units) AND low relative probability/rank
      const isLowConfidence = (probability / Math.max(maxProbability, 1e-5) < 0.50) || rank > 3;
      if (dist > 250.0 && isLowConfidence) {
        this.material.uniforms.u_has_anomaly.value = 1.0;
        this.onAnomalyDetected?.({
          type: 'DRIFT_JUMP',
          message: `Semantic Jump (${dist.toFixed(0)} units to "${tokenStr}")`,
          stepIndex,
          tokenStr,
          severity: 'warning',
          location: elevatedPoint,
        });
      } else {
        this.material.uniforms.u_has_anomaly.value = 0.0;
      }
    }

    if (this.rawWaypoints.length >= this.maxWaypoints) {
      this.rawWaypoints.shift();
    }
    this.rawWaypoints.push(elevatedPoint);
    this.rebuildSpline();
  }

  private rebuildSpline(): void {
    if (this.rawWaypoints.length < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    // Refresh segment length cache (Prevents Rubber-Banding)
    this.cachedCurve.points = this.rawWaypoints;
    this.cachedCurve.updateArcLengths();

    const maxCapacity = (this.maxWaypoints * this.subSteps) - 1;
    const totalPoints = Math.min((this.rawWaypoints.length - 1) * this.subSteps + 1, 512);

    // Sample by uniform physical arc-length into pre-allocated vector pool
    for (let i = 0; i < totalPoints; i++) {
      const t = i / (totalPoints - 1);
      this.cachedCurve.getPointAt(t, this.vectorPool[i]);
    }

    const positions = this.geometry.attributes.position.array as Float32Array;
    const normals = this.geometry.attributes.normal.array as Float32Array;
    const uvs = this.geometry.attributes.uv.array as Float32Array;
    const ribbonHalfWidth = 1.8;

    // Buffer-Relative UV Scaling: Anchors gradient physically without stretching
    const capacityRatio = totalPoints / maxCapacity;
    const tailOffset = Math.max(0.0, 1.0 - capacityRatio);

    for (let i = 0; i < totalPoints; i++) {
      const current = this.vectorPool[i];

      // Tangent calculation using hoisted working vector
      if (i < totalPoints - 1) {
        this._workingTangent.subVectors(this.vectorPool[i + 1], current);
      } else {
        this._workingTangent.subVectors(current, this.vectorPool[i - 1]);
      }

      // ── Defend against Co-Located Coordinate Collapse (Zero-Distance NaN) ─
      if (this._workingTangent.lengthSq() < 0.00001) {
        this._workingTangent.set(1, 0, 0);
      } else {
        this._workingTangent.normalize();
      }

      // ── Dynamic Up-Vector Fallback to Prevent Gimbal Lock NaN Crashes ──
      if (Math.abs(this._workingTangent.y) > 0.99) {
        this._workingUp.set(0, 0, 1);
      } else {
        this._workingUp.set(0, 1, 0);
      }

      this._workingSide.crossVectors(this._workingTangent, this._workingUp).normalize().multiplyScalar(ribbonHalfWidth);

      const idx = i * 6;
      positions[idx + 0] = current.x - this._workingSide.x;
      positions[idx + 1] = current.y;
      positions[idx + 2] = current.z - this._workingSide.z;
      positions[idx + 3] = current.x + this._workingSide.x;
      positions[idx + 4] = current.y;
      positions[idx + 5] = current.z + this._workingSide.z;

      normals[idx + 0] = 0; normals[idx + 1] = 1; normals[idx + 2] = 0;
      normals[idx + 3] = 0; normals[idx + 4] = 1; normals[idx + 5] = 0;

      // Anchored Gradient Progress (Head is ALWAYS 1.0)
      const progress = tailOffset + (i / Math.max(1, totalPoints - 1)) * (1.0 - tailOffset);
      uvs[i * 4 + 0] = 0.0; uvs[i * 4 + 1] = progress;
      uvs[i * 4 + 2] = 1.0; uvs[i * 4 + 3] = progress;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.setDrawRange(0, (totalPoints - 1) * 6);
  }

  public getHistory(): THREE.Vector3[] {
    return [...this.rawWaypoints];
  }

  public loadFromHistory(points: THREE.Vector3[]): void {
    this.clear();
    for (let i = 0; i < points.length; i++) {
      this.addStep(`Step #${i}`, i, points[i]);
    }
  }

  public update(deltaTime: number): void {
    this.material.uniforms.u_time.value += deltaTime;
  }

  public clear(): void {
    this.rawWaypoints = [];
    this.cachedCurve.points = [];
    this.geometry.setDrawRange(0, 0);
    this.material.uniforms.u_has_anomaly.value = 0.0;
    const posAttr = this.geometry.getAttribute('position');
    if (posAttr) posAttr.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
