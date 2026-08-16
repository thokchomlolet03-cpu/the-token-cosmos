import React from 'react';
import { ClusterMetrics } from '../types/spatial';

interface ClusterAnalyticsDrawerProps {
  metrics: ClusterMetrics | null;
  onClose: () => void;
  screenCentroid?: { x: number; y: number } | null;
}

export const ClusterAnalyticsDrawer: React.FC<ClusterAnalyticsDrawerProps> = ({
  metrics,
  onClose,
}) => {
  if (!metrics || metrics.tokenCount === 0) return null;

  return (
    <div
      className="absolute top-20 right-6 z-30 w-96 bg-slate-950/90 backdrop-blur-xl border border-cyan-500/30 rounded-xl shadow-2xl p-5 text-slate-100 animate-in fade-in slide-in-from-right-4 duration-300 pointer-events-auto"
      style={{ boxShadow: '0 0 35px rgba(6, 182, 212, 0.15)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <h3 className="font-mono text-xs uppercase tracking-widest text-cyan-400 font-bold">
            Semantic Cluster Telemetry
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800/50 hover:bg-slate-800 transition-colors"
        >
          ✕ Dismiss
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Tokens Selected</div>
          <div className="text-xl font-bold font-mono text-cyan-300 mt-1">
            {metrics.tokenCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Dominant: <span className="text-slate-300 font-medium">{metrics.dominantBiome}</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Shannon Entropy</div>
          <div className="text-xl font-bold font-mono text-amber-400 mt-1">
            {metrics.shannonEntropy.toFixed(2)}{' '}
            <span className="text-xs font-normal text-amber-400/70">bits</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Mean P: {(metrics.averageProbability * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Top 5 Candidates within Cluster */}
      <div className="mb-4">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Top Candidates In Region</span>
          <span className="text-[9px] text-cyan-500">SORTED BY PROB</span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
          {metrics.topTokens.length > 0 ? (
            metrics.topTokens.map((token, idx) => (
              <div
                key={token.token_id || idx}
                className="flex items-center justify-between p-2 rounded bg-slate-900/60 border border-slate-800/60 text-xs"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="font-mono text-[10px] text-slate-500 w-4">#{token.rank}</span>
                  <span className="font-mono text-slate-200 font-semibold truncate max-w-[120px]">
                    "{token.token_str}"
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, token.probability * 100))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-cyan-300 w-12 text-right">
                    {(token.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-500 italic py-2 text-center">No active candidate probabilities in selection</div>
          )}
        </div>
      </div>

      {/* Biome Breakdown Progress Bars */}
      <div>
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2">
          Territorial Biome Composition
        </div>
        <div className="space-y-2">
          {metrics.biomeBreakdown.map((b) => (
            <div key={b.biomeId} className="text-xs">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: b.color }} />
                  {b.label}
                </span>
                <span className="font-mono text-slate-400">
                  {b.count} ({b.percentage}%)
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${b.percentage}%`, backgroundColor: b.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Shortcut Prompt */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between font-mono">
        <span>Hold <kbd className="bg-slate-800 text-slate-300 px-1 py-0.5 rounded border border-slate-700">Shift</kbd> + Drag to lasso new region</span>
      </div>
    </div>
  );
};
