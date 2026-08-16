import React from 'react';
import { ProcessedTokenCandidate } from '../types/sampling';

interface ZenViewportHUDProps {
  modelId?: string | null;
  status: string;
  stepIndex?: number;
  totalTokens?: number;
  topCandidate?: ProcessedTokenCandidate | null;
  isLassoActive: boolean;
  isFullscreen?: boolean;
  onToggleLasso: () => void;
  onResetCamera: () => void;
  onToggleFullscreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
}

export const ZenViewportHUD: React.FC<ZenViewportHUDProps> = ({
  modelId,
  status,
  stepIndex = 0,
  topCandidate,
  isLassoActive,
  isFullscreen = false,
  onToggleLasso,
  onResetCamera,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
}) => {
  return (
    <div className="absolute top-4 left-4 z-30 pointer-events-none flex flex-col gap-2">
      {/* Top Telemetry & Control Strip */}
      <div className="flex items-center flex-wrap gap-2.5 bg-slate-950/85 backdrop-blur-md border border-slate-800/90 px-3.5 py-1.5 rounded-xl text-slate-200 shadow-2xl pointer-events-auto">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === 'generating'
                ? 'bg-emerald-400 animate-ping'
                : status === 'ready'
                ? 'bg-cyan-400'
                : 'bg-amber-400'
            }`}
          />
          <span className="font-mono text-xs font-semibold text-slate-100 tracking-wider">
            {modelId || 'Synthetic Cosmos'}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <span className="text-slate-500 uppercase text-[9px]">STEP</span>
          <span className="text-slate-200 font-bold">#{stepIndex}</span>
        </div>

        {topCandidate && (
          <>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500 uppercase text-[9px]">TARGET #1</span>
              <span className="text-emerald-400 font-bold">"{topCandidate.token_str}"</span>
              <span className="text-slate-400 text-[10px]">
                ({(topCandidate.probability * 100).toFixed(1)}%)
              </span>
            </div>
          </>
        )}

        <div className="h-3 w-px bg-slate-800" />

        {/* Viewport & Navigation Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Zoom In Button */}
          {onZoomIn && (
            <button
              onClick={onZoomIn}
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Zoom In"
            >
              +
            </button>
          )}

          {/* Zoom Out Button */}
          {onZoomOut && (
            <button
              onClick={onZoomOut}
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Zoom Out"
            >
              −
            </button>
          )}

          {/* Reset Orbit Button */}
          <button
            onClick={onResetCamera}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Reset 3D Orbit Camera"
          >
            Reset Orbit
          </button>

          {/* Lasso Toggle Button */}
          <button
            onClick={onToggleLasso}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
              isLassoActive
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
            title="Toggle 2D Lasso Selection (or hold Shift + Drag)"
          >
            Lasso [Shift]
          </button>

          {/* Fullscreen Toggle Button */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all flex items-center gap-1 ${
                isFullscreen
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              <span>{isFullscreen ? 'Exit FS' : '⛶ Fullscreen'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Navigation Hints */}
      <div className="text-[10px] font-mono text-slate-400 px-1 drop-shadow flex items-center gap-3">
        <span><strong className="text-slate-300">Left-Click + Drag:</strong> Orbit</span>
        <span><strong className="text-slate-300">Right-Click + Drag:</strong> Pan</span>
        <span><strong className="text-slate-300">Scroll:</strong> Zoom</span>
        <span><strong className="text-slate-300">Shift + Drag:</strong> Lasso</span>
      </div>
    </div>
  );
};
