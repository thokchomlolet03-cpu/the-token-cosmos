import React from 'react';
import { ProcessedTokenCandidate } from '../types/sampling';

interface ZenViewportHUDProps {
  modelId?: string | null;
  status: string;
  stepIndex?: number;
  totalTokens?: number;
  topCandidate?: ProcessedTokenCandidate | null;
  isLassoActive: boolean;
  onToggleLasso: () => void;
  onResetCamera: () => void;
}

export const ZenViewportHUD: React.FC<ZenViewportHUDProps> = ({
  modelId,
  status,
  stepIndex = 0,
  topCandidate,
  isLassoActive,
  onToggleLasso,
  onResetCamera,
}) => {
  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2">
      {/* Top Telemetry Strip */}
      <div className="flex items-center gap-3 bg-slate-950/80 backdrop-blur-md border border-slate-800/80 px-3.5 py-1.5 rounded-lg text-slate-200 shadow-lg pointer-events-auto">
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
            {modelId || 'Synthetic Engine'}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
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

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
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

          <button
            onClick={onResetCamera}
            className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors"
            title="Reset 3D Orbit Camera"
          >
            Reset Orbit
          </button>
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="text-[10px] font-mono text-slate-500 px-1 drop-shadow">
        Hold <kbd className="bg-slate-900/90 text-slate-300 px-1 py-0.5 rounded border border-slate-800">Shift</kbd> + Drag to draw 2D spatial lasso on terrain
      </div>
    </div>
  );
};
