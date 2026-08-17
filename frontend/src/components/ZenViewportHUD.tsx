/* ─────────────────────────────────────────────────────────────────────
 * ZenViewportHUD.tsx — Dual-Persona Viewport HUD & Environmental Telemetry
 * Supports Executive "AI Flight Simulator" and Senior "Diagnostic Command"
 * The Token Cosmos v4.8
 * ───────────────────────────────────────────────────────────────────── */

import React from 'react';
import { ProcessedTokenCandidate } from '../types/sampling';

export type CosmosPersona = 'flight_sim' | 'diagnostic';

interface ZenViewportHUDProps {
  modelId?: string | null;
  status: string;
  stepIndex?: number;
  totalTokens?: number;
  topCandidate?: ProcessedTokenCandidate | null;
  isLassoActive: boolean;
  isFullscreen?: boolean;
  persona?: CosmosPersona;
  temperature?: number;
  minP?: number;
  onToggleLasso: () => void;
  onResetCamera: () => void;
  onToggleFullscreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onTogglePersona?: () => void;
  onOpenEnterpriseLabs?: () => void;
}

export const ZenViewportHUD: React.FC<ZenViewportHUDProps> = ({
  modelId,
  status,
  stepIndex = 0,
  topCandidate,
  isLassoActive,
  isFullscreen = false,
  persona = 'flight_sim',
  temperature = 1.0,
  minP = 0.05,
  onToggleLasso,
  onResetCamera,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onTogglePersona,
  onOpenEnterpriseLabs,
}) => {
  const isFlightSim = persona === 'flight_sim';

  return (
    <div className="absolute top-4 left-4 z-30 pointer-events-none flex flex-col gap-2 max-w-[95vw]">
      {/* Top Telemetry & Control Strip */}
      <div className="flex items-center flex-wrap gap-2.5 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 px-3.5 py-1.5 rounded-xl text-slate-200 shadow-2xl pointer-events-auto">
        
        {/* Persona Mode Switcher Badge */}
        {onTogglePersona && (
          <button
            onClick={onTogglePersona}
            className={`px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-bold tracking-wider transition-all flex items-center gap-1.5 border ${
              isFlightSim
                ? 'bg-gradient-to-r from-cyan-950 to-blue-950 text-cyan-300 border-cyan-700/60 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                : 'bg-gradient-to-r from-purple-950 to-indigo-950 text-purple-300 border-purple-700/60 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
            }`}
            title="Click to toggle between Executive Flight Simulator & Diagnostic Command Center"
          >
            <span>{isFlightSim ? '✈ FLIGHT SIMULATOR' : '🔬 DIAGNOSTIC COMMAND'}</span>
          </button>
        )}

        <div className="h-3 w-px bg-slate-800" />

        {/* Model Status Beacon */}
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

        {/* Step Indicator */}
        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <span className="text-slate-500 uppercase text-[9px]">STEP</span>
          <span className="text-slate-200 font-bold">#{stepIndex}</span>
        </div>

        {/* Target Candidate Beacon */}
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

        {/* Environmental Physics Telemetry */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          <span title="Thermodynamic Temperature Peak Scaling">
            <strong className="text-amber-400">T:</strong> {temperature.toFixed(2)}
          </span>
          <span className="text-slate-700">|</span>
          <span title="Waterline Sea Level Cutoff">
            <strong className="text-cyan-400">Min-P:</strong> {(minP * 100).toFixed(1)}%
          </span>
        </div>

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

          {/* Enterprise Labs Launcher */}
          {onOpenEnterpriseLabs && (
            <button
              onClick={onOpenEnterpriseLabs}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 hover:text-white border border-indigo-700/60 transition-all font-semibold shadow-[0_0_10px_rgba(99,102,241,0.25)]"
              title="Open Enterprise Training Missions & Certification Labs"
            >
              🎓 Labs
            </button>
          )}

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

      {/* Interactive Navigation & Persona Hints */}
      <div className="text-[10px] font-mono text-slate-400 px-1 drop-shadow flex items-center flex-wrap gap-3">
        {isFlightSim ? (
          <>
            <span><strong className="text-cyan-300">Flight Simulator:</strong> Watch Temperature erode glaciers & Min-P flood valleys</span>
            <span><strong className="text-slate-300">Shift + Drag:</strong> Lasso Cluster</span>
          </>
        ) : (
          <>
            <span><strong className="text-purple-300">Diagnostic Command:</strong> 3D DDA Line-of-Sight Occlusion & Shannon Entropy</span>
            <span><strong className="text-slate-300">L/R Drag:</strong> Orbit/Pan</span>
          </>
        )}
      </div>
    </div>
  );
};
