/* ─────────────────────────────────────────────────────────────────────
 * shaders.ts — Cartographic Shaders with Hypsometric Relief & Isobar Contours
 * Dynamic Thermodynamic Peak Displacement & Topographic LoD
 * The Token Cosmos // AI Navigation Atlas
 * ───────────────────────────────────────────────────────────────────── */

export const terrainVertexShader = `
uniform float time;
uniform sampler2D probabilityTexture;
uniform float maxHeight;
uniform float textureSize;
uniform float greedyAnchorIndex;
uniform float uTemperature;
uniform float uMaxProb;
uniform float uMinP;

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
varying float vViewDistance;

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

    // ─── 1. Base Cartographic Continents (Hypsometric Relief) ───────────
    float geoHills = exp(-dot(umapCoord - vec2(0.45, 0.45), umapCoord - vec2(0.45, 0.45)) / 0.35) * 12.0;
    float verbHills = exp(-dot(umapCoord - vec2(-0.50, 0.15), umapCoord - vec2(-0.50, 0.15)) / 0.35) * 10.0;
    float codeHills = exp(-dot(umapCoord - vec2(0.55, -0.25), umapCoord - vec2(0.55, -0.25)) / 0.30) * 8.0;
    float syntaxPlain = exp(-dot(umapCoord - vec2(0.0, -0.60), umapCoord - vec2(0.0, -0.60)) / 0.30) * 4.0;
    float coreSpire = exp(-dot(umapCoord, umapCoord) / 0.08) * 15.0;

    float baseTopography = geoHills + verbHills + codeHills + syntaxPlain + coreSpire;

    // ─── 2. Zero-Safe Clamped Thermodynamic Peak Displacement ────────────
    // Normalizing relative probability (P_i / P_max) anchors the active summit to maxHeight
    float safeMaxProb = max(uMaxProb, 1e-7);
    float safeProbRatio = max(activeProb / safeMaxProb, 1e-7);
    float safeTemp = max(uTemperature, 0.01);
    
    // Thermal Weather:
    // As T -> 0.05 (Glacial freeze): summits sharpen into razor-sharp needle peaks
    // As T -> 2.0 (Thermal erosion): peaks melt and collapse into diffuse plains
    float activeSummit = (activeProb > 0.0001) ? (maxHeight * pow(safeProbRatio, 1.0 / safeTemp)) : 0.0;
    
    float totalElevation = baseTopography + activeSummit;
    vElevation = totalElevation;

    // ─── 3. Biome Landmass Color Palettes ────────────────────────────────
    vec3 colGeo = vec3(0.96, 0.62, 0.04);     // Terracotta / Amber (Entities & Geography)
    vec3 colVerb = vec3(0.51, 0.55, 0.97);    // Indigo / Cobalt (Abstract Concepts & Verbs)
    vec3 colCode = vec3(0.02, 0.71, 0.83);    // Cyan / Emerald (Numerics & Code Logic)
    vec3 colSyntax = vec3(0.39, 0.45, 0.55);  // Basalt Slate (Syntax & Structure Basin)
    vec3 colCore = vec3(0.89, 0.91, 0.94);    // Platinum White (Core Grammar Caldera)

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

    float viewDist = -mvPosition.z;
    vViewDistance = viewDist;

    // ─── 4. Level of Detail (LoD) Altitude Scaling ──────────────────────
    float lodScale = mix(1.6, 0.85, smoothstep(80.0, 450.0, viewDist));
    float minSize = 3.2 * lodScale;
    float maxSize = 19.0 * lodScale;
    
    float probability = max(activeProb, baseProb);
    float activeSize = mix(minSize, maxSize, probability);
    
    float ragSize = isRagGrounded * 9.0;
    float anchorSize = vIsGreedyAnchor * 16.0; // Radiant Summit Beacon for Greedy Target #1
    
    gl_PointSize = (activeSize + ragSize + anchorSize) * (340.0 / max(10.0, viewDist));
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
varying float vViewDistance;

void main() {
    // Soft circular particle with anti-aliased edge
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    // Cartographic Status Palette
    vec3 candidateColor = vec3(0.85, 0.27, 0.94);  // Candidate Ridge Magenta (#D946EF)
    vec3 winnerColor = vec3(0.06, 0.72, 0.51);     // Selected Route Emerald (#10B981)
    vec3 ragLighthouseColor = vec3(0.02, 0.71, 0.83); // Grounding Lighthouse Cyan (#06B6D4)
    vec3 ghostColor = vec3(0.25, 0.45, 0.65);      // Comparative Ghost Trail

    // ─── 1. Topographic Hypsometric Contour Rings ────────────────────────
    float majorIsobar = fract(vElevation / 5.0);
    float minorIsobar = fract(vElevation / 1.5);
    float isobarMaskMajor = smoothstep(0.84, 0.98, majorIsobar);
    float isobarMaskMinor = smoothstep(0.90, 0.98, minorIsobar) * 0.45;
    float totalIsobar = max(isobarMaskMajor, isobarMaskMinor);

    // ─── 2. Biome-Aware Relief Color Mapping ────────────────────────────
    vec3 idleColor = mix(vBiomeColor * 0.42, vBiomeColor * 0.92, smoothstep(0.0, 18.0, vElevation));
    
    // Active candidates transition from Biome color -> Magenta -> Emerald
    vec3 activeCol = mix(idleColor, candidateColor, smoothstep(0.004, 0.10, vActiveProb));
    vec3 color = mix(activeCol, winnerColor, smoothstep(0.18, 1.0, vActiveProb));

    // Topographic contour glow overlay
    color = mix(color, color + vec3(0.40, 0.45, 0.65), totalIsobar * 0.60);

    // Subterranean Reasoning Caverns Pulse (<think> tokens)
    if (uIsThinking > 0.5) {
        vec3 thinkColor = mix(vec3(0.95, 0.55, 0.1), vec3(0.65, 0.25, 0.95), (sin(time * 3.0) + 1.0) * 0.5);
        color = mix(color, thinkColor, 0.60);
    }

    // RAG Magnetic Lighthouse Anchors (HDR Intensity for Bloom)
    if (vIsRagGrounded > 0.5) {
        color = mix(color, ragLighthouseColor * 6.5, 0.85);
    }

    // Top Selected Token (Peak Summit Beacon)
    if (vIsGreedyAnchor > 0.5) {
        color = vec3(12.0, 12.0, 12.0); // Ultra-bright summit lighthouse
    }

    // Comparative Model Divergence Diffing
    float probDelta = vActiveProb - vBaseProb;
    if (probDelta < -0.01) {
        color = mix(color, ghostColor, smoothstep(0.0, 0.5, -probDelta));
    }

    // ─── 3. Cartographic Boundary Falloff & Alpha Density ───────────────
    float distFromCenter = length(vUmapCoord);
    float perimeterFade = smoothstep(1.30, 0.30, distFromCenter);

    // LoD density profile: smoother falloff at distance
    float densityProfile = (vViewDistance > 240.0) ? exp(-r * 2.5) : (1.0 - r);
    
    float baseAlpha = 0.22 * perimeterFade;
    float activeAlpha = smoothstep(0.001, 1.0, max(vActiveProb, vBaseProb)) * 0.78;
    float alpha = (baseAlpha + activeAlpha) * densityProfile;
    
    if (probDelta < -0.01) {
        alpha *= 0.5;
    }

    if (vIsGreedyAnchor > 0.5) {
        alpha = 1.0;
    }

    gl_FragColor = vec4(color, alpha);
}
`;
