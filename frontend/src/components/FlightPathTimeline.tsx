import React, { useMemo, useState, useRef, useEffect } from 'react';
import { FlightStep, PerplexityData } from '../types/sampling';
import { calculateTokenEntropy, getConfidenceLevel } from '../utils/samplingMath';
import { Play, RotateCcw, ChevronLeft, ChevronRight, Orbit, Activity } from 'lucide-react';

interface FlightPathTimelineProps {
  steps: FlightStep[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  onGenerateNextStep: () => void;
  onResetTimeline: () => void;
  isGenerating?: boolean;
  allCandidatesByStep?: Array<import('../types/sampling').ProcessedTokenCandidate[]>;
}

// Tooltip state for hover inspection
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  data: PerplexityData | null;
  tokenStr: string;
  probability: number;
  rank: number;
  rawLogit: number;
}

export const FlightPathTimeline: React.FC<FlightPathTimelineProps> = ({
  steps,
  currentStepIndex,
  onSelectStep,
  onGenerateNextStep,
  onResetTimeline,
  isGenerating = false,
  allCandidatesByStep,
}) => {
  const currentSentence = steps.map(s => s.selectedToken.token_str).join('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Tooltip hover state
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null, tokenStr: '', probability: 0, rank: 0, rawLogit: 0,
  });

  // Compute perplexity data for each step using memoization (60 FPS safe)
  const perplexityMap = useMemo(() => {
    return steps.map((step, idx) => {
      // Use pre-computed candidates if available, otherwise estimate from the step's token
      const candidates = allCandidatesByStep?.[idx];
      if (candidates && candidates.length > 0) {
        const entropy = calculateTokenEntropy(candidates);
        return getConfidenceLevel(step.selectedToken, entropy);
      }
      // Fallback: estimate confidence from probability alone
      const prob = step.selectedToken.probability;
      const rank = step.selectedToken.rank;
      const estimatedEntropy = prob > 0.5 ? 1.0 : prob > 0.1 ? 3.0 : 5.0;
      return getConfidenceLevel(step.selectedToken, estimatedEntropy);
    });
  }, [steps, allCandidatesByStep]);

  // Average perplexity score across all steps
  const avgConfidence = useMemo(() => {
    if (perplexityMap.length === 0) return 0;
    return perplexityMap.reduce((sum, p) => sum + p.confidenceScore, 0) / perplexityMap.length;
  }, [perplexityMap]);

  const avgEntropy = useMemo(() => {
    if (perplexityMap.length === 0) return 0;
    return perplexityMap.reduce((sum, p) => sum + p.entropy, 0) / perplexityMap.length;
  }, [perplexityMap]);

  // Handle tooltip with boundary-aware positioning
  const handleTokenHover = (
    e: React.MouseEvent,
    step: FlightStep,
    perplexity: PerplexityData
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let tooltipX = e.clientX - (rect?.left || 0);
    const tooltipY = e.clientY - (rect?.top || 0) - 12;

    // Boundary check: flip tooltip to left if near right edge
    if (e.clientX > viewportWidth - 220) {
      tooltipX -= 200;
    }

    setTooltip({
      visible: true,
      x: tooltipX,
      y: tooltipY,
      data: perplexity,
      tokenStr: step.selectedToken.token_str.trim(),
      probability: step.selectedToken.probability,
      rank: step.selectedToken.rank,
      rawLogit: step.selectedToken.raw_logit,
    });
  };

  const handleTokenLeave = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  // Confidence level label
  const getConfidenceLabel = (score: number): string => {
    if (score > 0.7) return 'High Confidence';
    if (score > 0.4) return 'Moderate';
    return 'Low Confidence';
  };

  const getConfidenceBadgeColor = (score: number): string => {
    if (score > 0.7) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    if (score > 0.4) return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    return 'bg-red-500/20 text-red-300 border-red-500/30';
  };

  // Playback Scrubber Timer State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isPlaying) return;
    if (steps.length <= 1) {
      setIsPlaying(false);
      return;
    }

    const interval = setInterval(() => {
      onSelectStep((currentStepIndex + 1) % steps.length);
    }, 900);

    return () => clearInterval(interval);
  }, [isPlaying, currentStepIndex, steps.length, onSelectStep]);

  return (
    <div ref={containerRef} className="glass-panel-matte w-full rounded-xl p-4 flex flex-col space-y-3 relative">
      {/* Flight Control Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center space-x-2">
          <Orbit className="h-4 w-4 text-blue-400" />
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Sentence Flight Path Trajectory</h3>
            <p className="text-xs text-gray-400 font-mono">
              Hover tokens for confidence details • Perplexity heatmap & timeline scrubber
            </p>
          </div>
        </div>

        {/* Perplexity Summary Badge & Timeline Scrubber */}
        <div className="flex items-center space-x-2">
          {steps.length > 1 && (
            <div className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold border ${getConfidenceBadgeColor(avgConfidence)}`}>
              <Activity className="h-3 w-3" />
              <span>
                {getConfidenceLabel(avgConfidence)} • H̄ = {avgEntropy.toFixed(2)} bits
              </span>
            </div>
          )}

          {/* Step Controls */}
          <div className="flex items-center space-x-2">
            {/* Play/Pause Timeline Scrubber Toggle */}
            {steps.length > 1 && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause timeline playback' : 'Play interactive timeline scrubber'}
                className="flex items-center space-x-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 px-2.5 py-1 text-xs font-mono font-bold hover:bg-blue-500/20 transition-colors"
                title="Auto Play/Pause Timeline Scrubber"
              >
                <Play className={`h-3 w-3 ${isPlaying ? 'fill-blue-300' : ''}`} />
                <span>{isPlaying ? 'Pause' : 'Scrub'}</span>
              </button>
            )}

            <button
              onClick={() => currentStepIndex > 0 && onSelectStep(currentStepIndex - 1)}
              disabled={currentStepIndex <= 0}
              aria-label="Rewind to previous token generation step"
              className="p-1.5 rounded-full bg-[#18181b] border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Rewind Step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-mono font-bold text-blue-400 px-2">
              Step {currentStepIndex + 1} of {steps.length}
            </span>

            <button
              onClick={() => currentStepIndex < steps.length - 1 && onSelectStep(currentStepIndex + 1)}
              disabled={currentStepIndex >= steps.length - 1}
              aria-label="Forward to next token generation step"
              className="p-1.5 rounded-full bg-[#18181b] border border-white/10 text-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Forward Step"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={onGenerateNextStep}
              disabled={isGenerating}
              aria-label="Sample next token in sentence trajectory"
              className="flex items-center space-x-1.5 rounded-full bg-pink-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-pink-400 transition-colors shadow-sm"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isGenerating ? 'Sampling...' : 'Sample Next Token'}</span>
            </button>

            <button
              onClick={onResetTimeline}
              aria-label="Reset constellation flight path trajectory"
              className="p-1.5 rounded-full bg-[#18181b] border border-white/10 text-gray-400 hover:text-white"
              title="Reset Constellation Flight Path"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Generated Sentence Preview with inline heatmap coloring */}
      <div className="rounded-lg bg-[#111111] px-4 py-2.5 border border-white/10 flex items-start space-x-2">
        <span className="text-xs font-bold uppercase text-gray-400 font-mono shrink-0 pt-0.5">Output:</span>
        <span className="text-xs font-mono tracking-wide flex flex-wrap text-gray-100">
          {steps.map((step, idx) => {
            const perp = perplexityMap[idx];
            return (
              <span
                key={idx}
                style={{ color: perp?.perplexityColor || '#f3f4f6' }}
                className="transition-colors"
              >
                {step.selectedToken.token_str}
              </span>
            );
          })}
        </span>
      </div>

      {/* Constellation Step Nodes — Perplexity Heatmap */}
      <div className="relative flex items-center space-x-3 overflow-x-auto py-2 px-1" role="list">
        {/* Constellation line background */}
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-white/10 -translate-y-1/2 z-0" />

        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const perp = perplexityMap[idx];
          const heatColor = perp?.perplexityColor || '#475569';

          return (
            <button
              key={idx}
              onClick={() => onSelectStep(idx)}
              onMouseEnter={(e) => handleTokenHover(e, step, perp)}
              onMouseMove={(e) => handleTokenHover(e, step, perp)}
              onMouseLeave={handleTokenLeave}
              role="listitem"
              aria-label={`Step ${idx + 1}: Token ${step.selectedToken.token_str.trim()} with ${(step.selectedToken.probability * 100).toFixed(0)}% probability, ${perp?.confidence || 'unknown'} confidence`}
              className={`relative z-10 flex flex-col items-center group transition-all transform hover:-translate-y-1 ${
                isActive ? 'scale-105' : ''
              }`}
            >
              {/* Star Node circle — colored by perplexity heatmap */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'ring-4 ring-opacity-30'
                    : 'group-hover:scale-110'
                }`}
                style={{
                  borderColor: heatColor,
                  backgroundColor: isActive ? heatColor : `${heatColor}20`,
                  color: isActive ? '#0f172a' : heatColor,
                  boxShadow: isActive ? `0 0 12px ${heatColor}60` : 'none',
                  ...(isActive ? { ['--tw-ring-color' as string]: `${heatColor}40` } : {}),
                }}
              >
                #{idx + 1}
              </div>

              {/* Token word pill — background tinted by confidence color */}
              <span
                className={`mt-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono whitespace-nowrap border transition-all ${
                  isActive ? 'font-semibold' : 'group-hover:text-slate-200'
                }`}
                style={{
                  borderColor: `${heatColor}50`,
                  backgroundColor: `${heatColor}15`,
                  color: isActive ? heatColor : `${heatColor}cc`,
                }}
              >
                "{step.selectedToken.token_str.trim()}"
              </span>

              {/* Probability pill */}
              <span
                className="text-[10px] font-mono mt-0.5 font-semibold"
                style={{ color: heatColor }}
              >
                {(step.selectedToken.probability * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Floating Tooltip — boundary-aware positioning */}
      {tooltip.visible && tooltip.data && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 100}px`,
          }}
        >
          <div className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 shadow-2xl min-w-[180px]">
            <div className="text-xs font-bold text-slate-100 mb-1.5 flex items-center space-x-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tooltip.data.perplexityColor }}
              />
              <span>"{tooltip.tokenStr}"</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Probability</span>
                <span className="text-blue-300 font-bold">{(tooltip.probability * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rank</span>
                <span className="text-slate-300">#{tooltip.rank}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Raw Logit</span>
                <span className="text-amber-300">{tooltip.rawLogit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entropy</span>
                <span className="text-sky-300">{tooltip.data.entropy.toFixed(2)} bits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Confidence</span>
                <span
                  className="font-bold uppercase"
                  style={{ color: tooltip.data.perplexityColor }}
                >
                  {tooltip.data.confidence}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
