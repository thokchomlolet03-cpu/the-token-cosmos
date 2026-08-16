/* ─────────────────────────────────────────────────────────────────────
 * shaders.ts — Cartographic Shaders with Hypsometric Relief & Isobars
 * The Token Cosmos v4.2
 * ───────────────────────────────────────────────────────────────────── */

export const terrainVertexShader = `
uniform float time;
uniform sampler2D probabilityTexture;
uniform float maxHeight;
uniform float textureSize;
uniform float greedyAnchorIndex;

attribute vec2 umapCoord;
attribute float tokenIndex;
attribute float isRagGrounded;

varying vec2 vUmapCoord;
varying float vActiveProb;
varying float vBaseProb;
varying float vTokenIndex;
varying float vIsRagGrounded;
varying float vIsGreedyAnchor;
varying float vElevation;
varying vec3 vBiomeColor;

void main() {
    vUmapCoord = umapCoord;
    vTokenIndex = tokenIndex;
    vIsRagGrounded = isRagGrounded;
    vIsGreedyAnchor = (tokenIndex == greedyAnchorIndex) ? 1.0 : 0.0;

    // Calculate UV for the DataTexture
    float texSize = textureSize;
    vec2 texUV = vec2(
        (mod(tokenIndex, texSize) + 0.5) / texSize,
        (floor(tokenIndex / texSize) + 0.5) / texSize
    );

    vec4 probs = texture2D(probabilityTexture, texUV);
    float activeProb = probs.r;
    float baseProb = probs.g;
    
    vActiveProb = activeProb;
    vBaseProb = baseProb;

    // ─── 1. Base Cartographic Topography (Permanent Hypsometric Relief) ──
    // Compute mountain plateaus and valleys from semantic cluster centers
    float geoHills = exp(-dot(umapCoord - vec2(0.45, 0.45), umapCoord - vec2(0.45, 0.45)) / 0.35) * 12.0;
    float verbHills = exp(-dot(umapCoord - vec2(-0.50, 0.15), umapCoord - vec2(-0.50, 0.15)) / 0.35) * 10.0;
    float codeHills = exp(-dot(umapCoord - vec2(0.55, -0.25), umapCoord - vec2(0.55, -0.25)) / 0.30) * 8.0;
    float syntaxPlain = exp(-dot(umapCoord - vec2(0.0, -0.60), umapCoord - vec2(0.0, -0.60)) / 0.30) * 4.0;
    float coreSpire = exp(-dot(umapCoord, umapCoord) / 0.08) * 15.0;

    float baseTopography = geoHills + verbHills + codeHills + syntaxPlain + coreSpire;

    // ─── 2. Dynamic Active Peak (Logit Probability Mass) ────────────────
    float activeSummit = smoothstep(0.001, 0.08, activeProb) * (maxHeight * 0.25) + 
                         smoothstep(0.08, 1.0, activeProb) * (maxHeight * 0.75);
    
    float totalElevation = baseTopography + activeSummit;
    vElevation = totalElevation;

    // ─── 3. Biome Color Allocation ──────────────────────────────────────
    vec3 colGeo = vec3(0.96, 0.62, 0.04);     // Terracotta / Amber (#F59E0B)
    vec3 colVerb = vec3(0.51, 0.55, 0.97);    // Indigo / Cobalt (#818CF8)
    vec3 colCode = vec3(0.02, 0.71, 0.83);    // Cyan / Emerald (#06B6D4)
    vec3 colSyntax = vec3(0.39, 0.45, 0.55);  // Basalt Slate (#64748B)
    vec3 colCore = vec3(0.89, 0.91, 0.94);    // Platinum White (#E2E8F0)

    float totalWeight = geoHills + verbHills + codeHills + syntaxPlain + coreSpire + 0.001;
    vec3 blendedBiome = (colGeo * geoHills + 
                         colVerb * verbHills + 
                         colCode * codeHills + 
                         colSyntax * syntaxPlain + 
                         colCore * coreSpire) / totalWeight;

    vBiomeColor = blendedBiome;

    // Landscape bounds in 3D world coordinates
    float spread = 250.0;
    vec3 pos = vec3(umapCoord.x * spread, totalElevation, umapCoord.y * spread);
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Dynamic point sizing locked to individual probability & distance
    float minSize = 2.5;
    float maxSize = 16.0;
    float probability = max(activeProb, baseProb);
    float activeSize = mix(minSize, maxSize, probability);
    
    float ragSize = isRagGrounded * 7.0;
    float anchorSize = vIsGreedyAnchor * 12.0; // Extra size boost for greedy anchor #1
    
    // Attenuate with distance
    gl_PointSize = (activeSize + ragSize + anchorSize) * (320.0 / -mvPosition.z);
}
`;

