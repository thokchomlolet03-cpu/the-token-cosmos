/* ─────────────────────────────────────────────────────────────────────
 * TokenCosmosGraph — TRANSITIONAL STUB (v4.0)
 *
 * Cosmograph has been removed. This stub maintains the component
 * interface used by App.tsx and SplitViewCosmos.tsx until the
 * Phase 3 TerrainCanvas replaces it entirely.
 * ───────────────────────────────────────────────────────────────────── */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ProcessedTokenCandidate, SamplingParameters, FlightStep } from '../types/sampling';
import { calculateTokenEntropy, getConfidenceLevel } from '../utils/samplingMath';
import { TerrainCanvas } from './TerrainCanvas';
import {
  ZoomIn, ZoomOut, RotateCcw, Search, Save, Copy, Share2,
  Anchor, Activity, Zap, Flame, AlertCircle, Play, Pause,
  ChevronLeft, ChevronRight, Eye, Maximize2, Minimize2
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
  isPlaying?: boolean;
  onTogglePlay?: () => void;
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
  isPlaying: isPlayingProp,
  onTogglePlay: onTogglePlayProp,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [heightMode, setHeightMode] = useState<'linear' | 'log' | 'logit'>('log');

  const isPlaying = isPlayingProp !== undefined ? isPlayingProp : localIsPlaying;
  const togglePlay = () => {
    if (onTogglePlayProp) {
      onTogglePlayProp();
    } else {
      setLocalIsPlaying(!localIsPlaying);
    }
  };

  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!graphContainerRef.current) return;
    if (!document.fullscreenElement) {
      graphContainerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  // Auto-play timeline scrubber (only if parent-controlled generation is inactive)
  useEffect(() => {
    if (onTogglePlayProp) return;
    if (!isPlaying || steps.length <= 1 || !onSelectStep) return;
    const interval = setInterval(() => {
      onSelectStep((currentStepIndex + 1) % steps.length);
    }, 900);
    return () => clearInterval(interval);
  }, [isPlaying, currentStepIndex, steps.length, onSelectStep, onTogglePlayProp]);

  return (
    <div
      ref={graphContainerRef}
      className="relative w-full h-full min-h-[480px] rounded-xl overflow-hidden bg-[#050714] flex flex-col"
      role="region"
      aria-label="Token Probability Distribution"
      tabIndex={0}
    >
      {/* ─── Top Action Bar ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
        <div className="flex items-center space-x-3">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse shadow-md" />
          <div>
            <h3 className="text-xs font-bold text-white tracking-tight">{title}</h3>
            <p className="text-[10px] text-blue-400/80 font-mono">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Height Mode Switcher */}
          <div className="flex bg-white/5 rounded-lg border border-white/10 p-0.5 pointer-events-auto">
            <button
              onClick={() => setHeightMode('linear')}
              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded transition-all ${
                heightMode === 'linear'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40 shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Linear Probabilities"
            >
              Linear
            </button>
            <button
              onClick={() => setHeightMode('log')}
              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded transition-all ${
                heightMode === 'log'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40 shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Enhanced Log-Scale 3D Mountains"
            >
              3D Mountains
            </button>
            <button
              onClick={() => setHeightMode('logit')}
              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded transition-all ${
                heightMode === 'logit'
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/40 shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Raw Pre-Softmax Logits"
            >
              Logits
            </button>
          </div>

          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Full Screen" : "Go Full Screen"}
            className="flex items-center space-x-1 px-2 py-1 text-[9px] font-mono font-bold rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all shadow pointer-events-auto"
          >
            {isFullscreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Zen' : 'Zen'}</span>
          </button>

          <div className="flex items-center space-x-1.5 bg-white/5 rounded-lg px-2 py-1">
            <Search className="h-3 w-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-transparent text-xs text-white placeholder:text-gray-600 outline-none w-20 font-mono"
            />
          </div>
        </div>
      </div>

      {/* ─── Telemetry Strip ─── */}
      <div className="flex items-center space-x-6 px-4 py-1.5 border-b border-white/5 text-[10px] font-mono text-gray-400">
        <span><Zap className="inline h-3 w-3 text-blue-400 mr-1" />Top: <strong className="text-white">{topToken?.token_str.trim() || '—'}</strong> ({topToken ? (topToken.probability * 100).toFixed(1) : 0}%)</span>
        <span><Activity className="inline h-3 w-3 text-blue-400 mr-1" />Uncertainty: <strong className="text-white">{entropy.toFixed(2)} bits</strong></span>
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
          heightMode={heightMode}
          steps={steps}
          currentStepIndex={currentStepIndex}
        />
      </div>

      {/* ─── Legend ─── */}
      <div className="flex items-center space-x-4 px-4 py-2 border-t border-white/5">
        <LegendItem color={CATEGORY_COLORS.winner} label="Winner" />
        <LegendItem color={CATEGORY_COLORS.rag_grounded} label="RAG Grounded" />
        <LegendItem color={CATEGORY_COLORS.candidate} label="Candidate" />
        <LegendItem color={CATEGORY_COLORS.fringe} label="Fringe" />
        <LegendItem color={CATEGORY_COLORS.filtered} label="Filtered" />
      </div>

      {/* ─── Bottom Timeline Scrubber & Auto-Play Controller ─── */}
      <div className="border-t border-white/10 bg-[#090b14]/90 backdrop-blur-md px-4 py-2.5 flex items-center justify-between space-x-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause auto-generation' : 'Start auto-generation'}
            className={`h-7 px-3 rounded-md flex items-center space-x-1.5 text-xs font-semibold transition-all ${
              isPlaying
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Auto-Play</span>
              </>
            )}
          </button>

          {onGenerateNextStep && (
            <button
              onClick={onGenerateNextStep}
              disabled={isGenerating || isPlaying}
              title="Generate Next Step (+1 Token)"
              className="h-7 px-2.5 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-mono disabled:opacity-40 transition-colors flex items-center space-x-1"
            >
              <span>+1 Step</span>
            </button>
          )}

          {onResetTimeline && steps.length > 0 && (
            <button
              onClick={onResetTimeline}
              title="Reset Timeline"
              className="h-7 px-2 rounded-md bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 border border-white/10 text-xs transition-colors flex items-center"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
        </div>

        {steps.length > 0 && onSelectStep ? (
          <div className="flex-1 flex items-center space-x-2 max-w-[60%]">
            <button
              onClick={() => onSelectStep(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="text-gray-500 hover:text-white disabled:opacity-30 p-1 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex-1 flex items-center space-x-1 overflow-x-auto scrollbar-none py-0.5">
              {steps.map((step, idx) => {
                const conf = perplexityMap[idx];
                const bgColor = conf?.perplexityColor || '#333';
                return (
                  <button
                    key={idx}
                    onClick={() => onSelectStep(idx)}
                    className={`flex-shrink-0 h-5 px-2 rounded text-[10px] font-mono transition-all ${
                      idx === currentStepIndex
                        ? 'ring-2 ring-blue-400 scale-105 text-white font-bold'
                        : 'text-gray-400 hover:text-white opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: bgColor }}
                  >
                    {step.selectedToken.token_str.trim().slice(0, 8) || '␣'}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onSelectStep(Math.min(steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === steps.length - 1}
              className="text-gray-500 hover:text-white disabled:opacity-30 p-1 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>
        ) : (
          <div className="text-[11px] font-mono text-gray-500 italic">
            Ready • Click Auto-Play or +1 Step to stream generation
          </div>
        )}
      </div>
    </div>
  );
};
