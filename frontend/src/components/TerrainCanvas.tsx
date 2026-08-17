import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { terrainVertexShader, terrainFragmentShader } from '../terrain/shaders';
import { useTerrainCoordinates } from '../terrain/useTerrainCoordinates';
import { SamplingParameters, ProcessedTokenCandidate } from '../types/sampling';
import { SEMANTIC_BIOMES, computeBaseTopologicalHeight, getSectorCode, identifyBiome } from '../terrain/semanticBiomes';
import { MiniRadar } from './MiniRadar';
import { spatialIndex } from '../terrain/SpatialTokenIndex';
import { LassoSelectionTool } from './LassoSelectionTool';
import { ClusterAnalyticsDrawer } from './ClusterAnalyticsDrawer';
import { ZenViewportHUD, CosmosPersona } from './ZenViewportHUD';
import { WaterPlane } from '../terrain/WaterPlane';
import { FlightPath, TrajectoryAnomaly } from '../terrain/FlightPath';
import { EnterpriseLabsModal, ENTERPRISE_MISSIONS, EnterpriseMission } from './EnterpriseLabsModal';
import { MultiModelSplitView } from './MultiModelSplitView';
import { localTelemetry } from '../telemetry/localDb';
import { ScreenPolygonPoint, ClusterMetrics, IndexedTokenPoint } from '../types/spatial';

import { FlightStep } from '../types/sampling';

interface TerrainCanvasProps {
  modelId: string | null;
  latestLogits: Float32Array | null;
  params: SamplingParameters;
  ragTokenIds?: number[];
  isThinking?: boolean;
  candidates?: ProcessedTokenCandidate[];
  heightMode?: 'linear' | 'log' | 'logit';
  steps?: FlightStep[];
  currentStepIndex?: number;
}

