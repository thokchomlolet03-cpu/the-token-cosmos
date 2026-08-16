import React, { useRef, useEffect, useCallback } from 'react';
import { ScreenPolygonPoint } from '../types/spatial';

interface LassoSelectionToolProps {
  enabled: boolean;
  onLassoComplete: (points: ScreenPolygonPoint[], centroid: { x: number; y: number }) => void;
  onCameraLockChange: (locked: boolean) => void;
}

export const LassoSelectionTool: React.FC<LassoSelectionToolProps> = ({
  enabled,
  onLassoComplete,
  onCameraLockChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const pointsRef = useRef<ScreenPolygonPoint[]>([]);
  const isShiftPressedRef = useRef<boolean>(false);

  // High-DPI Canvas Resize helper
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  useEffect(() => {
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);
    return () => window.removeEventListener('resize', syncCanvasSize);
  }, [syncCanvasSize]);

  // 60 FPS Direct 2D Canvas Renderer (Zero React Re-render)
  const drawPolyline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    ctx.clearRect(0, 0, rect.width, rect.height);

    const pts = pointsRef.current;
    if (pts.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }

    // Glowing Neon Stroke
    ctx.strokeStyle = '#06B6D4'; // Cyan
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#06B6D4';
    ctx.shadowBlur = 8;
    ctx.stroke();

    // Translucent Polygon Fill
    if (pts.length > 2) {
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.fill();
    }
    ctx.restore();
  }, []);

  // Keyboard Shift Listeners (Lock camera inertia)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = true;
        onCameraLockChange(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftPressedRef.current = false;
        if (!isDrawingRef.current) {
          onCameraLockChange(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onCameraLockChange]);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!enabled && !isShiftPressedRef.current && !e.shiftKey) return;

    isDrawingRef.current = true;
    onCameraLockChange(true);

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    pointsRef.current = [{ x, y }];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Minimum distance threshold to prevent redundant points
    const last = pointsRef.current[pointsRef.current.length - 1];
    if (!last || Math.hypot(x - last.x, y - last.y) > 4) {
      pointsRef.current.push({ x, y });
      drawPolyline();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (!isShiftPressedRef.current) {
      onCameraLockChange(false);
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_ignored) {}

    const pts = pointsRef.current;
    if (pts.length >= 3) {
      // Calculate 2D centroid for drawer positioning
      let sumX = 0;
      let sumY = 0;
      for (let i = 0; i < pts.length; i++) {
        sumX += pts[i].x;
        sumY += pts[i].y;
      }
      const centroid = { x: sumX / pts.length, y: sumY / pts.length };

      onLassoComplete(pts, centroid);
    }

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    }
    pointsRef.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 z-20 pointer-events-auto touch-none ${
        enabled || isShiftPressedRef.current ? 'cursor-crosshair' : 'pointer-events-none'
      }`}
      style={{ width: '100%', height: '100%' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
};
