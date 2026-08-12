import React, { useRef, useEffect, useState } from 'react';
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
  subtitle = "Candidate Vocabulary Force Physics Field",
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
  const animationFrameIdRef = useRef<number | null>(null);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Zoom handlers
  const zoomIn = () => setScale(s => Math.min(5.0, s * 1.25));
  const zoomOut = () => setScale(s => Math.max(0.3, s / 1.25));
  const resetView = () => {
    setScale(1.0);
    setOffsetX(0);
    setOffsetY(0);
  };

  // Mouse wheel zoom listener (Wheel / Pinch)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setScale(s => Math.min(5.0, Math.max(0.3, s * zoomFactor)));
  };

  // Double click reset view listener
  const handleDoubleClick = () => {
    resetView();
  };

  // Pointer Down (Start dragging or selecting)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only primary left mouse button

    if (hoveredCandidate && onSelectToken) {
      onSelectToken(hoveredCandidate.candidate);
      return;
    }

    isDraggingRef.current = true;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startOffsetRef.current = { x: offsetX, y: offsetY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move (Pan or Hover)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - startPointerRef.current.x;
      const dy = e.clientY - startPointerRef.current.y;
      setOffsetX(startOffsetRef.current.x + dx);
      setOffsetY(startOffsetRef.current.y + dy);
      return;
    }

    // Hover Tooltip Collision Detection
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const screenPositions = (canvas as any)._screenPositions;
    if (!screenPositions) return;

    let found = null;
    for (const item of screenPositions) {
      const dx = mx - item.screenX;
      const dy = my - item.screenY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= item.screenSize + 8) {
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

  // Pointer Up (Stop dragging)
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
  };

  // 60 FPS Real-time Force Physics Simulation & Developer Matte Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    // Sync candidate tokens with persistent physics nodes
    const currentNodesMap = physicsNodesRef.current;
    if (candidates && candidates.length > 0) {
      candidates.forEach((c, index) => {
        const id = `${c.token_id}_${c.token_str}_${index}`;
        const isCenter = index === 0;

        if (!currentNodesMap.has(id)) {
          // Initialize new node position along initial radial layout
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
          // Update candidate reference and radius
          const existing = currentNodesMap.get(id)!;
          existing.candidate = c;
          existing.radius = isCenter ? 14 : Math.max(3, Math.sqrt(c.probability) * 12 + 2);
        }
      });
    }

    const render = () => {
      if (!isSubscribed) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Run Force Physics Integration (N-body Repulsion + Gravity Well)
      const nodeList = Array.from(currentNodesMap.values());
      const tempFactor = Math.max(0.1, params.temperature);

      // Physics Constants
      const kGrav = 0.08 / tempFactor; // Gravity pull increases at lower temperatures
      const kRep = 800 * (1 + params.frequencyPenalty); // Coulomb repulsion prevents label overlap

      for (let i = 0; i < nodeList.length; i++) {
        const nodeA = nodeList[i];
        if (nodeA.isCenter) continue; // Center core is fixed at origin (0, 0)

        let fx = 0;
        let fy = 0;

        // A. Hooke's Gravitational Pull toward Center Core (0, 0)
        const targetRadius = Math.max(35, (1 - nodeA.candidate.probability) * 180);
        const currentDist = Math.sqrt(nodeA.x * nodeA.x + nodeA.y * nodeA.y) || 1;
        const radialDiff = currentDist - targetRadius;
        const radialForce = -radialDiff * kGrav;

        fx += (nodeA.x / currentDist) * radialForce;
        fy += (nodeA.y / currentDist) * radialForce;

        // B. Pairwise Coulomb Repulsion between sibling candidate nodes
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

        // C. Apply acceleration & damped velocity integration (settling factor 0.85)
        nodeA.vx = (nodeA.vx + fx * 0.016) * 0.85;
        nodeA.vy = (nodeA.vy + fy * 0.016) * 0.85;

        nodeA.x += nodeA.vx;
        nodeA.y += nodeA.vy;
      }

      // 2. Render Developer Matte Canvas Frame
      ctx.clearRect(0, 0, width, height);

      // Render static background void dust
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      for (let i = 0; i < 30; i++) {
        const sx = (Math.sin(i * 99) * 0.5 + 0.5) * width;
        const sy = (Math.cos(i * 33) * 0.5 + 0.5) * height;
        ctx.fillRect(sx, sy, 1, 1);
      }

      ctx.save();

      // Transform Matrix: Origin at Center + Pan Offset, then Scale
      const transformedCenterX = centerX + offsetX;
      const transformedCenterY = centerY + offsetY;

      const screenPositions: { candidate: ProcessedTokenCandidate; screenX: number; screenY: number; screenSize: number }[] = [];

      // 3. Render Link Tethers (Ultra-faint gridlines & RAG Cyan Fact Beams)
      nodeList.forEach(node => {
        if (node.isCenter) return;

        const px = transformedCenterX + node.x * scale;
        const py = transformedCenterY + node.y * scale;

        const isHovered = hoveredCandidate?.candidate.token_id === node.candidate.token_id && hoveredCandidate?.candidate.token_str === node.candidate.token_str;
        const isDimmed = hoveredCandidate !== null && !isHovered;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(transformedCenterX, transformedCenterY);
        ctx.lineTo(px, py);

        if (ragEnabled && node.candidate.is_rag_grounded) {
          ctx.strokeStyle = isDimmed ? 'rgba(6, 182, 212, 0.15)' : 'rgba(6, 182, 212, 0.50)';
          ctx.lineWidth = (isHovered ? 2.5 : 1.5) * Math.sqrt(scale);
        } else {
          ctx.strokeStyle = isDimmed ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1 * Math.sqrt(scale);
        }

        ctx.stroke();
        ctx.restore();
      });

      // 4. Render Physics Token Nodes
      nodeList.forEach(node => {
        const c = node.candidate;
        const px = node.isCenter ? transformedCenterX : transformedCenterX + node.x * scale;
        const py = node.isCenter ? transformedCenterY : transformedCenterY + node.y * scale;
        const screenSize = Math.max(2, node.radius * Math.sqrt(scale));

        screenPositions.push({ candidate: c, screenX: px, screenY: py, screenSize });

        // Subtractive Focus Dimming (Non-hovered nodes fade to 10% opacity)
        const isHovered = hoveredCandidate?.candidate.token_id === c.token_id && hoveredCandidate?.candidate.token_str === c.token_str;
        const isDimmed = hoveredCandidate !== null && !isHovered && !node.isCenter;
        const alpha = isDimmed ? 0.10 : 1.0;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Banned Token / Black Hole Treatment
        if (c.filterReason === 'Banned') {
          ctx.beginPath();
          ctx.arc(px, py, screenSize + 2, 0, Math.PI * 2);
          ctx.fillStyle = '#111111';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          ctx.font = `${Math.max(8, 10 * Math.sqrt(scale))}px JetBrains Mono`;
          ctx.fillStyle = '#ef4444';
          ctx.textAlign = 'center';
          ctx.fillText('❌', px, py + 3);
          ctx.restore();
          return;
        }

        // Draw Solid Matte Node Body
        ctx.beginPath();
        ctx.arc(px, py, screenSize, 0, Math.PI * 2);

        if (node.isCenter) {
          ctx.fillStyle = '#ffffff'; // Solid white core
        } else if (c.rank === 1) {
          ctx.fillStyle = '#10b981'; // Flat matte emerald for winner
        } else if (c.is_rag_grounded) {
          ctx.fillStyle = '#06b6d4'; // Flat matte cyan for RAG fact
        } else if (c.isFiltered) {
          ctx.fillStyle = '#222222'; // Muted dark gray for out-of-bounds
        } else {
          ctx.fillStyle = '#555555'; // Medium gray for active candidates
        }

        ctx.fill();

        // White border ring for active/hovered node
        if (isHovered || node.isCenter) {
          ctx.beginPath();
          ctx.arc(px, py, screenSize + 3 * Math.sqrt(scale), 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5 * Math.sqrt(scale);
          ctx.stroke();
        }

        // Draw Token Text Labels
        if (node.isCenter || c.rank <= 10 || c.is_rag_grounded || isHovered || scale > 1.8) {
          const fontSize = Math.max(9, (node.isCenter ? 13 : 11) * Math.min(1.5, Math.sqrt(scale)));
          ctx.font = node.isCenter ? `bold ${fontSize}px JetBrains Mono` : `${fontSize}px JetBrains Mono`;
          ctx.fillStyle = c.isFiltered ? '#666666' : '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(`"${c.token_str.trim()}"`, px, py + screenSize + 14 * Math.sqrt(scale));

          if (!node.isCenter && !c.isFiltered && c.probability > 0.01) {
            ctx.font = `${Math.max(8, 10 * Math.min(1.5, Math.sqrt(scale)))}px Inter`;
            ctx.fillStyle = c.is_rag_grounded ? '#06b6d4' : '#9ca3af';
            ctx.fillText(`${(c.probability * 100).toFixed(1)}%`, px, py + screenSize + 26 * Math.sqrt(scale));
          }
        }

        ctx.restore();
      });

      ctx.restore();

      // Save screen positions for hover pointer check
      (canvas as any)._screenPositions = screenPositions;

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isSubscribed = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
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
            <span className="h-2 w-2 rounded-full bg-white" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-gray-400 font-mono">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] bg-[#0A0A0A]/90 px-3 py-1.5 rounded-lg border border-white/10 font-mono">
          <div className="flex items-center space-x-1">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" />
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

      {/* HTML5 Canvas with Wheel Zoom and Pan Handlers */}
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

      {/* Viewport Navigation Overlay Controls (Zoom & Pan Controls) */}
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
