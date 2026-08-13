import React, { useMemo } from 'react';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { TokenCosmosGraph } from './TokenCosmosGraph';
import { Swords, Flame, Sparkles } from 'lucide-react';

interface SplitViewCosmosProps {
  leftCandidates: ProcessedTokenCandidate[];
  rightCandidates: ProcessedTokenCandidate[];
  leftParams: SamplingParameters;
  rightParams: SamplingParameters;
  leftTitle?: string;
  leftSubtitle?: string;
  rightTitle?: string;
  rightSubtitle?: string;
  leftRagEnabled?: boolean;
  rightRagEnabled?: boolean;
  onSelectToken?: (token: ProcessedTokenCandidate) => void;
  onUpdateRightTemp?: (temp: number) => void;
  isByoeMode?: boolean;
  leftIsThinking?: boolean;
}

export const SplitViewCosmos: React.FC<SplitViewCosmosProps> = ({
  leftCandidates,
  rightCandidates,
  leftParams,
  rightParams,
  leftTitle = 'Universe A (Primary Config)',
  leftSubtitle = `T = ${leftParams.temperature.toFixed(2)} • Top-K = ${leftParams.topK}`,
  rightTitle = 'Universe B (A/B Duel Config)',
  rightSubtitle = `T = ${rightParams.temperature.toFixed(2)} • Top-K = ${rightParams.topK}`,
  leftRagEnabled = false,
  rightRagEnabled = false,
  onSelectToken,
  onUpdateRightTemp,
  isByoeMode = false,
  leftIsThinking = false,
}) => {
  // Compute divergence metric between Universe A and Universe B top candidate distributions
  const divergenceMetric = useMemo(() => {
    if (leftCandidates.length === 0 || rightCandidates.length === 0) return null;

    const topA = leftCandidates[0];
    const topB = rightCandidates[0];

    const sameTop = topA?.token_str.trim() === topB?.token_str.trim();

    // Estimate distribution overlap among top 5 tokens
    const top5A = new Set(leftCandidates.slice(0, 5).map(c => c.token_str.trim()));
    const top5B = new Set(rightCandidates.slice(0, 5).map(c => c.token_str.trim()));
    let overlapCount = 0;
    top5A.forEach(t => { if (top5B.has(t)) overlapCount++; });

    const overlapPct = Math.round((overlapCount / 5) * 100);
    const probDiff = Math.abs((topA?.probability || 0) - (topB?.probability || 0));

    return {
      sameTop,
      topAStr: topA?.token_str.trim() || 'N/A',
      topBStr: topB?.token_str.trim() || 'N/A',
      probA: Math.round((topA?.probability || 0) * 100),
      probB: Math.round((topB?.probability || 0) * 100),
      overlapPct,
      probDiffPct: Math.round(probDiff * 100),
    };
  }, [leftCandidates, rightCandidates]);

  return (
    <div className="w-full h-full min-h-[500px] flex flex-col space-y-3">
      {/* Center A/B Duel Status & Divergence Badge */}
      <div className="flex items-center justify-between rounded-xl bg-slate-950/90 border border-purple-500/30 px-4 py-2 shadow-lg">
        <div className="flex items-center space-x-2">
          <Swords className="h-4 w-4 text-purple-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-100">A/B Probability Duel</span>
          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-500/30">
            {isByoeMode ? 'Frontier vs. Local BYOE' : 'Dual Temperature Experiment'}
          </span>
        </div>

        {divergenceMetric && (
          <div className="flex items-center space-x-3 text-[11px] font-mono">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400">Top Match:</span>
              {divergenceMetric.sameTop ? (
                <span className="text-emerald-400 font-bold">Identical ("{divergenceMetric.topAStr}")</span>
              ) : (
                <span className="text-amber-400 font-bold">Divergent ("{divergenceMetric.topAStr}" vs "{divergenceMetric.topBStr}")</span>
              )}
            </div>
            <div className="hidden sm:flex items-center space-x-1">
              <span className="text-slate-400">Top-5 Overlap:</span>
              <span className="text-blue-300 font-bold">{divergenceMetric.overlapPct}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Dual Starfield Canvas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-[440px]">
        {/* Left Universe (Primary Config) */}
        <div className="relative w-full h-full border border-blue-500/30 rounded-2xl overflow-hidden shadow-md">
          <TokenCosmosGraph
            candidates={leftCandidates}
            params={leftParams}
            ragEnabled={leftRagEnabled}
            onSelectToken={onSelectToken}
            title={leftTitle}
            subtitle={leftSubtitle}
            isThinking={leftIsThinking}
          />
        </div>

        {/* Right Universe (A/B Secondary Config) */}
        <div className="relative w-full h-full border border-slate-800 rounded-2xl overflow-hidden shadow-md">
          <TokenCosmosGraph
            candidates={rightCandidates}
            params={rightParams}
            ragEnabled={rightRagEnabled}
            onSelectToken={onSelectToken}
            title={rightTitle}
            subtitle={rightSubtitle}
          />

          {/* Quick Temperature Control Overlay for Right Universe when in Dual Temperature Mode */}
          {!isByoeMode && onUpdateRightTemp && (
            <div className="absolute bottom-3 right-3 z-30 flex items-center space-x-2 rounded-xl bg-slate-950/90 border border-purple-500/40 px-3 py-1.5 backdrop-blur-md shadow-xl">
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-slate-300">Temp B:</span>
              <input
                type="range"
                min="0.05"
                max="2.0"
                step="0.05"
                value={rightParams.temperature}
                onChange={e => onUpdateRightTemp(parseFloat(e.target.value))}
                className="w-20 h-1 appearance-none bg-slate-800 rounded-full accent-purple-500"
              />
              <span className="text-[10px] font-mono font-bold text-purple-300 w-8 text-right">
                {rightParams.temperature.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