export const TerrainCanvas: React.FC<TerrainCanvasProps> = ({ 
  modelId, 
  latestLogits, 
  params: _params, 
  ragTokenIds = [], 
  isThinking = false,
  candidates = [],
  heightMode = 'log',
  steps = [],
  currentStepIndex = 0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsContainerRef = useRef<HTMLDivElement>(null);
  const continentLabelsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const argmaxIndexRef = useRef<number>(-1);
  const waterPlaneRef = useRef<WaterPlane | null>(null);
  const flightPathRef = useRef<FlightPath | null>(null);
  const ghostFlightPathRef = useRef<FlightPath | null>(null);

  // Persona & Enterprise Labs & Multi-Model state
  const [persona, setPersona] = useState<CosmosPersona>('flight_sim');
  const [isLabsOpen, setIsLabsOpen] = useState<boolean>(false);
  const [isMultiModelOpen, setIsMultiModelOpen] = useState<boolean>(false);
  const [lastAnomaly, setLastAnomaly] = useState<TrajectoryAnomaly | null>(null);
  
  // Radar state
  const [cameraState, setCameraState] = useState<{
    angle: number;
    distance: number;
    pos: { x: number; z: number };
    target: { x: number; z: number };
  }>({ angle: 0, distance: 300, pos: { x: 0, z: 250 }, target: { x: 0, z: 0 } });

  const [hoveredToken, setHoveredToken] = useState<{
    id: number;
    tokenStr: string;
    probability: number;
    rank: number;
    rawLogit: number;
    isFiltered: boolean;
    filterReason?: string;
    isRag?: boolean;
    sector: string;
    x: number;
    y: number;
  } | null>(null);

  const [isLassoActive, setIsLassoActive] = useState<boolean>(false);
  const [clusterMetrics, setClusterMetrics] = useState<ClusterMetrics | null>(null);
  const [screenCentroid, setScreenCentroid] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const handleLassoComplete = (polygon: ScreenPolygonPoint[], centroid: { x: number; y: number }) => {
    if (!cameraRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const selected = spatialIndex.queryLassoScreenSpace(polygon, cameraRef.current, rect.width, rect.height);
    
    if (candidatesRef.current) {
      const candMap = new Map(candidatesRef.current.map(c => [c.token_id, c]));
      selected.forEach(s => {
        const c = candMap.get(s.token_id);
        if (c) {
          s.probability = c.probability;
          s.token_str = c.token_str;
          s.rank = c.rank;
        }
      });
    }

    const metrics = spatialIndex.computeClusterMetrics(selected);
    setClusterMetrics(metrics);
    setScreenCentroid(centroid);
  };

  const handleCameraLockChange = (locked: boolean) => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !locked;
    }
  };

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(0, 160, 260);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  };

  const handleZoomIn = () => {
    if (cameraRef.current && controlsRef.current) {
      const controls = controlsRef.current;
      const cam = cameraRef.current;
      const offset = new THREE.Vector3().subVectors(cam.position, controls.target);
      offset.multiplyScalar(0.75); // Dolly 25% closer
      if (offset.length() > controls.minDistance) {
        cam.position.copy(controls.target).add(offset);
        controls.update(); // Syncs spherical radius inside OrbitControls
      }
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current && controlsRef.current) {
      const controls = controlsRef.current;
      const cam = cameraRef.current;
      const offset = new THREE.Vector3().subVectors(cam.position, controls.target);
      offset.multiplyScalar(1.33); // Dolly 33% further
      if (offset.length() < controls.maxDistance) {
        cam.position.copy(controls.target).add(offset);
        controls.update(); // Syncs spherical radius inside OrbitControls
      }
    }
  };

  const handleToggleFullscreen = () => {
    const el = (containerRef.current?.parentElement || containerRef.current) as any;
    if (!el) return;

    const doc = document as any;
    const isFs = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (!isFs) {
      if (el.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch((e: any) => console.warn(e));
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        setIsFullscreen(true);
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
        setIsFullscreen(true);
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().then(() => setIsFullscreen(false)).catch((e: any) => console.warn(e));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        setIsFullscreen(false);
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
        setIsFullscreen(false);
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFs);
      if (containerRef.current && cameraRef.current && rendererRef.current && composerRef.current) {
        setTimeout(() => {
          if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
          const width = containerRef.current.clientWidth || window.innerWidth;
          const height = containerRef.current.clientHeight || window.innerHeight;
          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
          rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          composerRef.current.setSize(width, height);
        }, 50);
      }
    };

    const events = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
    events.forEach(evt => document.addEventListener(evt, handleFullscreenChange));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, handleFullscreenChange));
    };
  }, []);

  const candidatesRef = useRef(candidates);
  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);
  
  const thresholdRef = useRef<number>(6.0);
  const lastTrackedTokenRef = useRef<{ id: number; text: string } | null>(null);

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
    scene.fog = new THREE.FogExp2(0x050714, 0.0012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 15000);
    camera.position.set(0, 160, 260);
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
        1.3,
        0.4,
        0.85
    );
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    // ─── Cartographic Graticule Base Plane ─────────────────────────────
    const spread = 250.0;
    const gridHelper = new THREE.GridHelper(spread * 2, 12, 0x334155, 0x0f172a);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Perimeter boundary border
    const borderGeometry = new THREE.BufferGeometry();
    const borderPoints = [
      new THREE.Vector3(-spread, 0, -spread),
      new THREE.Vector3(spread, 0, -spread),
      new THREE.Vector3(spread, 0, spread),
      new THREE.Vector3(-spread, 0, spread),
      new THREE.Vector3(-spread, 0, -spread),
    ];
    borderGeometry.setFromPoints(borderPoints);
    const borderMaterial = new THREE.LineBasicMaterial({ color: 0x475569, transparent: true, opacity: 0.4 });
    const borderLine = new THREE.Line(borderGeometry, borderMaterial);
    scene.add(borderLine);

    // Geometry attributes
    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(vocabSize * 3);
    const umapArray = new Float32Array(vocabSize * 2);
    const isRagArray = new Float32Array(vocabSize);
    const tokenIndexArray = new Float32Array(vocabSize);

    // Build 1D Heightmap for 3D DDA Occlusion
    const GRID_SIZE = 64;
    const heightmap1D = new Float32Array(GRID_SIZE * GRID_SIZE);
    for (let gz = 0; gz < GRID_SIZE; gz++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const ux = (gx / (GRID_SIZE - 1)) * 2 - 1;
        const uz = (gz / (GRID_SIZE - 1)) * 2 - 1;
        heightmap1D[gz * GRID_SIZE + gx] = computeBaseTopologicalHeight(ux, uz);
      }
    }

    const indexedPoints: IndexedTokenPoint[] = [];

    for (let i = 0; i < vocabSize; i++) {
        let x = rawCoordinates[i * 2];
        let y = rawCoordinates[i * 2 + 1];
        
        // Deterministic jitter to break exact overlaps
        const angle = (i * 0.17) % (Math.PI * 2);
        const radius = 0.0015 * (1.0 + (i % 5) * 0.2);
        x += Math.cos(angle) * radius;
        y += Math.sin(angle) * radius;

        const baseH = computeBaseTopologicalHeight(x, y);
        const biome = identifyBiome(x, y);

        positionArray[i * 3] = x * spread;
        positionArray[i * 3 + 1] = baseH;
        positionArray[i * 3 + 2] = y * spread;
        umapArray[i * 2] = x;
        umapArray[i * 2 + 1] = y;
        isRagArray[i] = 0.0;
        tokenIndexArray[i] = i;

        indexedPoints.push({
          token_id: i,
          token_str: `Token #${i}`,
          worldX: x * spread,
          worldZ: y * spread,
          elevation: baseH,
          biomeId: biome.id,
        });
    }

    // Build spatial quadtree index
    spatialIndex.build(indexedPoints, heightmap1D, spread * 2, GRID_SIZE, GRID_SIZE);

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
        uIsThinking: { value: 0.0 },
        uTemperature: { value: _params.temperature || 1.0 },
        uMaxProb: { value: 1.0 },
        uMinP: { value: _params.minP || 0.05 },
    };
    const material = new THREE.ShaderMaterial({
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    pointsRef.current = points;

    // ─── 3D Volumetric Waterplane (Min-P Tides) ───────────────────────
    const waterPlane = new WaterPlane(spread * 2.2, 64);
    scene.add(waterPlane.mesh);
    waterPlaneRef.current = waterPlane;

    // ─── 3D Semantic Trajectory Ribbon (Flight Highway) ───────────────
    const flightPath = new FlightPath(128, 3.2);
    flightPath.onAnomalyDetected = (anomaly) => {
      setLastAnomaly(anomaly);
    };
    scene.add(flightPath.mesh);
    flightPathRef.current = flightPath;

    // ─── 3D Ghost Trajectory Ribbon (Multi-Model Comparison with Polygon Offset) ─
    const ghostFlightPath = new FlightPath(128, 3.2, true);
    scene.add(ghostFlightPath.mesh);
    ghostFlightPathRef.current = ghostFlightPath;

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

      // ─── Animate Waterplane & Trajectory Ribbons ───────────────────
      const safeMinP = Math.max(_params.minP || 0.05, 1e-7);
      const safeTemp = Math.max(_params.temperature || 1.0, 0.01);
      const yWater = 4.0 + 150.0 * Math.pow(safeMinP, 1.0 / safeTemp);
      if (waterPlaneRef.current) {
        waterPlaneRef.current.setElevation(yWater);
        waterPlaneRef.current.update(0.016);
      }
      if (flightPathRef.current) {
        flightPathRef.current.update(0.016);
      }
      if (ghostFlightPathRef.current) {
        ghostFlightPathRef.current.update(0.016);
      }

      // Update camera tracking state for radar
      if (cameraRef.current && controlsRef.current) {
        const cam = cameraRef.current;
        const tgt = controlsRef.current.target;
        const dist = cam.position.distanceTo(tgt);
        const ang = Math.atan2(cam.position.x - tgt.x, cam.position.z - tgt.z);
        setCameraState({
          angle: ang,
          distance: dist,
          pos: { x: cam.position.x, z: cam.position.z },
          target: { x: tgt.x, z: tgt.z },
        });
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
            const lerpFactor = 0.15;
            
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
                    const x = rawCoordinates[i * 2];
                    const y = rawCoordinates[i * 2 + 1];
                    const baseH = computeBaseTopologicalHeight(x, y);

                    const activeSummit = smoothStep(0.001, 0.08, activeProb) * (maxHeight * 0.25) + 
                                         smoothStep(0.08, 1.0, activeProb) * (maxHeight * 0.75);
                    const targetElevation = baseH + activeSummit;
                    
                    positions[i * 3 + 1] += (targetElevation - positions[i * 3 + 1]) * lerpFactor;
                }
                positionsAttr.needsUpdate = true;
            }
        }
        
        material.uniforms.time.value = (performance.now() - startTime) / 1000;
        composerRef.current.render();

        // ─── 1. Project Macro Continent Toponym Labels (LoD Distance Culling) ───
        const continentContainer = continentLabelsRef.current;
        if (continentContainer && cameraRef.current && containerRef.current) {
          const camera = cameraRef.current;
          const rect = containerRef.current.getBoundingClientRect();
          const camDist = camera.position.distanceTo(controlsRef.current?.target || new THREE.Vector3());

          // LoD: continent labels are most visible when zoomed out (camDist > 120)
          const continentOpacity = Math.max(0.0, Math.min(0.75, (camDist - 80) / 140));

          while (continentContainer.children.length > SEMANTIC_BIOMES.length) {
            continentContainer.removeChild(continentContainer.lastChild!);
          }
          while (continentContainer.children.length < SEMANTIC_BIOMES.length) {
            const div = document.createElement('div');
            div.className = "absolute pointer-events-none text-[10px] font-mono tracking-widest uppercase font-black px-2.5 py-1 rounded border border-white/10 backdrop-blur-sm shadow-md transition-opacity duration-300";
            continentContainer.appendChild(div);
          }

          SEMANTIC_BIOMES.forEach((biome, idx) => {
            const el = continentContainer.children[idx] as HTMLDivElement;
            const wx = biome.center[0] * spread;
            const wz = biome.center[1] * spread;
            const wy = biome.elevationBias + 20.0;

            const vec = new THREE.Vector3(wx, wy, wz);
            vec.project(camera);

            if (vec.z > 1.0 || continentOpacity <= 0.05) {
              el.style.opacity = '0';
            } else {
              const xPos = (vec.x * 0.5 + 0.5) * rect.width;
              const yPos = (-vec.y * 0.5 + 0.5) * rect.height;

              el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0) translate(-50%, -50%)`;
              el.style.opacity = String(continentOpacity);
              el.style.color = biome.colorHex;
              el.style.backgroundColor = 'rgba(5, 7, 20, 0.65)';
              el.style.borderColor = biome.colorHex + '40';
              el.innerHTML = `<span>${biome.shortLabel}</span>`;
            }
          });
        }

        // ─── 2. Project Dynamic HTML overlays for Top 8 active candidates ───
        const container = labelsContainerRef.current;
        const positionsAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
        const positions = positionsAttr.array as Float32Array;
        
        if (container && cameraRef.current && containerRef.current && candidatesRef.current && rawCoordinates) {
            const camera = cameraRef.current;
            const rect = containerRef.current.getBoundingClientRect();
            const topN = candidatesRef.current.filter(c => !c.isFiltered).slice(0, 8);
            
            while (container.children.length > topN.length) {
                container.removeChild(container.lastChild!);
            }
            while (container.children.length < topN.length) {
                const div = document.createElement('div');
                div.className = "absolute pointer-events-none px-2.5 py-1 rounded-full text-[9px] font-mono font-bold bg-slate-950/85 backdrop-blur-md border text-white shadow-xl transition-opacity duration-150 flex items-center space-x-1.5 border-slate-700/80";
                container.appendChild(div);
            }
            
            for (let i = 0; i < topN.length; i++) {
                const c = topN[i];
                const el = container.children[i] as HTMLDivElement;
                const tid = c.token_id;
                
                if (tid >= 0 && tid < vocabSize) {
                    const px = rawCoordinates[tid * 2] * spread;
                    const pz = rawCoordinates[tid * 2 + 1] * spread;
                    const py = positions[tid * 3 + 1];
                    
                    const vec = new THREE.Vector3(px, py, pz);
                    vec.project(camera);
                    
                    const isBehind = vec.z > 1.0;
                    if (isBehind) {
                        el.style.opacity = '0';
                    } else {
                        const xPos = (vec.x * 0.5 + 0.5) * rect.width;
                        const yPos = (-vec.y * 0.5 + 0.5) * rect.height;
                        
                        el.style.transform = `translate3d(${xPos}px, ${yPos - 22}px, 0) translate(-50%, -50%)`;
                        el.style.opacity = '1';
                        el.style.borderColor = c.rank === 1 ? '#10B981' : '#64748B';
                        el.style.boxShadow = `0 6px 12px rgba(0, 0, 0, 0.4)`;
                        
                        el.innerHTML = `
                          <span style="color: ${c.rank === 1 ? '#10B981' : '#38BDF8'}; font-weight: 800;">#${c.rank}</span>
                          <span class="text-slate-100 font-semibold">${c.token_str.trim() || '—'}</span>
                          <span class="text-slate-400 font-normal text-[8px] opacity-90">(${(c.probability * 100).toFixed(1)}%)</span>
                        `;
                    }
                } else {
                    el.style.opacity = '0';
                }
            }
        }
      }
      animationFrameId = requestAnimationFrame(trackCamera);
    };
    trackCamera();

    const handleResize = () => {
        if (!containerRef.current || !cameraRef.current || !rendererRef.current || !composerRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
        composerRef.current.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(handleResize);
    });
    if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
    }

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
            const material = pointsRef.current.material as THREE.ShaderMaterial;
            const texture = material.uniforms.probabilityTexture.value as THREE.DataTexture;
            const probData = texture.image.data as Float32Array;

            let bestIdx = intersects[0].index;
            let highestProb = -1;
            let bestCandidate: any = null;

            for (let k = 0; k < Math.min(intersects.length, 15); k++) {
                const idx = intersects[k].index;
                if (idx !== undefined && idx >= 0 && idx < vocabSize) {
                    const activeProb = probData[idx * 2];
                    const candidate = candidatesRef.current?.find(c => c.token_id === idx);
                    
                    if (candidate) {
                        if (candidate.probability > highestProb) {
                            highestProb = candidate.probability;
                            bestIdx = idx;
                            bestCandidate = candidate;
                        }
                    } else {
                        if (activeProb > highestProb && !bestCandidate) {
                            highestProb = activeProb;
                            bestIdx = idx;
                        }
                    }
                }
            }

            const idx = bestIdx !== undefined ? bestIdx : intersects[0].index;
            if (idx !== undefined && idx >= 0 && idx < vocabSize) {
                const activeProb = probData[idx * 2];
                const candidate = candidatesRef.current?.find(c => c.token_id === idx);
                const tooltipX = event.clientX - rect.left + 15;
                const tooltipY = event.clientY - rect.top + 15;
                const xCoord = rawCoordinates[idx * 2];
                const yCoord = rawCoordinates[idx * 2 + 1];
                const sector = getSectorCode(xCoord, yCoord);

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
                        sector,
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
                        sector,
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
        resizeObserver.disconnect();
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
    if (argmaxIndexRef.current === -1 || !rawCoordinates || !controlsRef.current || !cameraRef.current || !pointsRef.current) return;
    const x = rawCoordinates[argmaxIndexRef.current * 2];
    const y = rawCoordinates[argmaxIndexRef.current * 2 + 1];
    
    const points = pointsRef.current;
    const positionsAttr = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const positions = positionsAttr.array as Float32Array;
    const elevation = positions[argmaxIndexRef.current * 3 + 1];
    
    const spread = 250.0;
    const targetLook = new THREE.Vector3(x * spread, elevation, y * spread);
    const targetPos = new THREE.Vector3(targetLook.x, elevation + 50, targetLook.z + 100);
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

  // Focus once when coordinates load
  useEffect(() => {
    if (isLoaded && argmaxIndexRef.current !== -1) {
      setTimeout(focusOnGreedyAnchor, 200);
    }
  }, [isLoaded]);

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
    
    argmaxIndexRef.current = argmaxIndex;
    material.uniforms.greedyAnchorIndex.value = argmaxIndex;
    material.uniforms.uIsThinking.value = isThinking ? 1.0 : 0.0;
    material.uniforms.uTemperature.value = _params.temperature || 1.0;
    material.uniforms.uMinP.value = _params.minP || 0.05;
    material.uniforms.uMaxProb.value = primeCandidate ? primeCandidate.probability : 1.0;

    if (primeCandidate && primeCandidate.token_id < vocabSize) {
      localTelemetry.logStep(
        steps.length > 0 ? steps.length : 1,
        primeCandidate.token_id,
        primeCandidate.probability,
        0.0
      );
    }
  }, [latestLogits, isLoaded, candidates, isThinking, vocabSize, heightMode, _params.temperature, _params.minP, steps.length]);

  // ─── Synchronize 3D FlightPath strictly with Timeline Steps ─────────
  useEffect(() => {
    if (!flightPathRef.current || !rawCoordinates || !isLoaded) return;
    
    if (!steps || steps.length === 0) {
      flightPathRef.current.clear();
      return;
    }

    const activeSteps = steps.slice(0, (currentStepIndex !== undefined ? currentStepIndex : steps.length - 1) + 1);
    flightPathRef.current.clear();

    const spread = 250.0;
    for (let i = 0; i < activeSteps.length; i++) {
      const step = activeSteps[i];
      const tok = step.selectedToken;
      const tid = tok.token_id;
      if (tid >= 0 && tid < vocabSize) {
        const wx = rawCoordinates[tid * 2] * spread;
        const wz = rawCoordinates[tid * 2 + 1] * spread;
        const baseH = computeBaseTopologicalHeight(rawCoordinates[tid * 2], rawCoordinates[tid * 2 + 1]);
        const safeMaxP = Math.max(tok.probability, 1e-7);
        const safeTemp = Math.max(step.params.temperature || _params.temperature || 1.0, 0.01);
        const peakH = 150.0 * Math.pow(tok.probability / safeMaxP, 1.0 / safeTemp);

        flightPathRef.current.addStep(
          tok.token_str,
          i,
          new THREE.Vector3(wx, baseH + peakH, wz),
          tok.probability,
          safeMaxP,
          tok.rank || 1
        );
      }
    }
  }, [steps, currentStepIndex, rawCoordinates, isLoaded, vocabSize, _params.temperature]);

  // Primary active target for MiniRadar
  const primeCandidate = candidates.find(c => c.rank === 1 && !c.isFiltered);
  const activeRadarToken = primeCandidate && rawCoordinates && primeCandidate.token_id < vocabSize
    ? {
        tokenStr: primeCandidate.token_str,
        probability: primeCandidate.probability,
        umapX: rawCoordinates[primeCandidate.token_id * 2],
        umapY: rawCoordinates[primeCandidate.token_id * 2 + 1],
      }
    : null;

  return (
    <div className="w-full h-full relative group">
        <div ref={containerRef} className="absolute inset-0 cursor-move" />
        <div ref={continentLabelsRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
        <div ref={labelsContainerRef} className="absolute inset-0 pointer-events-none overflow-hidden" />
        
        {/* Zen Viewport HUD */}
        <ZenViewportHUD
          modelId={modelId}
          status={isLoaded ? 'ready' : 'downloading'}
          stepIndex={candidates.length > 0 ? 1 : 0}
          topCandidate={candidates.length > 0 ? candidates[0] : null}
          isLassoActive={isLassoActive}
          isFullscreen={isFullscreen}
          persona={persona}
          temperature={_params.temperature || 1.0}
          minP={_params.minP || 0.05}
          onToggleLasso={() => setIsLassoActive(!isLassoActive)}
          onResetCamera={handleResetCamera}
          onToggleFullscreen={handleToggleFullscreen}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onTogglePersona={() => setPersona(persona === 'flight_sim' ? 'diagnostic' : 'flight_sim')}
          onOpenEnterpriseLabs={() => setIsLabsOpen(true)}
          onOpenMultiModel={() => setIsMultiModelOpen(true)}
        />

        {/* Semantic Anomaly Alert Banner */}
        {lastAnomaly && (
          <div className="absolute top-20 left-4 z-30 bg-rose-950/90 border border-rose-500/70 text-rose-200 px-3 py-1.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            <span><strong>[ANOMALY]:</strong> {lastAnomaly.message}</span>
            <button
              onClick={() => setLastAnomaly(null)}
              className="text-rose-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Enterprise Labs Modal */}
        <EnterpriseLabsModal
          isOpen={isLabsOpen}
          onClose={() => setIsLabsOpen(false)}
          onSelectMission={(_mission) => {
            if (flightPathRef.current) {
              flightPathRef.current.clear();
            }
          }}
        />

        {/* Multi-Model Latent Topography Split View */}
        <MultiModelSplitView
          isOpen={isMultiModelOpen}
          onClose={() => setIsMultiModelOpen(false)}
          onApplyGhostTrajectory={(points) => {
            if (ghostFlightPathRef.current) {
              ghostFlightPathRef.current.loadFromHistory(points);
            }
          }}
        />

        {/* 60 FPS Lasso Selection Tool */}
        <LassoSelectionTool
          enabled={isLassoActive}
          onLassoComplete={handleLassoComplete}
          onCameraLockChange={handleCameraLockChange}
        />

        {/* Cluster Analytics Drawer */}
        <ClusterAnalyticsDrawer
          metrics={clusterMetrics}
          onClose={() => setClusterMetrics(null)}
          screenCentroid={screenCentroid}
        />

        {/* Hover Tooltip */}
        {hoveredToken && (
            <div 
                className="absolute z-30 pointer-events-none bg-slate-950/90 backdrop-blur-md border border-slate-700/60 rounded-lg px-2.5 py-2 text-[10px] font-mono text-slate-200 shadow-2xl min-w-[160px]"
                style={{ left: hoveredToken.x, top: hoveredToken.y }}
            >
                <div className="font-bold text-slate-100 flex items-center justify-between border-b border-white/10 pb-1 mb-1">
                    <div className="flex items-center space-x-1 truncate max-w-[110px]">
                      <span className={`w-1.5 h-1.5 rounded-full ${hoveredToken.isFiltered ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <span className="truncate">
                          {hoveredToken.tokenStr.trim() ? `"${hoveredToken.tokenStr}"` : `Token #${hoveredToken.id}`}
                      </span>
                    </div>
                    <span className="text-[9px] text-cyan-300 font-mono bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-800/40">
                      {hoveredToken.sector}
                    </span>
                </div>
                <div className="space-y-0.5">
                    <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400">Prob:</span>
                        <span className="text-blue-400 font-semibold">
                            {(hoveredToken.probability * 100).toFixed(2)}%
                        </span>
                    </div>
                    {hoveredToken.rank !== -1 && (
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-400">Rank:</span>
                            <span className="text-slate-300">#{hoveredToken.rank}</span>
                        </div>
                    )}
                    {hoveredToken.rawLogit !== -999.0 && (
                        <div className="flex justify-between text-[9px]">
                            <span className="text-slate-400">Logit:</span>
                            <span className="text-slate-300">{hoveredToken.rawLogit.toFixed(2)}</span>
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
                        <div className="text-[8px] text-slate-400 font-bold uppercase mt-0.5 flex items-center">
                            <span className="w-1 h-1 rounded-full bg-slate-400 mr-1" />
                            RAG Grounded
                        </div>
                    )}
                </div>
            </div>
        )}
        
        {/* Interactive Center on Target Button */}
        {isLoaded && argmaxIndexRef.current !== -1 && (
            <button 
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    focusOnGreedyAnchor();
                }}
                className="absolute bottom-4 left-4 bg-slate-900/80 hover:bg-slate-800 backdrop-blur text-slate-200 hover:text-white text-[10px] font-mono px-3 py-1.5 rounded-lg border border-slate-700/70 shadow-lg transition-colors z-20 flex items-center gap-1.5"
            >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>[SPACE] Focus Target #1</span>
            </button>
        )}

        {/* 2D Semantic Mini-Radar */}
        <MiniRadar
          cameraAngle={cameraState.angle}
          cameraDistance={cameraState.distance}
          cameraPos={cameraState.pos}
          targetPos={cameraState.target}
          activeToken={activeRadarToken}
        />
        
        {/* Loading Overlay */}
        {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl z-10">
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-mono text-blue-400">Loading Cartographic Topography...</p>
                </div>
            </div>
        )}
    </div>
  );
};
