import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { terrainVertexShader, terrainFragmentShader } from '../terrain/shaders';
import { useTerrainCoordinates } from '../terrain/useTerrainCoordinates';
import { SamplingParameters, ProcessedTokenCandidate } from '../types/sampling';

interface TerrainCanvasProps {
  modelId: string | null;
  latestLogits: Float32Array | null;
  params: SamplingParameters;
  ragTokenIds?: number[];
  isThinking?: boolean;
  candidates?: ProcessedTokenCandidate[];
}

export const TerrainCanvas: React.FC<TerrainCanvasProps> = ({ 
  modelId, 
  latestLogits, 
  params, 
  ragTokenIds = [], 
  isThinking = false,
  candidates = [],
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const argmaxIndexRef = useRef<number>(-1);
  
  const [hoveredToken, setHoveredToken] = useState<{
    id: number;
    tokenStr: string;
    probability: number;
    rank: number;
    rawLogit: number;
    isFiltered: boolean;
    filterReason?: string;
    isRag?: boolean;
    x: number;
    y: number;
  } | null>(null);

  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);
  
  const { isLoaded, loadedModelId, vocabSize, rawCoordinates, loadForModel } = useTerrainCoordinates();

  useEffect(() => {
    // If no model is selected (sample data mode), load a fallback "sample" terrain
    // so the canvas isn't stuck on "Loading Terrain Coordinates..." forever.
    const targetId = modelId || '__SAMPLE_FALLBACK__';
    if (loadedModelId !== targetId) {
      loadForModel(targetId);
    }
  }, [modelId, loadedModelId, loadForModel]);

  // Initialization
  useEffect(() => {
    if (!containerRef.current || !isLoaded || !rawCoordinates) return;

    // Set up scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);
    scene.fog = new THREE.FogExp2(0x050714, 0.002);
    sceneRef.current = scene;

    // Set up camera
    const camera = new THREE.PerspectiveCamera(60, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(0, 150, 250);
    cameraRef.current = camera;

    // Set up renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // Antialiasing can conflict with EffectComposer in some cases
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio for performance
    
    // Enable HDR Tone Mapping
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Set up Post-Processing Composer (Selective Bloom via HDR)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(containerRef.current.clientWidth, containerRef.current.clientHeight),
        1.5,   // bloom strength
        0.4,   // bloom radius
        1.0    // bloom threshold (only blooms pixels > 1.0)
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 600;
    controls.minDistance = 10;
    controls.maxPolarAngle = Math.PI / 2 + 0.2; // allow slightly below horizon
    controlsRef.current = controls;

    // ─── Geometry ───
    const geometry = new THREE.BufferGeometry();
    
    // Position (x,y,z) — set coordinates on CPU so Raycaster works correctly
    const positions = new Float32Array(vocabSize * 3);
    const tokenIndices = new Float32Array(vocabSize);
    const isRagGrounded = new Float32Array(vocabSize);
    const spread = 250.0;

    for (let i = 0; i < vocabSize; i++) {
        positions[i * 3] = rawCoordinates[i * 2] * spread;
        positions[i * 3 + 1] = 0.0;
        positions[i * 3 + 2] = rawCoordinates[i * 2 + 1] * spread;
        
        tokenIndices[i] = i;
        isRagGrounded[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('umapCoord', new THREE.BufferAttribute(rawCoordinates, 2));
    geometry.setAttribute('tokenIndex', new THREE.BufferAttribute(tokenIndices, 1));
    geometry.setAttribute('isRagGrounded', new THREE.BufferAttribute(isRagGrounded, 1));

    // ─── Texture ───
    // Calculate square texture size
    const texSize = Math.ceil(Math.sqrt(vocabSize));
    const dataSize = texSize * texSize;
    // RGFormat uses 2 floats per pixel: R = active prob, G = base prob
    const probabilityData = new Float32Array(dataSize * 2);
    // Initialize with visible base probability so terrain geography is
    // visible as a dim ground-level landscape before the first logit pass.
    for(let i=0; i<probabilityData.length; i+=2) {
        probabilityData[i] = 0.005;   // R — active (visible ground level)
        probabilityData[i+1] = 0.005; // G — base
    }

    const probabilityTexture = new THREE.DataTexture(
        probabilityData,
        texSize,
        texSize,
        THREE.RGFormat,
        THREE.FloatType
    );
    probabilityTexture.needsUpdate = true;

    // ─── Material ───
    const uniforms = {
        time: { value: 0 },
        probabilityTexture: { value: probabilityTexture },
        maxHeight: { value: 150.0 },
        textureSize: { value: texSize },
        greedyAnchorIndex: { value: -1.0 },
        uIsThinking: { value: 0.0 }
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // Animation loop
    let animationFrameId: number;
    const startTime = performance.now();

    const render = () => {
        animationFrameId = requestAnimationFrame(render);
        controls.update();
        if (pointsRef.current) {
            (pointsRef.current.material as THREE.ShaderMaterial).uniforms.time.value = (performance.now() - startTime) / 1000;
        }
        
        // Handle manual Camera Interpolation (when user clicks [SPACE] button)
        if (targetFocusRef.current && controlsRef.current && cameraRef.current) {
            const controls = controlsRef.current;
            const cam = cameraRef.current;
            const targetPos = targetFocusRef.current.position;
            const targetLook = targetFocusRef.current.lookAt;
            
            // Interpolate camera position
            cam.position.lerp(targetPos, 0.05);
            // Interpolate controls target
            controls.target.lerp(targetLook, 0.05);
            
            // If close enough, release focus
            if (cam.position.distanceTo(targetPos) < 1.0 && controls.target.distanceTo(targetLook) < 1.0) {
                targetFocusRef.current = null;
            }
        }
        
        composer.render();
    };
    render();

    // Resize handler
    const handleResize = () => {
        if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        composerRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // ─── Raycast Mouse Move Listener ───
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 4.0; // Trigger selection radius
    const mouse = new THREE.Vector2();

    const onMouseMove = (event: MouseEvent) => {
        if (!containerRef.current || !cameraRef.current || !pointsRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(pointsRef.current);
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const idx = intersect.index;
            if (idx !== undefined && idx >= 0 && idx < vocabSize) {
                const material = pointsRef.current.material as THREE.ShaderMaterial;
                const texture = material.uniforms.probabilityTexture.value as THREE.DataTexture;
                const probData = texture.image.data as Float32Array;
                
                const activeProb = probData[idx * 2];
                const candidate = candidatesRef.current?.find(c => c.token_id === idx);
                
                const tooltipX = event.clientX - rect.left + 15;
                const tooltipY = event.clientY - rect.top + 15;
                
                if (candidate) {
                    setHoveredToken({
                        id: idx,
                        tokenStr: candidate.token_str,
                        probability: candidate.probability,
                        rank: candidate.rank,
                        rawLogit: candidate.raw_logit,
                        isFiltered: candidate.isFiltered,
                        filterReason: candidate.filterReason,
                        isRag: candidate.is_rag_grounded,
                        x: tooltipX,
                        y: tooltipY,
                    });
                } else {
                    setHoveredToken({
                        id: idx,
                        tokenStr: `Token #${idx}`,
                        probability: activeProb,
                        rank: -1,
                        rawLogit: -999.0,
                        isFiltered: true,
                        filterReason: 'Top-K (Fringe)',
                        isRag: false,
                        x: tooltipX,
                        y: tooltipY,
                    });
                }
                return;
            }
        }
        setHoveredToken(null);
    };

    const onMouseLeave = () => {
        setHoveredToken(null);
    };

    containerRef.current.addEventListener('mousemove', onMouseMove);
    containerRef.current.addEventListener('mouseleave', onMouseLeave);

    return () => {
        if (containerRef.current) {
            containerRef.current.removeEventListener('mousemove', onMouseMove);
            containerRef.current.removeEventListener('mouseleave', onMouseLeave);
        }
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
        controls.dispose();
        if (rendererRef.current) {
            rendererRef.current.dispose();
            if (containerRef.current?.contains(rendererRef.current.domElement)) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
        }
        geometry.dispose();
        material.dispose();
        probabilityTexture.dispose();
        composer.dispose();
    };
  }, [isLoaded, rawCoordinates, vocabSize]);

  // Target focus reference for interpolation
  const targetFocusRef = useRef<{position: THREE.Vector3, lookAt: THREE.Vector3} | null>(null);

  // Focus Camera on Greedy Anchor (manual)
  const focusOnGreedyAnchor = () => {
    if (argmaxIndexRef.current === -1 || !rawCoordinates || !controlsRef.current || !cameraRef.current) return;
    const x = rawCoordinates[argmaxIndexRef.current * 2];
    const y = rawCoordinates[argmaxIndexRef.current * 2 + 1];
    
    // Spread matches shaders
    const spread = 250.0;
    const targetLook = new THREE.Vector3(x * spread, 0, y * spread);
    const targetPos = new THREE.Vector3(targetLook.x, 50, targetLook.z + 80);
    
    targetFocusRef.current = { position: targetPos, lookAt: targetLook };
  };

  // Continuous Camera Tracking during Thinking Phase
  useEffect(() => {
    if (!isThinking || argmaxIndexRef.current === -1 || !rawCoordinates || !controlsRef.current || !cameraRef.current) return;
    
    let animationFrameId: number;
    const trackCamera = () => {
      const idx = argmaxIndexRef.current;
      if (idx !== -1 && controlsRef.current && cameraRef.current && rawCoordinates) {
        const x = rawCoordinates[idx * 2];
        const y = rawCoordinates[idx * 2 + 1];
        const spread = 250.0;
        const targetLook = new THREE.Vector3(x * spread, 0, y * spread);
        
        // Slow floaty ease interpolation (lerp 0.01)
        controlsRef.current.target.lerp(targetLook, 0.01);
      }
      animationFrameId = requestAnimationFrame(trackCamera);
    };
    
    trackCamera();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isThinking, rawCoordinates]);

  // Update RAG Grounding Buffer
  useEffect(() => {
    if (!pointsRef.current || !isLoaded) return;
    const geometry = pointsRef.current.geometry;
    const isRagAttr = geometry.getAttribute('isRagGrounded') as THREE.BufferAttribute;
    
    // Reset all to 0
    for(let i=0; i<isRagAttr.count; i++) {
        isRagAttr.setX(i, 0);
    }
    
    // Set RAG tokens to 1
    for(const tid of ragTokenIds) {
        if (tid >= 0 && tid < isRagAttr.count) {
            isRagAttr.setX(tid, 1);
        }
    }
    
    isRagAttr.needsUpdate = true;
  }, [ragTokenIds, isLoaded]);

  // Update DataTexture when logits or params change
  useEffect(() => {
    if (!latestLogits || !pointsRef.current || !isLoaded) return;
    
    const points = pointsRef.current;
    const material = points.material as THREE.ShaderMaterial;
    const texture = material.uniforms.probabilityTexture.value as THREE.DataTexture;
    const data = texture.image.data as Float32Array;
    
    // Convert logits to probabilities (Softmax)
    let maxLogit = -Infinity;
    let argmaxIndex = 0;
    const tokenCount = Math.min(latestLogits.length, vocabSize, data.length / 2);

    for (let i = 0; i < tokenCount; i++) {
        if (latestLogits[i] > maxLogit) {
            maxLogit = latestLogits[i];
            argmaxIndex = i;
        }
    }
    
    let sumExpActive = 0;
    let sumExpBase = 0;
    const temp = Math.max(params.temperature, 0.01);
    const baseTemp = 1.0; // Baseline temperature
    
    for (let i = 0; i < tokenCount; i++) {
        const valActive = Math.exp((latestLogits[i] - maxLogit) / temp);
        const valBase = Math.exp((latestLogits[i] - maxLogit) / baseTemp);
        
        data[i * 2] = valActive;
        data[i * 2 + 1] = valBase;
        
        sumExpActive += valActive;
        sumExpBase += valBase;
    }
    
    for (let i = 0; i < tokenCount; i++) {
        data[i * 2] /= sumExpActive;
        data[i * 2 + 1] /= sumExpBase;
    }
    
    // Update CPU position buffer to match elevation
    const positionsAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionsAttr.array as Float32Array;
    const maxHeight = 150.0;
    
    const smoothStep = (edge0: number, edge1: number, x: number) => {
      const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
      return t * t * (3.0 - 2.0 * t);
    };

    for (let i = 0; i < tokenCount; i++) {
        const activeProb = data[i * 2];
        const elevation = smoothStep(0.001, 0.1, activeProb) * (maxHeight * 0.3) + 
                          smoothStep(0.1, 1.0, activeProb) * (maxHeight * 0.7);
        
        positions[i * 3 + 1] = elevation; // Update Y coordinate
    }
    positionsAttr.needsUpdate = true;
    
    argmaxIndexRef.current = argmaxIndex;
    material.uniforms.greedyAnchorIndex.value = argmaxIndex;
    material.uniforms.uIsThinking.value = isThinking ? 1.0 : 0.0;
    texture.needsUpdate = true;
  }, [latestLogits, isLoaded, params.temperature, isThinking, vocabSize]);

  return (
    <div className="w-full h-full relative group">
        <div ref={containerRef} className="absolute inset-0 cursor-move" />

        {/* Floating Raycaster Tooltip */}
        {hoveredToken && (
            <div 
                className="absolute z-30 pointer-events-none bg-slate-950/90 backdrop-blur-md border border-slate-700/60 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200 shadow-2xl min-w-[150px]"
                style={{ left: hoveredToken.x, top: hoveredToken.y }}
            >
                <div className="font-bold text-slate-100 flex items-center space-x-1 border-b border-white/10 pb-1 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${hoveredToken.isFiltered ? 'bg-red-400' : 'bg-emerald-400'}`} />
                    <span className="truncate max-w-[120px]">
                        {hoveredToken.tokenStr.trim() ? `"${hoveredToken.tokenStr}"` : `Token #${hoveredToken.id}`}
                    </span>
                </div>
                <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Prob:</span>
                        <span className="text-cyan-400 font-semibold">
                            {(hoveredToken.probability * 100).toFixed(2)}%
                        </span>
                    </div>
                    {hoveredToken.rank !== -1 && (
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-400">Rank:</span>
                            <span className="text-purple-400">#{hoveredToken.rank}</span>
                        </div>
                    )}
                    {hoveredToken.rawLogit !== -999.0 && (
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-400">Logit:</span>
                            <span className="text-amber-400">{hoveredToken.rawLogit.toFixed(2)}</span>
                        </div>
                    )}
                    {hoveredToken.isFiltered && (
                        <div className="flex justify-between text-[9px]">
                            <span className="text-red-400">Status:</span>
                            <span className="text-red-300 font-bold uppercase truncate max-w-[90px]">
                                {hoveredToken.filterReason || 'Filtered'}
                            </span>
                        </div>
                    )}
                    {hoveredToken.isRag && (
                        <div className="text-[8px] text-blue-400 font-bold uppercase mt-0.5 flex items-center">
                            <span className="w-1 h-1 rounded-full bg-blue-400 mr-1" />
                            RAG Grounded
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* Interactive Controls Overlay */}
        {isLoaded && argmaxIndexRef.current !== -1 && (
            <button 
                onClick={focusOnGreedyAnchor}
                className="absolute bottom-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-[10px] font-mono px-3 py-1.5 rounded-full border border-white/20 shadow-lg transition-colors z-20"
            >
                [SPACE] Focus Greedy Anchor
            </button>
        )}
        
        {/* Loading Overlay if needed */}
        {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl z-10">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-mono text-cyan-400">Loading Terrain Coordinates...</p>
                </div>
            </div>
        )}
    </div>
  );
};
