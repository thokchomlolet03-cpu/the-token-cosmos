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
  heightMode?: 'linear' | 'log' | 'logit';
}

export const TerrainCanvas: React.FC<TerrainCanvasProps> = ({ 
  modelId, 
  latestLogits, 
  params, 
  ragTokenIds = [], 
  isThinking = false,
  candidates = [],
  heightMode = 'log',
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
  
  const thresholdRef = useRef<number>(6.0);

  const [isLoaded, setIsLoaded] = useState(false);
  const { vocabSize, rawCoordinates, loadForModel } = useTerrainCoordinates(modelId || undefined);

  // Targets for smooth animation interpolation
  const targetActiveProbsRef = useRef<Float32Array | null>(null);
  const targetBaseProbsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (vocabSize) {
      targetActiveProbsRef.current = new Float32Array(vocabSize);
      targetBaseProbsRef.current = new Float32Array(vocabSize);
    }
  }, [vocabSize]);

  // Trigger coordinate load on model change
  useEffect(() => {
    if (modelId) {
      loadForModel(modelId);
    }
  }, [modelId, loadForModel]);

  // Set loaded state when coordinates are available
  useEffect(() => {
    if (rawCoordinates && rawCoordinates.length > 0) {
      setIsLoaded(true);
    }
  }, [rawCoordinates]);

  useEffect(() => {
    if (!containerRef.current || !isLoaded || !rawCoordinates) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050714, 0.0015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 15000);
    camera.position.set(0, 150, 250);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050714);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 30;
    controls.maxDistance = 800;
    controlsRef.current = controls;

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.5,
        0.4,
        0.85
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const gridHelper = new THREE.GridHelper(600, 60, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(vocabSize * 3);
    const umapArray = new Float32Array(vocabSize * 2);
    const isRagArray = new Float32Array(vocabSize);
    const tokenIndexArray = new Float32Array(vocabSize);

    const spread = 250.0;
    for (let i = 0; i < vocabSize; i++) {
        const x = rawCoordinates[i * 2];
        const y = rawCoordinates[i * 2 + 1];
        positionArray[i * 3] = x * spread;
        positionArray[i * 3 + 1] = 0;
        positionArray[i * 3 + 2] = y * spread;
        umapArray[i * 2] = x;
        umapArray[i * 2 + 1] = y;
        isRagArray[i] = 0.0;
        tokenIndexArray[i] = i;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
    geometry.setAttribute('umapCoord', new THREE.BufferAttribute(umapArray, 2));
    geometry.setAttribute('isRagGrounded', new THREE.BufferAttribute(isRagArray, 1));
    geometry.setAttribute('tokenIndex', new THREE.BufferAttribute(tokenIndexArray, 1));

    const texSize = Math.ceil(Math.sqrt(vocabSize));
    const dataSize = texSize * texSize;
    const probabilityData = new Float32Array(dataSize * 2);

    for (let i = 0; i < probabilityData.length; i += 2) {
        probabilityData[i] = 0.0;
        probabilityData[i + 1] = 0.005;
    }

    const probabilityTexture = new THREE.DataTexture(
        probabilityData,
        texSize,
        texSize,
        THREE.RGFormat,
        THREE.FloatType
    );
    probabilityTexture.needsUpdate = true;

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

    let animationFrameId: number;
    const startTime = performance.now();

    const trackCamera = () => {
      if (controlsRef.current) controlsRef.current.update();
      if (targetFocusRef.current && controlsRef.current && cameraRef.current) {
        const controls = controlsRef.current;
        const cam = cameraRef.current;
        const targetPos = targetFocusRef.current.position;
        const targetLook = targetFocusRef.current.lookAt;
        cam.position.lerp(targetPos, 0.05);
        controls.target.lerp(targetLook, 0.05);
        if (cam.position.distanceTo(targetPos) < 1.0 && controls.target.distanceTo(targetLook) < 1.0) {
            targetFocusRef.current = null;
        }
      }
      if (rendererRef.current && composerRef.current && sceneRef.current && cameraRef.current && pointsRef.current) {
        const points = pointsRef.current;
        const material = points.material as THREE.ShaderMaterial;
        
        // Decoupled dynamic lerping of star heights and colors
        if (targetActiveProbsRef.current && targetBaseProbsRef.current) {
            const texture = material.uniforms.probabilityTexture.value as THREE.DataTexture;
            const data = texture.image.data as Float32Array;
            const tokenCount = Math.min(vocabSize, data.length / 2);
            
            let needsTextureUpdate = false;
            const lerpFactor = 0.15; // Smooth morphing speed (15% per frame)
            
            for (let i = 0; i < tokenCount; i++) {
                const targetActive = targetActiveProbsRef.current[i];
                const diffActive = targetActive - data[i * 2];
                if (Math.abs(diffActive) > 0.0001) {
                    data[i * 2] += diffActive * lerpFactor;
                    needsTextureUpdate = true;
                }
                
                const targetBase = targetBaseProbsRef.current[i];
                const diffBase = targetBase - data[i * 2 + 1];
                if (Math.abs(diffBase) > 0.0001) {
                    data[i * 2 + 1] += diffBase * lerpFactor;
                    needsTextureUpdate = true;
                }
            }
            
            if (needsTextureUpdate) {
                texture.needsUpdate = true;
                
                const positionsAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
                const positions = positionsAttr.array as Float32Array;
                const maxHeight = 150.0;
                
                const smoothStep = (e0: number, e1: number, x: number) => {
                  const t = Math.max(0.0, Math.min(1.0, (x - e0) / (e1 - e0)));
                  return t * t * (3.0 - 2.0 * t);
                };
                
                for (let i = 0; i < tokenCount; i++) {
                    const activeProb = data[i * 2];
                    const elevation = smoothStep(0.001, 0.1, activeProb) * (maxHeight * 0.3) + 
                                      smoothStep(0.1, 1.0, activeProb) * (maxHeight * 0.7);
                    
                    positions[i * 3 + 1] += (elevation - positions[i * 3 + 1]) * lerpFactor;
                }
                positionsAttr.needsUpdate = true;
            }
        }
        
        material.uniforms.time.value = (performance.now() - startTime) / 1000;
        composerRef.current.render();
      }
      animationFrameId = requestAnimationFrame(trackCamera);
    };
    trackCamera();

    const handleResize = () => {
        if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        composerRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onMouseMove = (event: MouseEvent) => {
        if (!containerRef.current || !cameraRef.current || !pointsRef.current) return;
        raycaster.params.Points.threshold = thresholdRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(pointsRef.current);
        if (intersects.length > 0) {
            const idx = intersects[0].index;
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
                        probability: candidate.probability, // Use actual probability from state instead of visual texture heights
                        rank: candidate.rank,
                        rawLogit: candidate.raw_logit,
                        isFiltered: candidate.isFiltered,
                        filterReason: candidate.filterReason,
                        isRag: candidate.is_rag_grounded,
                        x: tooltipX,
                        y: tooltipY,
                    });
                } else if (activeProb > 0.0001) {
                    setHoveredToken({
                        id: idx,
                        tokenStr: `Token #${idx}`,
                        probability: activeProb,
                        rank: 999,
                        rawLogit: latestLogits ? latestLogits[idx] : 0,
                        isFiltered: true,
                        filterReason: 'Fringe',
                        x: tooltipX,
                        y: tooltipY,
                    });
                } else {
                    setHoveredToken(null);
                }
            }
        } else {
            setHoveredToken(null);
        }
    };
    containerRef.current.addEventListener('mousemove', onMouseMove);

    return () => {
        window.removeEventListener('resize', handleResize);
        if (containerRef.current) {
            containerRef.current.removeEventListener('mousemove', onMouseMove);
            if (rendererRef.current && rendererRef.current.domElement) {
                containerRef.current.removeChild(rendererRef.current.domElement);
            }
        }
        cancelAnimationFrame(animationFrameId);
        geometry.dispose();
        material.dispose();
        probabilityTexture.dispose();
        composer.dispose();
    };
  }, [isLoaded, rawCoordinates, vocabSize]);

  const targetFocusRef = useRef<{position: THREE.Vector3, lookAt: THREE.Vector3} | null>(null);

  const focusOnGreedyAnchor = () => {
    if (argmaxIndexRef.current === -1 || !rawCoordinates || !controlsRef.current || !cameraRef.current) return;
    const x = rawCoordinates[argmaxIndexRef.current * 2];
    const y = rawCoordinates[argmaxIndexRef.current * 2 + 1];
    const spread = 250.0;
    const targetLook = new THREE.Vector3(x * spread, 0, y * spread);
    const targetPos = new THREE.Vector3(targetLook.x, 50, targetLook.z + 80);
    targetFocusRef.current = { position: targetPos, lookAt: targetLook };
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        focusOnGreedyAnchor();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawCoordinates]);

  useEffect(() => {
    if (latestLogits && isLoaded) {
      setTimeout(focusOnGreedyAnchor, 100);
    }
  }, [latestLogits, isLoaded]);

  useEffect(() => {
    if (!pointsRef.current || !isLoaded) return;
    const geometry = pointsRef.current.geometry;
    const isRagAttr = geometry.getAttribute('isRagGrounded') as THREE.BufferAttribute;
    for(let i=0; i<isRagAttr.count; i++) { isRagAttr.setX(i, 0); }
    for(const tid of ragTokenIds) {
        if (tid >= 0 && tid < isRagAttr.count) { isRagAttr.setX(tid, 1); }
    }
    isRagAttr.needsUpdate = true;
  }, [ragTokenIds, isLoaded]);

  // Set targets for animation loop
  useEffect(() => {
    if (!latestLogits || !pointsRef.current || !isLoaded || !targetActiveProbsRef.current || !targetBaseProbsRef.current) return;
    
    const points = pointsRef.current;
    const material = points.material as THREE.ShaderMaterial;
    
    const filterMap = new Map<number, boolean>();
    const activeProbMap = new Map<number, number>();
    for (const c of candidates) {
        filterMap.set(c.token_id, c.isFiltered);
        activeProbMap.set(c.token_id, c.probability);
    }
    
    let maxLogit = -Infinity;
    let argmaxIndex = -1;
    const tokenCount = Math.min(latestLogits.length, vocabSize, targetActiveProbsRef.current.length);

    for (let i = 0; i < tokenCount; i++) {
        if (latestLogits[i] > maxLogit) {
            maxLogit = latestLogits[i];
            argmaxIndex = i;
        }
    }
    
    let minLogit = maxLogit - 12.0;
    const activeCandidates = candidates.filter(c => !c.isFiltered);
    if (activeCandidates.length > 1) {
        const activeLogits = activeCandidates.map(c => latestLogits[c.token_id]).filter(isFinite);
        if (activeLogits.length > 0) {
            minLogit = Math.min(...activeLogits);
        }
    }
    const logitRange = Math.max(1.0, maxLogit - minLogit);
    
    let sumExpBase = 0;
    const baseTemp = 1.0;
    
    for (let i = 0; i < tokenCount; i++) {
        const isFiltered = filterMap.has(i) ? filterMap.get(i) : true;
        let actProb = 0.0;
        if (!isFiltered) {
            if (heightMode === 'logit') {
                const logitVal = latestLogits[i];
                const normLogit = Math.max(0.0, Math.min(1.0, (logitVal - minLogit) / logitRange));
                actProb = 0.1 + normLogit * 0.9;
            } else if (heightMode === 'log') {
                const prob = activeProbMap.get(i) ?? 0.0;
                if (prob > 0.0) {
                    const logVal = Math.log10(prob);
                    const normLog = Math.max(0.0, Math.min(1.0, (logVal + 4.0) / 4.0));
                    actProb = 0.1 + normLog * 0.9;
                }
            } else {
                actProb = activeProbMap.get(i) ?? 0.0;
            }
        }
        
        targetActiveProbsRef.current[i] = actProb;
        
        const valBase = Math.exp((latestLogits[i] - maxLogit) / baseTemp);
        targetBaseProbsRef.current[i] = valBase;
        sumExpBase += valBase;
    }
    
    for (let i = 0; i < tokenCount; i++) {
        targetBaseProbsRef.current[i] /= sumExpBase;
    }
    
    argmaxIndexRef.current = argmaxIndex;
    material.uniforms.greedyAnchorIndex.value = argmaxIndex;
    material.uniforms.uIsThinking.value = isThinking ? 1.0 : 0.0;
  }, [latestLogits, isLoaded, candidates, isThinking, vocabSize, heightMode]);

  return (
    <div className="w-full h-full relative group">
        <div ref={containerRef} className="absolute inset-0 cursor-move" />
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
