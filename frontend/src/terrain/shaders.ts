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

void main() {
    vUmapCoord = umapCoord;
    vTokenIndex = tokenIndex;
    vIsRagGrounded = isRagGrounded;
    vIsGreedyAnchor = (tokenIndex == greedyAnchorIndex) ? 1.0 : 0.0;

    // Calculate UV for the DataTexture
    float texSize = textureSize;
    // adding 0.5 to center the sampling in the pixel
    vec2 texUV = vec2(
        (mod(tokenIndex, texSize) + 0.5) / texSize,
        (floor(tokenIndex / texSize) + 0.5) / texSize
    );

    vec4 probs = texture2D(probabilityTexture, texUV);
    float activeProb = probs.r;
    float baseProb = probs.g;
    
    vActiveProb = activeProb;
    vBaseProb = baseProb;

    // Landscape bounds
    float spread = 250.0;
    
    // Smooth easing for height
    float elevation = smoothstep(0.001, 0.1, activeProb) * (maxHeight * 0.3) + 
                      smoothstep(0.1, 1.0, activeProb) * (maxHeight * 0.7);
    
    vElevation = elevation;

    // Ghost shell (base probability) influences height minimally here, 
    // it's mostly handled in the fragment shader by comparing vActiveProb vs vBaseProb.

    vec3 pos = vec3(umapCoord.x * spread, elevation, umapCoord.y * spread);
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Dynamic point sizing
    float baseSize = 1.0;
    float activeSize = smoothstep(0.01, 1.0, max(activeProb, baseProb)) * 12.0;
    float ragSize = isRagGrounded * 8.0;
    float anchorSize = vIsGreedyAnchor * 20.0; // Huge pillar for the north star
    
    // Attenuate with distance
    gl_PointSize = (baseSize + activeSize + ragSize + anchorSize) * (300.0 / -mvPosition.z);
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

void main() {
    // Soft circular particle
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;

    // Colors
    vec3 fringeColor = vec3(0.2, 0.2, 0.22);       // #333338
    vec3 candidateColor = vec3(0.85, 0.27, 0.94);  // #D946EF (Magenta)
    vec3 winnerColor = vec3(0.06, 0.72, 0.51);     // #10B981 (Emerald)
    vec3 ragColor = vec3(0.23, 0.51, 0.96);        // #3B82F6 (Blue)
    vec3 ghostColor = vec3(0.1, 0.3, 0.4);         // Ghostly blue-grey for lowered probability

    // Topographic Contour Lines
    // Using a step function on fract(elevation) to draw thin lines
    float contourFrequency = 1.0; // Lines every 1.0 units of elevation
    float contourWidth = 0.15;
    float contourMask = smoothstep(1.0 - contourWidth, 1.0, fract(vElevation * contourFrequency));
    
    // Base color mapping
    vec3 baseCol = mix(fringeColor, candidateColor, smoothstep(0.005, 0.1, vActiveProb));
    vec3 color = mix(baseCol, winnerColor, smoothstep(0.2, 1.0, vActiveProb));

    // Reasoning Tint (High Entropy pulsing amber/purple)
    if (uIsThinking > 0.5) {
        vec3 thinkColor = mix(vec3(0.9, 0.5, 0.1), vec3(0.6, 0.2, 0.9), (sin(time * 3.0) + 1.0) * 0.5);
        color = mix(color, thinkColor, 0.6);
    }

    // Add contour overlay (slightly brighter than the base color)
    color = mix(color, color * 1.5, contourMask * 0.4);

    // Celestial Anchors overrides (HDR Intensity for Bloom)
    if (vIsRagGrounded > 0.5) {
        color = mix(color, ragColor * 10.0, 0.8);
    }

    if (vIsGreedyAnchor > 0.5) {
        color = vec3(10.0, 10.0, 10.0); // Bright pillar of light for the Greedy Anchor (HDR)
    }

    // Ghost Shell Diffing logic
    float probDelta = vActiveProb - vBaseProb;
    // If probability dropped (Ghost Shell)
    if (probDelta < -0.01) {
        color = mix(color, ghostColor, smoothstep(0.0, 0.5, -probDelta));
    }

    // Alpha intensity
    float baseAlpha = 0.1;
    float activeAlpha = smoothstep(0.001, 1.0, max(vActiveProb, vBaseProb)) * 0.8;
    float alpha = baseAlpha + activeAlpha;
    
    // Ghost shell makes it more transparent
    if (probDelta < -0.01) {
        alpha *= 0.5;
    }

    if (vIsGreedyAnchor > 0.5) {
        alpha = 1.0;
    }

    // Radial gradient fade
    alpha *= (1.0 - r);

    gl_FragColor = vec4(color, alpha);
}
`;
