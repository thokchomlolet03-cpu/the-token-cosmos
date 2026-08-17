/* ─────────────────────────────────────────────────────────────────────
 * WaterPlane.ts — The "Min-P Tides" Volumetric 3D Waterplane
 * Renders a translucent, caustic-animated water surface dynamically
 * positioned at the thermodynamic Min-P cutoff elevation.
 * The Token Cosmos v4.8
 * ───────────────────────────────────────────────────────────────────── */

import * as THREE from 'three';

const WATER_VERTEX_SHADER = `
  uniform float u_time;
  uniform float u_water_elevation;
  
  varying vec2 v_uv;
  varying vec3 v_world_pos;
  varying float v_wave_height;

  void main() {
    v_uv = uv;
    
    // Multi-frequency undulating surface waves
    vec3 pos = position;
    float wave1 = sin(pos.x * 0.06 + u_time * 1.8) * cos(pos.z * 0.06 + u_time * 1.4) * 0.45;
    float wave2 = sin(pos.x * 0.12 - u_time * 2.2 + pos.z * 0.08) * 0.25;
    float totalWave = wave1 + wave2;
    
    pos.y = u_water_elevation + totalWave;
    v_wave_height = totalWave;
    
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    v_world_pos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const WATER_FRAGMENT_SHADER = `
  uniform float u_time;
  uniform vec3 u_deep_color;
  uniform vec3 u_shallow_color;
  uniform float u_opacity;
  
  varying vec2 v_uv;
  varying vec3 v_world_pos;
  varying float v_wave_height;

  // Procedural 2D caustic cellular pattern
  float causticNoise(vec2 uv, float t) {
    vec2 p = uv * 14.0;
    float c1 = sin(p.x + sin(p.y + t * 1.5)) * 0.5 + 0.5;
    float c2 = cos(p.y + cos(p.x + t * 1.2)) * 0.5 + 0.5;
    return pow(c1 * c2, 1.8) * 1.6;
  }

  void main() {
    float caustics = causticNoise(v_uv, u_time * 0.8);
    
    // Blend deep abyss with shallow illuminated turquoise
    vec3 baseColor = mix(u_deep_color, u_shallow_color, clamp(v_wave_height * 0.8 + 0.5, 0.0, 1.0));
    vec3 finalColor = baseColor + vec3(0.08, 0.25, 0.35) * caustics;
    
    // Subtle distance fog fade
    float dist = length(v_world_pos.xz);
    float alpha = u_opacity * smoothstep(180.0, 60.0, dist);
    
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export class WaterPlane {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private currentElevation: number = 0.0;
  private targetElevation: number = 0.0;

  constructor(size: number = 340, segments: number = 64) {
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2); // Orient horizontally along XZ plane

    this.material = new THREE.ShaderMaterial({
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0.0 },
        u_water_elevation: { value: 0.0 },
        u_deep_color: { value: new THREE.Color(0x021B2B) }, // Deep navy abyss
        u_shallow_color: { value: new THREE.Color(0x06B6D4) }, // Illuminated cyan
        u_opacity: { value: 0.52 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = 0.0;
    this.mesh.renderOrder = 10; // Render after opaque terrain
  }

  /**
   * Sets the target water elevation based on thermodynamic Min-P math:
   * y_water = shelf_height + beta * (safe_min_p)^(1/T)
   */
  public setElevation(elevation: number, immediate: boolean = false): void {
    this.targetElevation = elevation;
    if (immediate) {
      this.currentElevation = elevation;
      this.material.uniforms.u_water_elevation.value = elevation;
    }
  }

  public update(deltaTime: number): void {
    this.material.uniforms.u_time.value += deltaTime;
    
    // Smooth exponential damping toward target elevation to prevent abrupt snaps
    this.currentElevation += (this.targetElevation - this.currentElevation) * Math.min(1.0, deltaTime * 8.0);
    this.material.uniforms.u_water_elevation.value = this.currentElevation;
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
