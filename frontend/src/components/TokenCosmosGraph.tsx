/* ─────────────────────────────────────────────────────────────────────
 * TokenCosmosGraph — TRANSITIONAL STUB (v4.0)
 *
 * Cosmograph has been removed. This stub maintains the component
 * interface used by App.tsx and SplitViewCosmos.tsx until the
 * Phase 3 TerrainCanvas replaces it entirely.
 * ───────────────────────────────────────────────────────────────────── */

import React, { useMemo, useState, useEffect } from 'react';
import { ProcessedTokenCandidate, SamplingParameters, FlightStep } from '../types/sampling';
import { calculateTokenEntropy, getConfidenceLevel } from '../utils/samplingMath';
import { TerrainCanvas } from './TerrainCanvas';
import {
  ZoomIn, ZoomOut, RotateCcw, Search, Save, Copy, Share2,
  Anchor, Activity, Zap, Flame, AlertCircle, Play, Pause,
  ChevronLeft, ChevronRight, Eye
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────── */

interface TokenCosmosGraphProps {
  candidates: ProcessedTokenCandidate[];
  params: SamplingParameters;
  ragEnabled: boolean;
  onSelectToken?: (token: ProcessedTokenCandidate) => void;
  title?: string;
  subtitle?: string;
  steps?: FlightStep[];
  currentStepIndex?: number;
  onSelectStep?: (index: number) => void;
  onGenerateNextStep?: () => void;
  onResetTimeline?: () => void;
  isGenerating?: boolean;
  allCandidatesByStep?: Array<ProcessedTokenCandidate[]>;
  historyLength?: number;
  modelId?: string | null;
  latestLogits?: Float32Array | null;
  isThinking?: boolean;
}

/* ──────────────────────────────────────────────────────────────────────
 * Category Color Mapping
 * ──────────────────────────────────────────────────────────────────── */
const CATEGORY_COLORS = {
  winner:       '#10B981',
  rag_grounded: '#3B82F6',
  candidate:    '#D946EF',
  filtered:     '#EF4444',
  fringe:       '#333338',
} as const;

/* ──────────────────────────────────────────────────────────────────────
 * Sub-components
 * ──────────────────────────────────────────────────────────────────── */

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center space-x-2">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-[10px] text-gray-400 font-mono">{label}</span>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────
 * Transitional Probability Bar Chart (replaces Cosmograph canvas)
 * ──────────────────────────────────────────────────────────────────── */

const ProbabilityBars: React.FC<{
  candidates: ProcessedTokenCandidate[];
  onSelect?: (c: ProcessedTokenCandidate) => void;
}> = ({ candidates, onSelect }) => {
  const top30 = candidates.filter(c => !c.isFiltered).slice(0, 30);
  const maxProb = Math.max(...top30.map(c => c.probability), 0.01);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
      {top30.map((c, i) => (
        <button
          key={`${c.token_id}-${i}`}
          className="w-full flex items-center space-x-2 group hover:bg-white/5 rounded-md px-2 py-0.5 transition-colors"
          onClick={() => onSelect?.(c)}
        >
          <span className="text-[9px] text-gray-600 font-mono w-5 text-right">{c.rank}</span>
          <div className="flex-1 h-4 bg-gray-900 rounded-sm overflow-hidden relative">
            <div
              className="h-full rounded-sm transition-all duration-300 ease-out"
              style={{
                width: `${(c.probability / maxProb) * 100}%`,
                backgroundColor: c.color,
                opacity: 0.8,
              }}
            />
            <span className="absolute inset-0 flex items-center px-1.5 text-[10px] text-white font-mono truncate">
              {c.token_str.trim()}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono w-14 text-right">
            {(c.probability * 100).toFixed(1)}%
          </span>
        </button>
      ))}
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────
 * Main Component
 * ──────────────────────────────────────────────────────────────────── */

export const TokenCosmosGraph: React.FC<TokenCosmosGraphProps> = ({
  candidates,
  params,
  ragEnabled,
  onSelectToken,
  title = 'The Token Cosmos',
  subtitle = 'Probability Distribution View',
  steps = [],
  currentStepIndex = 0,
  onSelectStep,
  onGenerateNextStep,
  onResetTimeline,
  isGenerating = false,
  allCandidatesByStep,
  historyLength = 0,
  modelId = null,
  latestLogits = null,
  isThinking = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);

  // Compute telemetry
  const entropy = useMemo(() => {
    const probs = candidates.filter(c => !c.isFiltered).map(c => c.probability);
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    return -probs.reduce((e, p) => {
      if (p <= 0) return e;
      const norm = p / sum;
      return e + norm * Math.log2(norm);
    }, 0);
  }, [candidates]);

  const topToken = candidates[0];
  const groundedCount = candidates.filter(c => c.is_rag_grounded).length;

  // Perplexity heatmap for timeline steps
  const perplexityMap = useMemo(() => {
    return steps.map((step, idx) => {
      const stepCandidates = allCandidatesByStep?.[idx];
      if (stepCandidates && stepCandidates.length > 0) {
        const ent = calculateTokenEntropy(stepCandidates);
        return getConfidenceLevel(step.selectedToken, ent);
      }
      const prob = step.selectedToken.probability;
      const estimatedEntropy = prob > 0.5 ? 1.0 : prob > 0.1 ? 3.0 : 5.0;
      return getConfidenceLevel(step.selectedToken, estimatedEntropy);
    });
  }, [steps, allCandidatesByStep]);

  // Auto-play timeline scrubber
  useEffect(() => {
    if (!isPlaying || steps.length <= 1 || !onSelectStep) return;
    const interval = setInterval(() => {
      onSelectStep((currentStepIndex + 1) % steps.length);
    }, 900);
    return () => clearInterval(interval);
  }, [isPlaying, currentStepIndex, steps.length, onSelectStep]);

  return (
    <div
      className="relative w-full h-full min-h-[480px] rounded-xl overflow-hidden bg-[#050714] flex flex-col"
      role="region"
      aria-label="Token Probability Distribution"
      tabIndex={0}
    >
      {/* ─── Top Action Bar ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06B6D4]" />
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[10px] text-cyan-400/80 font-mono">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-white/5 rounded-lg px-2 py-1">
            <Search className="h-3 w-3 text-cyan-400/70" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tokens..."
              className="bg-transparent text-xs text-white placeholder:text-gray-600 outline-none w-28 font-mono"
            />
          </div>
        </div>
      </div>

      {/* ─── Telemetry Strip ─── */}
      <div className="flex items-center space-x-6 px-4 py-1.5 border-b border-white/5 text-[10px] font-mono text-gray-400">
        <span><Zap className="inline h-3 w-3 text-cyan-400 mr-1" />Top: <strong className="text-white">{topToken?.token_str.trim() || '—'}</strong> ({topToken ? (topToken.probability * 100).toFixed(1) : 0}%)</span>
        <span><Activity className="inline h-3 w-3 text-pink-400 mr-1" />Entropy: <strong className="text-white">{entropy.toFixed(2)} bits</strong></span>
        <span><Anchor className="inline h-3 w-3 text-blue-400 mr-1" />RAG: <strong className="text-white">{ragEnabled ? `${groundedCount} grounded` : 'OFF'}</strong></span>
        <span>Candidates: <strong className="text-white">{candidates.filter(c => !c.isFiltered).length}</strong> / {candidates.length}</span>
      </div>

      {/* ─── WebGL Terrain Canvas ─── */}
      <div className="flex-1 relative overflow-hidden">
        <TerrainCanvas 
          modelId={modelId} 
          latestLogits={latestLogits} 
          params={params}
          ragTokenIds={ragEnabled ? candidates.filter(c => c.is_rag_grounded).map(c => c.token_id) : []}
          isThinking={isThinking}
          candidates={candidates}
        />
        
        {/* Floating Top 10 Overlay */}
        <div className="absolute top-4 right-4 w-64 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 overflow-hidden pointer-events-none">
          <div className="px-3 py-1.5 bg-white/5 border-b border-white/10">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Top Candidates</span>
          </div>
          <div className="p-2 space-y-1">
            {candidates.slice(0, 10).map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[10px] font-mono truncate mr-2" style={{ color: c.color }}>
                  {c.token_str.trim() || '—'}
                </span>
                <span className="text-[9px] font-mono text-gray-400">
                  {(c.probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Legend ─── */}
      <div className="flex items-center space-x-4 px-4 py-2 border-t border-white/5">
        <LegendItem color={CATEGORY_COLORS.winner} label="Winner" />
        <LegendItem color={CATEGORY_COLORS.rag_grounded} label="RAG Grounded" />
        <LegendItem color={CATEGORY_COLORS.candidate} label="Candidate" />
        <LegendItem color={CATEGORY_COLORS.fringe} label="Fringe" />
        <LegendItem color={CATEGORY_COLORS.filtered} label="Filtered" />
      </div>

      {/* ─── Bottom Timeline Scrubber ─── */}
      {steps.length > 0 && onSelectStep && (
        <div className="border-t border-white/5 px-4 py-2 flex items-center space-x-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-gray-300 hover:text-cyan-400 transition-colors"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
            disabled={currentStepIndex === 0}
            className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 flex items-center space-x-0.5 overflow-x-auto scrollbar-none">
            {steps.map((step, idx) => {
              const conf = perplexityMap[idx];
              const bgColor = conf?.perplexityColor || '#333';
              return (
                <button
                  key={idx}
                  onClick={() => onSelectStep(idx)}
                  className={`flex-shrink-0 h-5 px-1.5 rounded text-[9px] font-mono transition-all ${
                    idx === currentStepIndex
                      ? 'ring-1 ring-cyan-400 scale-110 text-white'
                      : 'text-gray-500 hover:text-white'
                  }`}
                  style={{ backgroundColor: bgColor }}
                >
                  {step.selectedToken.token_str.trim().slice(0, 6)}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1))}
            disabled={currentStepIndex === steps.length - 1}
            className="text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <span className="text-[9px] text-gray-600 font-mono">
            {currentStepIndex + 1}/{steps.length}
          </span>
        </div>
      )}
    </div>
  );
};
