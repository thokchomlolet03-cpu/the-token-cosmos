import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { Anchor, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface StarfieldCanvasProps {
  candidates: ProcessedTokenCandidate[];
  params: SamplingParameters;
  ragEnabled: boolean;
  onSelectToken?: (token: ProcessedTokenCandidate) => void;
  title?: string;
  subtitle?: string;
}

interface PhysicsNode {
  id: string;
  candidate: ProcessedTokenCandidate;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isCenter: boolean;
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  candidates,
  params,
  ragEnabled,
  onSelectToken,
  title = "The Token Cosmos",
  subtitle = "WebGL GPU Hardware-Accelerated Force Field",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Viewport Zoom & Pan Transformation State
  const [scale, setScale] = useState<number>(1.0);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);

  // Dragging / Panning State
  const isDraggingRef = useRef<boolean>(false);
  const startPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [hoveredCandidate, setHoveredCandidate] = useState<{
    candidate: ProcessedTokenCandidate;
    screenX: number;
    screenY: number;
  } | null>(null);

  const physicsNodesRef = useRef<Map<string, PhysicsNode>>(new Map());

  // WebGL Three.js References
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    nodesGroup: THREE.Group;
    linksGroup: THREE.Group;
    raycaster: THREE.Raycaster;
  } | null>(null);

  // Initialize WebGL Three.js Renderer Context
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    // 1. Create Hardware-Accelerated WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x1c1c21, 1.0); // Cosmograph Deep Charcoal Void (#1c1c21)

    // 2. Setup 2D/3D Orthographic Camera
    const aspect = width / height;
    const frustumSize = 600;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    camera.position.z = 10;

    // 3. Create WebGL Scene & Groups
    const scene = new THREE.Scene();
    const linksGroup = new THREE.Group();
    const nodesGroup = new THREE.Group();
    scene.add(linksGroup);
    scene.add(nodesGroup);

    const raycaster = new THREE.Raycaster();

    threeRef.current = {
      renderer,
      scene,
      camera,
      nodesGroup,
      linksGroup,
      raycaster,
    };

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current || !threeRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      const asp = w / h;
      threeRef.current.renderer.setSize(w, h);
      threeRef.current.camera.left = (-frustumSize * asp) / 2;
      threeRef.current.camera.right = (frustumSize * asp) / 2;
      threeRef.current.camera.top = frustumSize / 2;
      threeRef.current.camera.bottom = -frustumSize / 2;
      threeRef.current.camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Zoom & Pan Handlers
  const zoomIn = () => setScale(s => Math.min(5.0, s * 1.25));
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.25));
  const resetView = () => {
    setScale(1.0);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale(s => Math.min(5.0, Math.max(0.3, s * zoomFactor)));
  };

  const handleDoubleClick = () => {
    resetView();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;

    if (hoveredCandidate && onSelectToken) {
      onSelectToken(hoveredCandidate.candidate);
      return;
    }

    isDraggingRef.current = true;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { x: offsetX, y: offsetY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !threeRef.current) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;
      setOffsetX(startOffsetRef.current.x + dx);
      setOffsetY(startOffsetRef.current.y + dy);
      return;
    }

    // WebGL Raycasting Collision Detection
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const screenPositions = (canvas as any)._screenPositions;
    if (!screenPositions) return;

    let found = null;
    for (const item of screenPositions) {
      const dx = screenX - item.screenX;
      const dy = screenY - item.screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= item.screenSize + 10) {
        found = {
          candidate: item.candidate,
          screenX: item.screenX,
          screenY: item.screenY,
        };
        break;
      }
    }

    setHoveredCandidate(found);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // WebGL GPU Render Loop & N-Body Force Physics Integration
  useEffect(() => {
    const three = threeRef.current;
    if (!three) return;

    let isSubscribed = true;
    let animationFrameId: number;

    // Sync candidates to physics node state
    const currentNodesMap = physicsNodesRef.current;
    if (candidates && candidates.length > 0) {
      candidates.forEach((c, index) => {
        const id = `${c.token_id}_${c.token_str}_${index}`;
        const isCenter = index === 0;

        if (!currentNodesMap.has(id)) {
          const angle = c.orbitAngle || Math.random() * Math.PI * 2;
          const initialDist = isCenter ? 0 : Math.max(40, c.orbitRadius || 100);
          currentNodesMap.set(id, {
            id,
            candidate: c,
            x: Math.cos(angle) * initialDist,
            y: Math.sin(angle) * initialDist,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: isCenter ? 14 : Math.max(3, Math.sqrt(c.probability) * 12 + 2),
            isCenter,
          });
        } else {
          const existing = currentNodesMap.get(id)!;
          existing.candidate = c;
          existing.radius = isCenter ? 14 : Math.max(3, Math.sqrt(c.probability) * 12 + 2);
        }
      });
    }

    const renderLoop = () => {
      if (!isSubscribed || !threeRef.current) return;

      const { renderer, scene, camera, nodesGroup, linksGroup } = threeRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Run Force Physics Integration
      const nodeList = Array.from(currentNodesMap.values());
      const tempFactor = Math.max(0.1, params.temperature);
      const kGrav = 0.08 / tempFactor;
      const kRep = 800 * (1 + params.frequencyPenalty);

      for (let i = 0; i < nodeList.length; i++) {
        const nodeA = nodeList[i];
        if (nodeA.isCenter) continue;

        let fx = 0;
        let fy = 0;

        const targetRadius = Math.max(35, (1 - nodeA.candidate.probability) * 180);
        const currentDist = Math.sqrt(nodeA.x * nodeA.x + nodeA.y * nodeA.y) || 1;
        const radialDiff = currentDist - targetRadius;
        const radialForce = -radialDiff * kGrav;

        fx += (nodeA.x / currentDist) * radialForce;
        fy += (nodeA.y / currentDist) * radialForce;

        for (let j = 0; j < nodeList.length; j++) {
          if (i === j) continue;
          const nodeB = nodeList[j];
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const distSq = dx * dx + dy * dy + 10;
          const dist = Math.sqrt(distSq);

          if (dist < 140) {
            const repForce = kRep / distSq;
            fx += (dx / dist) * repForce;
            fy += (dy / dist) * repForce;
          }
        }

        nodeA.vx = (nodeA.vx + fx * 0.016) * 0.85;
        nodeA.vy = (nodeA.vy + fy * 0.016) * 0.85;

        nodeA.x += nodeA.vx;
        nodeA.y += nodeA.vy;
      }

      // Update Camera Pan/Zoom
      camera.position.x = -offsetX / scale;
      camera.position.y = offsetY / scale;
      camera.zoom = scale;
      camera.updateProjectionMatrix();

      // 2. Clear Scene Children and Rebuild WebGL Buffers
      while (nodesGroup.children.length > 0) {
        const child = nodesGroup.children.pop();
        if (child && (child as THREE.Mesh).geometry) {
          (child as THREE.Mesh).geometry.dispose();
        }
      }
      while (linksGroup.children.length > 0) {
        const child = linksGroup.children.pop();
        if (child && (child as THREE.Line).geometry) {
          (child as THREE.Line).geometry.dispose();
        }
      }

      const transformedCenterX = centerX + offsetX;
      const transformedCenterY = centerY + offsetY;
      const screenPositions: { candidate: ProcessedTokenCandidate; screenX: number; screenY: number; screenSize: number }[] = [];

      // 3. Build WebGL Link Lines
      nodeList.forEach(node => {
        if (node.isCenter) return;

        const isHovered = hoveredCandidate?.candidate.token_id === node.candidate.token_id && hoveredCandidate?.candidate.token_str === node.candidate.token_str;
        const isDimmed = hoveredCandidate !== null && !isHovered;

        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(node.x, -node.y, 0)];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

        let colorHex = 0xffffff;
        let opacity = isDimmed ? 0.02 : 0.05;

        if (ragEnabled && node.candidate.is_rag_grounded) {
          colorHex = 0x06b6d4;
          opacity = isDimmed ? 0.15 : 0.50;
        }

        const lineMat = new THREE.LineBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity,
          linewidth: isHovered ? 2 : 1,
        });

        const line = new THREE.Line(lineGeo, lineMat);
        linksGroup.add(line);
      });

      // 4. Build WebGL Node Sprites
      nodeList.forEach(node => {
        const c = node.candidate;
        const worldX = node.isCenter ? 0 : node.x;
        const worldY = node.isCenter ? 0 : -node.y;

        const px = node.isCenter ? transformedCenterX : transformedCenterX + node.x * scale;
        const py = node.isCenter ? transformedCenterY : transformedCenterY + node.y * scale;
        const screenSize = Math.max(2, node.radius * Math.sqrt(scale));

        screenPositions.push({ candidate: c, screenX: px, screenY: py, screenSize });

        const isHovered = hoveredCandidate?.candidate.token_id === c.token_id && hoveredCandidate?.candidate.token_str === c.token_str;
        const isDimmed = hoveredCandidate !== null && !isHovered && !node.isCenter;
        const alpha = isDimmed ? 0.10 : 1.0;

        let nodeColor = 0x555555;
        if (node.isCenter) nodeColor = 0xffffff;
        else if (c.rank === 1) nodeColor = 0xec4899; // Cosmograph Magenta (#ec4899)
        else if (c.is_rag_grounded) nodeColor = 0x06b6d4;
        else if (c.isFiltered) nodeColor = 0x222222;
        else if (c.filterReason === 'Banned') nodeColor = 0xef4444;

        const circleGeo = new THREE.CircleGeometry(node.radius, 32);
        const circleMat = new THREE.MeshBasicMaterial({
          color: nodeColor,
          transparent: true,
          opacity: alpha,
        });

        const mesh = new THREE.Mesh(circleGeo, circleMat);
        mesh.position.set(worldX, worldY, 0);
        nodesGroup.add(mesh);
      });

      // Render WebGL Frame
      renderer.render(scene, camera);

      (canvas as any)._screenPositions = screenPositions;
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      isSubscribed = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [candidates, params, ragEnabled, scale, offsetX, offsetY, hoveredCandidate]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] rounded-xl glass-panel-matte overflow-hidden flex flex-col select-none"
    >
      {/* Canvas Top Overlay Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            <span>{title}</span>
            <span className="rounded-full bg-pink-500/20 px-2.5 py-0.5 text-[10px] font-mono text-pink-300 border border-pink-500/30">
              WebGL GPU
            </span>
          </h3>
          <p className="text-xs text-gray-400 font-mono">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] bg-[#232329]/90 px-3 py-1.5 rounded-lg border border-white/10 font-mono">
          <div className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-[#ec4899]" />
            <span className="text-gray-300">Winner Candidate</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-[#06b6d4]" />
            <span className="text-gray-300">RAG Grounded</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
            <span className="text-gray-300">Black-Hole Banned</span>
          </div>
        </div>
      </div>

      {/* WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full cursor-grab active:cursor-grabbing flex-1"
      />

      {/* Viewport Navigation Overlay Controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2 bg-[#0A0A0A]/90 p-1.5 rounded-lg border border-white/10">
        <button
          onClick={zoomIn}
          aria-label="Zoom in starfield universe"
          className="p-1.5 rounded-md bg-black text-gray-300 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <button
          onClick={zoomOut}
          aria-label="Zoom out starfield universe"
          className="p-1.5 rounded-md bg-black text-gray-300 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <button
          onClick={resetView}
          aria-label="Reset viewport zoom and pan"
          className="p-1.5 rounded-md bg-black text-gray-300 hover:text-white transition-colors"
          title="Reset View (Scale 100%)"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <span className="text-xs font-mono font-medium text-white px-1 min-w-[42px] text-center">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* Hover Candidate Tooltip Overlay */}
      {hoveredCandidate && (
        <div
          style={{
            position: 'absolute',
            left: `${hoveredCandidate.screenX + 14}px`,
            top: `${hoveredCandidate.screenY - 20}px`,
            pointerEvents: 'none',
          }}
          className="z-30 rounded-lg bg-[#0A0A0A] border border-white/15 px-3 py-2 text-xs font-mono shadow-2xl text-gray-100 backdrop-blur-md animate-in fade-in duration-100 min-w-[180px]"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5">
            <span className="font-bold text-white text-sm">
              "{hoveredCandidate.candidate.token_str.trim()}"
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              Rank #{hoveredCandidate.candidate.rank}
            </span>
          </div>

          <div className="space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-400">Probability:</span>
              <span className="font-bold text-white">
                {(hoveredCandidate.candidate.probability * 100).toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-400">Adjusted Logit:</span>
              <span className="text-gray-300 font-mono">
                {hoveredCandidate.candidate.adjusted_logit.toFixed(3)}
              </span>
            </div>

            {hoveredCandidate.candidate.is_rag_grounded && (
              <div className="mt-1 flex items-center space-x-1 text-[#06b6d4] font-medium">
                <Anchor className="h-3 w-3" />
                <span>RAG Fact Grounded</span>
              </div>
            )}

            {hoveredCandidate.candidate.isFiltered && (
              <div className="mt-1 text-rose-400 font-medium">
                Filtered: {hoveredCandidate.candidate.filterReason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
