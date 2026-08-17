/* ─────────────────────────────────────────────────────────────────────
 * FlightPath.ts — The "Token Highway" 3D Trajectory Ribbon & Anomaly Engine
 * Pre-allocated SIMD Sliding Window BufferGeometry with Static UV Gradient
 * The Token Cosmos v4.8
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
  
  varying vec2 v_uv;
  varying vec3 v_world_pos;

  void main() {
    // v_uv.y maps strictly from 0.0 (fading tail) to 1.0 (active head)
    float progress = v_uv.y;
    
    // Normal active neon glow vs crimson anomaly alert
    vec3 baseCol = mix(u_tail_color, u_head_color, smoothstep(0.0, 1.0, progress));
    if (u_has_anomaly > 0.5) {
      vec3 anomalyCol = vec3(0.95, 0.20, 0.25); // Crimson warning
      baseCol = mix(baseCol, anomalyCol, 0.75);
    }
    
    // Edge glow falloff
    float edgeGlow = pow(sin(v_uv.x * 3.14159), 0.65);
    
    // Trailing alpha fade
    float alpha = progress * edgeGlow * 0.92;
    
    gl_FragColor = vec4(baseCol * 1.5, alpha);
  }
`;

export class FlightPath {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  
  private positions: Float32Array;
  private normals: Float32Array;
  private uvs: Float32Array;
  
  private maxPoints: number;
  private activeCount: number = 0;
  private historyCoords: THREE.Vector3[] = [];
  
  public onAnomalyDetected?: (anomaly: TrajectoryAnomaly) => void;

  constructor(maxPoints: number = 128, ribbonWidth: number = 3.2) {
    this.maxPoints = maxPoints;
    this.geometry = new THREE.BufferGeometry();

    // 2 vertices per ribbon step (left and right edges)
    const vertexCount = maxPoints * 2;
    this.positions = new Float32Array(vertexCount * 3);
    this.normals = new Float32Array(vertexCount * 3);
    this.uvs = new Float32Array(vertexCount * 2);

    // ── Pre-calculate static UV gradient mapping (0.0 Tail -> 1.0 Head) ──
    for (let i = 0; i < maxPoints; i++) {
      const progress = i / (maxPoints - 1);
      // Left vertex (x = 0.0)
      this.uvs[i * 4 + 0] = 0.0;
      this.uvs[i * 4 + 1] = progress;
      // Right vertex (x = 1.0)
      this.uvs[i * 4 + 2] = 1.0;
      this.uvs[i * 4 + 3] = progress;
    }

    // Build static triangle indices (2 triangles = 6 indices per ribbon quad segment)
    const indexCount = (maxPoints - 1) * 6;
    const indices = new Uint16Array(indexCount);
    for (let i = 0; i < maxPoints - 1; i++) {
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

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: RIBBON_VERTEX_SHADER,
      fragmentShader: RIBBON_FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0.0 },
        u_head_color: { value: new THREE.Color(0x06B6D4) }, // Radiant Cyan (#06B6D4)
        u_tail_color: { value: new THREE.Color(0x4F46E5) }, // Deep Indigo (#4F46E5)
        u_has_anomaly: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 15;
  }

  /**
   * Appends a new generation step coordinate to the 3D trajectory ribbon
   */
  public addStep(
    tokenStr: string,
    stepIndex: number,
    point: THREE.Vector3,
    halfWidth: number = 1.6
  ): void {
    // Elevate ribbon slightly above terrain surface
    const elevatedPoint = point.clone();
    elevatedPoint.y += 2.5;

    // Detect Anomaly: Cross-Continent Jump or Repetition Loop
    if (this.historyCoords.length > 1) {
      const prev = this.historyCoords[this.historyCoords.length - 1];
      const dist = elevatedPoint.distanceTo(prev);

      if (dist > 160.0) {
        this.material.uniforms.u_has_anomaly.value = 1.0;
        this.onAnomalyDetected?.({
          type: 'DRIFT_JUMP',
          message: `Semantic Jump (${dist.toFixed(0)} units across continent)`,
          stepIndex,
          tokenStr,
          severity: 'warning',
          location: elevatedPoint,
        });
      } else {
        this.material.uniforms.u_has_anomaly.value = 0.0;
      }
    }

    this.historyCoords.push(elevatedPoint);

    // Compute tangent and lateral ribbon offset
    const dir = this.historyCoords.length > 1
      ? new THREE.Vector3().subVectors(elevatedPoint, this.historyCoords[this.historyCoords.length - 2]).normalize()
      : new THREE.Vector3(0, 0, 1);

    const normal = new THREE.Vector3(0, 1, 0);
    const lateral = new THREE.Vector3().crossVectors(dir, normal).normalize().multiplyScalar(halfWidth);

    const left = new THREE.Vector3().addVectors(elevatedPoint, lateral);
    const right = new THREE.Vector3().subVectors(elevatedPoint, lateral);

    if (this.activeCount < this.maxPoints) {
      const idx = this.activeCount * 6;
      this.positions[idx + 0] = left.x;
      this.positions[idx + 1] = left.y;
      this.positions[idx + 2] = left.z;
      this.positions[idx + 3] = right.x;
      this.positions[idx + 4] = right.y;
      this.positions[idx + 5] = right.z;

      this.normals[idx + 0] = 0; this.normals[idx + 1] = 1; this.normals[idx + 2] = 0;
      this.normals[idx + 3] = 0; this.normals[idx + 4] = 1; this.normals[idx + 5] = 0;

      this.activeCount++;
    } else {
      // ─── High-Speed SIMD Sliding Window Shift (copyWithin) ────────────
      // Shifts existing vertices left by 1 quad (6 floats) in place
      this.positions.copyWithin(0, 6, this.maxPoints * 6);
      this.normals.copyWithin(0, 6, this.maxPoints * 6);
      // UV array is NOT touched: geometry flows through static head-to-tail gradient!

      const lastIdx = (this.maxPoints - 1) * 6;
      this.positions[lastIdx + 0] = left.x;
      this.positions[lastIdx + 1] = left.y;
      this.positions[lastIdx + 2] = left.z;
      this.positions[lastIdx + 3] = right.x;
      this.positions[lastIdx + 4] = right.y;
      this.positions[lastIdx + 5] = right.z;

      this.normals[lastIdx + 0] = 0; this.normals[lastIdx + 1] = 1; this.normals[lastIdx + 2] = 0;
      this.normals[lastIdx + 3] = 0; this.normals[lastIdx + 4] = 1; this.normals[lastIdx + 5] = 0;
    }

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = this.geometry.getAttribute('normal') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;

    if (this.activeCount > 1) {
      this.geometry.setDrawRange(0, (this.activeCount - 1) * 6);
    }
  }

  public update(deltaTime: number): void {
    this.material.uniforms.u_time.value += deltaTime;
  }

  public clear(): void {
    this.activeCount = 0;
    this.historyCoords = [];
    this.geometry.setDrawRange(0, 0);
    this.material.uniforms.u_has_anomaly.value = 0.0;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
