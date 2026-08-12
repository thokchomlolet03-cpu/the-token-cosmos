import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { terrainVertexShader, terrainFragmentShader } from '../terrain/shaders';
import { useTerrainCoordinates } from '../terrain/useTerrainCoordinates';
import { SamplingParameters } from '../types/sampling';

interface TerrainCanvasProps {
  modelId: string | null;
  latestLogits: Float32Array | null;
  params: SamplingParameters;
  ragTokenIds?: number[];
  isThinking?: boolean;
}

export const TerrainCanvas: React.FC<TerrainCanvasProps> = ({ modelId, latestLogits, params, ragTokenIds = [], isThinking = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const argmaxIndexRef = useRef<number>(-1);
  
  const { isLoaded, vocabSize, rawCoordinates, loadForModel } = useTerrainCoordinates(modelId || undefined);

  useEffect(() => {
    if (modelId && !isLoaded) {
      loadForModel(modelId);
    }
  }, [modelId, isLoaded, loadForModel]);

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
    
    // Position (x,y,z) — we'll set these to 0,0,0, and let the vertex shader use umapCoord
    const positions = new Float32Array(vocabSize * 3);
    const tokenIndices = new Float32Array(vocabSize);
    const isRagGrounded = new Float32Array(vocabSize);

    for (let i = 0; i < vocabSize; i++) {
        tokenIndices[i] = i;
        isRagGrounded[i] = 0; // Will be updated later if needed
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
    // Initialize with small base probability to make tokens visible but flat
    for(let i=0; i<probabilityData.length; i+=2) {
        probabilityData[i] = 0.0001;   // R
        probabilityData[i+1] = 0.0001; // G
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
    const clock = new THREE.Clock();

    const render = () => {
        animationFrameId = requestAnimationFrame(render);
        controls.update();
        if (pointsRef.current) {
            (pointsRef.current.material as THREE.ShaderMaterial).uniforms.time.value = clock.getElapsedTime();
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

    return () => {
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
    
    const material = pointsRef.current.material as THREE.ShaderMaterial;
    const texture = material.uniforms.probabilityTexture.value as THREE.DataTexture;
    const data = texture.image.data as Float32Array;
    
    // Convert logits to probabilities (Softmax)
    let maxLogit = -Infinity;
    let argmaxIndex = 0;
    for (let i = 0; i < latestLogits.length; i++) {
        if (latestLogits[i] > maxLogit) {
            maxLogit = latestLogits[i];
            argmaxIndex = i;
        }
    }
    
    let sumExpActive = 0;
    let sumExpBase = 0;
    const temp = Math.max(params.temperature, 0.01);
    const baseTemp = 1.0; // Baseline temperature
    
    for (let i = 0; i < latestLogits.length; i++) {
        const valActive = Math.exp((latestLogits[i] - maxLogit) / temp);
        const valBase = Math.exp((latestLogits[i] - maxLogit) / baseTemp);
        
        data[i * 2] = valActive;
        data[i * 2 + 1] = valBase;
        
        sumExpActive += valActive;
        sumExpBase += valBase;
    }
    
    for (let i = 0; i < latestLogits.length; i++) {
        data[i * 2] /= sumExpActive;
        data[i * 2 + 1] /= sumExpBase;
    }
    
    argmaxIndexRef.current = argmaxIndex;
    material.uniforms.greedyAnchorIndex.value = argmaxIndex;
    material.uniforms.uIsThinking.value = isThinking ? 1.0 : 0.0;
    texture.needsUpdate = true;
  }, [latestLogits, isLoaded, params.temperature, isThinking]);

  return (
    <div className="w-full h-full relative group">
        <div ref={containerRef} className="absolute inset-0 cursor-move" />
        
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