export const terrainFragmentShader = `
uniform float time;
uniform float uIsThinking;

varying vec2 vUmapCoord;
varying float vActiveProb;
varying float vBaseProb;
varying float vTokenIndex;
varying float vIsRagGrounded;
varying float vIsGreedyAnchor;
varying float vElevation;
varying vec3 vBiomeColor;

void main() {
    // Soft circular particle
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    // Status Colors
    vec3 candidateColor = vec3(0.95, 0.35, 0.95);  // Magenta (#D946EF)
    vec3 winnerColor = vec3(0.06, 0.85, 0.55);     // Emerald (#10B981)
    vec3 ragColor = vec3(0.23, 0.65, 1.0);         // Laser Blue (#3B82F6)
    vec3 ghostColor = vec3(0.15, 0.40, 0.55);      // Ghost Blue

    // ─── 1. Topographic Isobar Contour Rings ───────────────────────────
    float isobarSpacing = 3.5; // Isobar ring every 3.5 units of elevation
    float isobarPhase = fract(vElevation / isobarSpacing);
    float isobarMask = smoothstep(0.82, 0.98, isobarPhase);

    // ─── 2. Biome-Aware Base Color Mapping ──────────────────────────────
    // Idle/background points inherit their semantic continent color tint
    vec3 idleColor = mix(vBiomeColor * 0.45, vBiomeColor * 0.85, smoothstep(0.0, 15.0, vElevation));
    
    // Active candidates transition from Biome color -> Magenta -> Emerald
    vec3 activeCol = mix(idleColor, candidateColor, smoothstep(0.005, 0.12, vActiveProb));
    vec3 color = mix(activeCol, winnerColor, smoothstep(0.20, 1.0, vActiveProb));

    // ─── 3. Isobar Contour Glow ─────────────────────────────────────────
    color = mix(color, color + vec3(0.3, 0.3, 0.45), isobarMask * 0.45);

    // Reasoning Pulse
    if (uIsThinking > 0.5) {
        vec3 thinkColor = mix(vec3(0.95, 0.55, 0.1), vec3(0.65, 0.25, 0.95), (sin(time * 3.0) + 1.0) * 0.5);
        color = mix(color, thinkColor, 0.55);
    }

    // Celestial Anchors overrides (HDR Intensity for Bloom)
    if (vIsRagGrounded > 0.5) {
        color = mix(color, ragColor * 8.0, 0.85);
    }

    if (vIsGreedyAnchor > 0.5) {
        color = vec3(12.0, 12.0, 12.0); // Bright radiant beacon for Greedy Target #1
    }

    // Ghost Shell Diffing logic
    float probDelta = vActiveProb - vBaseProb;
    if (probDelta < -0.01) {
        color = mix(color, ghostColor, smoothstep(0.0, 0.5, -probDelta));
    }

    // ─── 4. Alpha Intensity & Distance Attenuation ──────────────────────
    float distFromCenter = length(vUmapCoord);
    float perimeterFade = smoothstep(1.2, 0.4, distFromCenter); // Smooth radial fade

    float baseAlpha = 0.35 * perimeterFade;
    float activeAlpha = smoothstep(0.001, 1.0, max(vActiveProb, vBaseProb)) * 0.75;
    float alpha = baseAlpha + activeAlpha;
    
    if (probDelta < -0.01) {
        alpha *= 0.5;
    }

    if (vIsGreedyAnchor > 0.5) {
        alpha = 1.0;
    }

    // Circular point particle edge fade
    alpha *= (1.0 - r);

    gl_FragColor = vec4(color, alpha);
}
`;
