/* ─────────────────────────────────────────────────────────────────────
 * ZenViewportHUD.tsx — AI Navigation Atlas Cartographic Viewport HUD
 * Google Maps Navigation Controls, Altitude Telemetry & Persona Toggles
 * The Token Cosmos // AI Navigation Atlas
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
  is2DView?: boolean;
  onToggle2DView?: () => void;
  onResetNorth?: () => void;
  onToggleLasso: () => void;
  onResetCamera: () => void;
  onToggleFullscreen?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onTogglePersona?: () => void;
  onOpenEnterpriseLabs?: () => void;
  onOpenMultiModel?: () => void;
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
  is2DView = false,
  onToggle2DView,
  onResetNorth,
  onToggleLasso,
  onResetCamera,
  onToggleFullscreen,
  onZoomIn,
  onZoomOut,
  onTogglePersona,
  onOpenEnterpriseLabs,
  onOpenMultiModel,
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
            title="Toggle between Topographical Navigation Atlas and Deep Metric Diagnostics"
          >
            <span>{isFlightSim ? '🧭 TOPOGRAPHIC ATLAS' : '🔬 METRIC DIAGNOSTICS'}</span>
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
            {modelId || 'Topography: Qwen / SmolLM'}
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        {/* Step Indicator */}
        <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <span className="text-slate-500 uppercase text-[9px]">WAYPOINT</span>
          <span className="text-slate-200 font-bold">#{stepIndex}</span>
        </div>

        {/* Target Candidate Beacon */}
        {topCandidate && (
          <>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-slate-500 uppercase text-[9px]">NEXT SUMMIT</span>
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
          <span title="Thermal Weather (Temperature Scale)">
            <strong className="text-amber-400">Temp:</strong> {temperature.toFixed(2)}
          </span>
          <span className="text-slate-700">|</span>
          <span title="Ocean Sea Level (Min-P Cutoff)">
            <strong className="text-cyan-400">Sea Level:</strong> {(minP * 100).toFixed(1)}%
          </span>
        </div>

        <div className="h-3 w-px bg-slate-800" />

        {/* Google Maps Viewport & Navigation Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* 2D Map vs 3D Perspective Mode */}
          {onToggle2DView && (
            <button
              onClick={onToggle2DView}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all font-semibold ${
                is2DView
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
              }`}
              title="Toggle between 2D Top-Down Cartographic Map and 3D Perspective Tilt"
            >
              {is2DView ? '🗺 2D MAP' : '🏔 3D TILT'}
            </button>
          )}

          {/* Compass / Reset North */}
          {onResetNorth && (
            <button
              onClick={onResetNorth}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Reset View to North (Top-Down Orientation)"
            >
              🧭 North
            </button>
          )}

          {/* Zoom In Button */}
          {onZoomIn && (
            <button
              onClick={onZoomIn}
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Zoom In (Altitude -25%)"
            >
              +
            </button>
          )}

          {/* Zoom Out Button */}
          {onZoomOut && (
            <button
              onClick={onZoomOut}
              className="w-6 h-6 flex items-center justify-center rounded text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Zoom Out (Altitude +33%)"
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
            Reset
          </button>

          {/* Lasso Toggle Button */}
          <button
            onClick={onToggleLasso}
            className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
              isLassoActive
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
            }`}
            title="Toggle 2D Region Selection (or hold Shift + Drag)"
          >
            Select [Shift]
          </button>

          {/* Enterprise Labs Launcher */}
          {onOpenEnterpriseLabs && (
            <button
              onClick={onOpenEnterpriseLabs}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 hover:text-white border border-indigo-700/60 transition-all font-semibold shadow-[0_0_10px_rgba(99,102,241,0.25)]"
              title="Open Enterprise Training Missions & Certification Labs"
            >
              🎓 Missions
            </button>
          )}

          {/* Multi-Model Split View Launcher */}
          {onOpenMultiModel && (
            <button
              onClick={onOpenMultiModel}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 hover:bg-purple-900 text-purple-200 hover:text-white border border-purple-700/60 transition-all font-semibold shadow-[0_0_10px_rgba(168,85,247,0.25)]"
              title="Compare Latent Topography of Multiple Models"
            >
              ⚖ Compare
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

      {/* Cartographic Navigation Guidance */}
      <div className="text-[10px] font-mono text-slate-400 px-1 drop-shadow flex items-center flex-wrap gap-3">
        <span><strong className="text-cyan-300">Latent Cartography:</strong> 5 Semantic Continents // Elevation = Probability Peaks</span>
        <span><strong className="text-amber-300">Thermal Weather:</strong> High Temp melts mountains into fog; Low Temp creates glacial spires</span>
        <span><strong className="text-sky-300">Sea Level:</strong> Min-P submerges noisy low-probability foothills</span>
      </div>
    </div>
  );
};
