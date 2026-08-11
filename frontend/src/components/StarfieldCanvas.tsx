import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { Anchor, Filter, ZoomIn, ZoomOut, RotateCcw, Move, Ban } from 'lucide-react';

interface StarfieldCanvasProps {
  candidates: ProcessedTokenCandidate[];
  params: SamplingParameters;
  ragEnabled: boolean;
  onSelectToken?: (token: ProcessedTokenCandidate) => void;
  title?: string;
  subtitle?: string;
}

export const StarfieldCanvas: React.FC<StarfieldCanvasProps> = ({
  candidates,
  params,
  ragEnabled,
  onSelectToken,
  title = "The Token Cosmos",
  subtitle = "Candidate Vocabulary Starfield",
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

  const animationFrameIdRef = useRef<number | null>(null);
  const rotationAngleRef = useRef<number>(0);

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

  // 60 FPS Render loop with Zoom & Pan Transformations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    const render = () => {
      if (!isSubscribed) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      // Slowly rotate outer asteroids
      rotationAngleRef.current += 0.0015;
      const globalRotation = rotationAngleRef.current;

      // Clear background space
      ctx.clearRect(0, 0, width, height);

      // Render static outer space dust
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let i = 0; i < 40; i++) {
        const sx = (Math.sin(i * 99 + globalRotation * 0.05) * 0.5 + 0.5) * width;
        const sy = (Math.cos(i * 33 + globalRotation * 0.05) * 0.5 + 0.5) * height;
        ctx.fillRect(sx, sy, 1, 1);
      }

      if (!candidates || candidates.length === 0) {
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Save context matrix before Applying Pan Offset and Zoom Scale
      ctx.save();

      // Transform Matrix: Origin at Center + Pan Offset, then Scale
      const transformedCenterX = centerX + offsetX;
      const transformedCenterY = centerY + offsetY;

      // 1. Draw Top-K Orbital Ring (Scaled)
      const topKCount = Math.min(params.topK, candidates.length);
      const topKCandidate = candidates[topKCount - 1];
      const topKRadius = (topKCandidate ? topKCandidate.orbitRadius + 20 : 200) * scale;

      ctx.save();
      ctx.beginPath();
      ctx.arc(transformedCenterX, transformedCenterY, topKRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.5 * Math.sqrt(scale);
      ctx.setLineDash([4 * scale, 4 * scale]);
      ctx.stroke();
      ctx.restore();

      // 2. Draw Top-P Energy Shield Ring (Scaled)
      const topPRadius = Math.min(180, topKRadius * params.topP + 30) * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(transformedCenterX, transformedCenterY, topPRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 2 * Math.sqrt(scale);
      ctx.shadowColor = 'rgba(168, 85, 247, 0.6)';
      ctx.shadowBlur = 10 * scale;
      ctx.stroke();
      ctx.restore();

      // 3. Draw Min-P Gravity Well Ring (Scaled)
      const minPRadius = Math.max(30, 220 * (1 - params.minP)) * scale;
      ctx.save();
      ctx.beginPath();
      ctx.arc(transformedCenterX, transformedCenterY, minPRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.25)';
      ctx.lineWidth = 1 * Math.sqrt(scale);
      ctx.stroke();
      ctx.restore();

      // Store screen positions for collision detection
      const screenPositions: { candidate: ProcessedTokenCandidate; screenX: number; screenY: number; screenSize: number }[] = [];

      // 4. Render RAG Cyan Fact Anchor Beams
      if (ragEnabled) {
        candidates.forEach(c => {
          if (c.is_rag_grounded) {
            const angle = c.orbitAngle + (c.rank === 1 ? 0 : globalRotation);
            const worldRadius = c.orbitRadius * scale;
            const px = transformedCenterX + Math.cos(angle) * worldRadius;
            const py = transformedCenterY + Math.sin(angle) * worldRadius;

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(transformedCenterX, transformedCenterY);
            ctx.lineTo(px, py);
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.7)';
            ctx.lineWidth = 2 * Math.sqrt(scale);
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 12 * scale;
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // 5. Render Celestial Tokens
      candidates.forEach((c, index) => {
        const isCenter = index === 0;
        const angle = c.orbitAngle + (isCenter ? 0 : globalRotation);
        const worldRadius = c.orbitRadius * scale;
        const px = transformedCenterX + Math.cos(angle) * worldRadius;
        const py = transformedCenterY + Math.sin(angle) * worldRadius;
        const screenSize = Math.max(2, c.size * Math.sqrt(scale));

        screenPositions.push({ candidate: c, screenX: px, screenY: py, screenSize });

        // Calculate opacity / dimming for Frequency Penalty ("The Exhaustion Meter")
        let alpha = 1.0;
        if (c.isHistorical && params.frequencyPenalty > 0) {
          const dimFactor = Math.min(0.85, (c.historicalCount || 1) * params.frequencyPenalty * 0.45);
          alpha = Math.max(0.15, 1.0 - dimFactor);
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        // Black Hole / Banned token visual treatment (Refinement 4)
        if (c.filterReason === 'Banned') {
          ctx.beginPath();
          ctx.arc(px, py, screenSize + 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
          ctx.strokeStyle = 'rgba(225, 29, 72, 0.6)';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();

          // Black Hole cross indicator
          ctx.font = `${Math.max(8, 10 * Math.sqrt(scale))}px JetBrains Mono`;
          ctx.fillStyle = '#f43f5e';
          ctx.textAlign = 'center';
          ctx.fillText('❌', px, py + 3);
          ctx.restore();
          return;
        }

        // Draw star orbital tether line to center if high probability
        if (!c.isFiltered && c.probability > 0.05 && !isCenter) {
          ctx.beginPath();
          ctx.moveTo(transformedCenterX, transformedCenterY);
          ctx.lineTo(px, py);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw glowing star body
        ctx.beginPath();
        ctx.arc(px, py, screenSize, 0, Math.PI * 2);

        if (!c.isFiltered) {
          ctx.fillStyle = c.color;
          ctx.shadowColor = c.color;
          ctx.shadowBlur = (isCenter ? 25 : 12) * Math.sqrt(scale);
        } else {
          ctx.fillStyle = 'rgba(71, 85, 105, 0.4)';
          ctx.shadowBlur = 0;
        }

        ctx.fill();

        // Supergiant outer ring flare
        if (isCenter) {
          ctx.beginPath();
          ctx.arc(px, py, screenSize + 6 * Math.sqrt(scale), 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 2 * Math.sqrt(scale);
          ctx.stroke();
        }

        // Draw token text label if top 12 or RAG grounded or zoomed in
        if (index < 12 || c.is_rag_grounded || scale > 1.8) {
          const fontSize = Math.max(9, (isCenter ? 13 : 11) * Math.min(1.5, Math.sqrt(scale)));
          ctx.font = isCenter ? `bold ${fontSize}px JetBrains Mono` : `${fontSize}px JetBrains Mono`;
          ctx.fillStyle = c.isFiltered ? 'rgba(148, 163, 184, 0.4)' : '#f8fafc';
          ctx.textAlign = 'center';
          ctx.fillText(`"${c.token_str.trim()}"`, px, py + screenSize + 14 * Math.sqrt(scale));

          if (!c.isFiltered && c.probability > 0.01) {
            ctx.font = `${Math.max(8, 10 * Math.min(1.5, Math.sqrt(scale)))}px Inter`;
            ctx.fillStyle = c.is_rag_grounded ? '#22d3ee' : '#94a3b8';
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
  }, [candidates, params, ragEnabled, scale, offsetX, offsetY]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[480px] rounded-2xl glass-panel overflow-hidden border border-cyan-500/20 shadow-2xl flex flex-col select-none"
    >
      {/* Canvas Top Overlay Header */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{title}</span>
          </h3>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-[11px] bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
          <div className="flex items-center space-x-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-300">Top Supergiant</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
            <span className="text-slate-300">RAG Grounded</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="text-slate-300">Black-Hole Banned</span>
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
      <div className="absolute bottom-4 right-4 z-20 flex items-center space-x-2 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 shadow-xl backdrop-blur-md">
        <button
          onClick={zoomIn}
          aria-label="Zoom in starfield universe"
          className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <span className="text-xs font-mono font-bold text-cyan-300 px-1 min-w-[42px] text-center">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={zoomOut}
          aria-label="Zoom out starfield universe"
          className="p-1.5 rounded-lg bg-slate-900 text-slate-300 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <button
          onClick={resetView}
          aria-label="Reset starfield zoom and pan coordinates"
          className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-mono transition-colors"
          title="Reset Camera View"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Navigation Hint Badge */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none hidden sm:flex items-center space-x-1.5 text-[10px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-lg border border-slate-800/80">
        <Move className="h-3 w-3 text-cyan-400" />
        <span>Scroll to Zoom • Drag to Pan • Double-click to Reset</span>
      </div>

      {/* Interactive Tooltip Card */}
      {hoveredCandidate && (
        <div
          className="absolute z-30 pointer-events-none transition-all duration-75"
          style={{
            left: `${Math.min(hoveredCandidate.screenX + 15, (containerRef.current?.clientWidth || 500) - 220)}px`,
            top: `${Math.min(hoveredCandidate.screenY + 15, (containerRef.current?.clientHeight || 400) - 160)}px`,
          }}
        >
          <div className="w-52 rounded-xl bg-slate-950/95 p-3 border border-cyan-500/30 shadow-neon-cyan backdrop-blur-md space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-mono text-sm font-bold text-cyan-300">
                "{hoveredCandidate.candidate.token_str}"
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Rank #{hoveredCandidate.candidate.rank}
              </span>
            </div>

            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Raw Logit (z_i):</span>
                <span className="font-bold text-amber-400">
                  {hoveredCandidate.candidate.raw_logit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Final Chance:</span>
                <span className="font-bold text-cyan-400">
                  {(hoveredCandidate.candidate.probability * 100).toFixed(2)}%
                </span>
              </div>

              {hoveredCandidate.candidate.isHistorical && (
                <div className="flex justify-between text-emerald-400 text-[11px]">
                  <span>Seen in Context:</span>
                  <span className="font-bold">{hoveredCandidate.candidate.historicalCount}x</span>
                </div>
              )}

              {hoveredCandidate.candidate.is_rag_grounded && (
                <div className="flex items-center space-x-1 text-[10px] text-cyan-300 bg-cyan-950/60 p-1 rounded border border-cyan-500/30">
                  <Anchor className="h-3 w-3 text-cyan-400" />
                  <span>RAG Fact Grounded</span>
                </div>
              )}

              {hoveredCandidate.candidate.filterReason === 'Banned' ? (
                <div className="flex items-center space-x-1 text-[10px] text-rose-300 bg-rose-950/60 p-1 rounded border border-rose-800/40">
                  <Ban className="h-3 w-3 text-rose-400" />
                  <span>Banned by Logit Bias (-100)</span>
                </div>
              ) : hoveredCandidate.candidate.isFiltered ? (
                <div className="flex items-center space-x-1 text-[10px] text-slate-300 bg-slate-900 p-1 rounded border border-slate-800">
                  <Filter className="h-3 w-3 text-slate-400" />
                  <span>Filtered out by {hoveredCandidate.candidate.filterReason}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
