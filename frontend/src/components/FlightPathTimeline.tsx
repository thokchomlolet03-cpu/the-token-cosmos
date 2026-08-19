/* ─────────────────────────────────────────────────────────────────────
 * FlightPathTimeline.tsx — Turn-by-Turn GPS Generative Route Scrubber
 * Interactive Waypoint Inspector & Cartographic Route Explainer
 * The Token Cosmos // AI Navigation Atlas
 * ───────────────────────────────────────────────────────────────────── */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { FlightStep, PerplexityData } from '../types/sampling';
import { calculateTokenEntropy, getConfidenceLevel } from '../utils/samplingMath';
import { Play, RotateCcw, ChevronLeft, ChevronRight, Navigation, Activity, Compass, Info } from 'lucide-react';

interface FlightPathTimelineProps {
  steps: FlightStep[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  onGenerateNextStep: () => void;
  onResetTimeline: () => void;
  isGenerating?: boolean;
  allCandidatesByStep?: Array<import('../types/sampling').ProcessedTokenCandidate[]>;
}

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Tooltip hover state
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, x: 0, y: 0, data: null, tokenStr: '', probability: 0, rank: 0, rawLogit: 0,
  });

  // Compute perplexity and entropy for each step
  const perplexityMap = useMemo(() => {
    return steps.map((step, idx) => {
      const candidates = allCandidatesByStep?.[idx];
      if (candidates && candidates.length > 0) {
        const entropy = calculateTokenEntropy(candidates);
        return getConfidenceLevel(step.selectedToken, entropy);
      }
      const prob = step.selectedToken.probability;
      const estimatedEntropy = prob > 0.5 ? 1.0 : prob > 0.1 ? 3.0 : 5.0;
      return getConfidenceLevel(step.selectedToken, estimatedEntropy);
    });
  }, [steps, allCandidatesByStep]);

  const avgConfidence = useMemo(() => {
    if (perplexityMap.length === 0) return 0;
    return perplexityMap.reduce((sum, p) => sum + p.confidenceScore, 0) / perplexityMap.length;
  }, [perplexityMap]);

  const avgEntropy = useMemo(() => {
    if (perplexityMap.length === 0) return 0;
    return perplexityMap.reduce((sum, p) => sum + p.entropy, 0) / perplexityMap.length;
  }, [perplexityMap]);

  // Active step details for Turn-by-Turn GPS explanation
  const activeStep = steps[currentStepIndex];
  const activeCandidates = allCandidatesByStep?.[currentStepIndex] || [];
  const runnerUp = activeCandidates.length > 1 ? activeCandidates[1] : null;

  const handleTokenHover = (
    e: React.MouseEvent,
    step: FlightStep,
    perplexity: PerplexityData
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    let tooltipX = e.clientX - (rect?.left || 0);
    const tooltipY = e.clientY - (rect?.top || 0) - 12;

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

  const getConfidenceBadgeColor = (score: number): string => {
    if (score > 0.7) return 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40';
    if (score > 0.4) return 'bg-amber-950/60 text-amber-300 border-amber-500/40';
    return 'bg-rose-950/60 text-rose-300 border-rose-500/40';
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
    <div ref={containerRef} className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 flex flex-col space-y-3 relative shadow-2xl text-slate-100 font-sans">
      {/* GPS Route Header & Navigation Controls */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Navigation className="h-4 w-4 text-sky-400" />
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Turn-by-Turn GPS Trajectory</span>
              <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                {steps.length} WAYPOINTS
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              Scrub token milestones to inspect elevation, entropy, and branching forks
            </p>
          </div>
        </div>

        {/* Perplexity Telemetry & Scrubber Controls */}
        <div className="flex items-center space-x-2">
          {steps.length > 1 && (
            <div className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-[10px] font-mono font-bold border ${getConfidenceBadgeColor(avgConfidence)}`}>
              <Activity className="h-3 w-3" />
              <span>
                Entropy: H̄ = {avgEntropy.toFixed(2)} bits
              </span>
            </div>
          )}

          {/* Scrubber Controls */}
          <div className="flex items-center space-x-2">
            {steps.length > 1 && (
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause route playback' : 'Play turn-by-turn route scrubber'}
                className="flex items-center space-x-1 rounded-md bg-sky-950/60 border border-sky-600/40 text-sky-300 px-2.5 py-1 text-xs font-mono font-bold hover:bg-sky-900/60 transition-colors"
                title="Play / Pause Turn-by-Turn Scrubber"
              >
                <Play className={`h-3 w-3 ${isPlaying ? 'fill-sky-300' : ''}`} />
                <span>{isPlaying ? 'Pause' : 'Scrub'}</span>
              </button>
            )}

            <button
              onClick={() => currentStepIndex > 0 && onSelectStep(currentStepIndex - 1)}
              disabled={currentStepIndex <= 0}
              aria-label="Rewind to previous waypoint"
              className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous Waypoint"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-mono font-bold text-sky-400 px-1.5">
              Waypoint {currentStepIndex + 1} / {Math.max(1, steps.length)}
            </span>

            <button
              onClick={() => currentStepIndex < steps.length - 1 && onSelectStep(currentStepIndex + 1)}
              disabled={currentStepIndex >= steps.length - 1}
              aria-label="Forward to next waypoint"
              className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next Waypoint"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={onGenerateNextStep}
              disabled={isGenerating}
              aria-label="Sample next token in trajectory"
              className="flex items-center space-x-1.5 rounded-md bg-sky-500 hover:bg-sky-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition-colors shadow-md disabled:opacity-50"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{isGenerating ? 'Navigating...' : 'Step Forward'}</span>
            </button>

            <button
              onClick={onResetTimeline}
              aria-label="Reset trajectory route"
              className="p-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
              title="Clear Route"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Turn-by-Turn Active Decision Explanation Box */}
      {activeStep && (
        <div className="rounded-lg bg-slate-950/70 p-3 border border-slate-800 flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-200">
                Waypoint #{currentStepIndex + 1}:
              </span>{' '}
              <span className="text-slate-300">
                Model navigated to{' '}
                <strong className="text-emerald-400 font-mono">
                  "{activeStep.selectedToken.token_str.trim()}"
                </strong>{' '}
                with{' '}
                <strong className="text-sky-300">
                  {(activeStep.selectedToken.probability * 100).toFixed(1)}%
                </strong>{' '}
                summit confidence.
                {runnerUp && (
                  <>
                    {' '}
                    Pruned alternative route:{' '}
                    <span className="text-slate-400 font-mono">
                      "{runnerUp.token_str.trim()}" ({(runnerUp.probability * 100).toFixed(1)}%)
                    </span>
                    .
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="font-mono text-[11px] text-slate-400 shrink-0">
            Logit: {activeStep.selectedToken.raw_logit.toFixed(2)}
          </div>
        </div>
      )}

      {/* Waypoint Nodes Line */}
      <div className="relative flex items-center space-x-3 overflow-x-auto py-2 px-1" role="list">
        <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-slate-800 -translate-y-1/2 z-0" />

        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const perp = perplexityMap[idx];
          const heatColor = perp?.perplexityColor || '#38bdf8';

          return (
            <button
              key={idx}
              onClick={() => onSelectStep(idx)}
              onMouseEnter={(e) => handleTokenHover(e, step, perp)}
              onMouseMove={(e) => handleTokenHover(e, step, perp)}
              onMouseLeave={handleTokenLeave}
              role="listitem"
              aria-label={`Waypoint ${idx + 1}: Token ${step.selectedToken.token_str.trim()} with ${(step.selectedToken.probability * 100).toFixed(0)}% probability`}
              className={`relative z-10 flex flex-col items-center group transition-all transform hover:-translate-y-0.5 ${
                isActive ? 'scale-105' : ''
              }`}
            >
              {/* Waypoint Milestone Node */}
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-mono font-bold transition-all ${
                  isActive
                    ? 'ring-4 ring-sky-500/30'
                    : 'group-hover:scale-110'
                }`}
                style={{
                  borderColor: heatColor,
                  backgroundColor: isActive ? heatColor : `${heatColor}20`,
                  color: isActive ? '#0f172a' : heatColor,
                  boxShadow: isActive ? `0 0 10px ${heatColor}50` : 'none',
                }}
              >
                {idx + 1}
              </div>

              {/* Token word badge */}
              <span
                className={`mt-1.5 rounded px-2 py-0.5 text-[11px] font-mono whitespace-nowrap border transition-all ${
                  isActive ? 'font-bold bg-slate-800 text-white border-slate-600' : 'bg-slate-900/80 text-slate-300 border-slate-800 group-hover:text-white'
                }`}
              >
                "{step.selectedToken.token_str.trim()}"
              </span>

              {/* Probability */}
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

      {/* Floating Hover Tooltip */}
      {tooltip.visible && tooltip.data && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y - 100}px`,
          }}
        >
          <div className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 shadow-2xl min-w-[180px]">
            <div className="text-xs font-bold text-white mb-1.5 flex items-center space-x-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tooltip.data.perplexityColor }}
              />
              <span>"{tooltip.tokenStr}"</span>
            </div>
            <div className="space-y-1 text-[10px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Summit Probability</span>
                <span className="text-sky-300 font-bold">{(tooltip.probability * 100).toFixed(2)}%</span>
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
                <span className="text-slate-400">Route Reliability</span>
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
