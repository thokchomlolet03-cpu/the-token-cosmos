import React, { useMemo } from 'react';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { calculateTokenEntropy } from '../utils/samplingMath';
import { ShieldAlert, Anchor, Activity, Zap, Flame, AlertCircle } from 'lucide-react';

interface TelemetryBarProps {
  candidates: ProcessedTokenCandidate[];
  params: SamplingParameters;
  ragEnabled: boolean;
  historyLength?: number;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  candidates,
  params,
  ragEnabled,
  historyLength = 0,
}) => {
  // Compute telemetry metrics in real time (60 FPS memoized)
  const metrics = useMemo(() => {
    if (!candidates || candidates.length === 0) {
      return {
        hallucinationRisk: 0,
        groundingScore: 0,
        topDominance: 0,
        entropy: 0,
        repetitionRisk: false,
      };
    }

    // 1. Distribution Entropy
    const entropy = calculateTokenEntropy(candidates);

    // 2. Hallucination Risk %: blend of Temperature scaling and distribution entropy
    const tempFactor = Math.min(1.0, (params.temperature - 0.1) / 1.8);
    const entropyFactor = Math.min(1.0, entropy / 4.0);
    const hallucinationRisk = Math.round(
      Math.max(0, Math.min(100, (tempFactor * 0.6 + entropyFactor * 0.4) * 100))
    );

    // 3. Factual Grounding %: sum of probabilities of RAG grounded tokens
    let groundedProbSum = 0;
    if (ragEnabled) {
      candidates.forEach(c => {
        if (!c.isFiltered && c.is_rag_grounded) {
          groundedProbSum += c.probability;
        }
      });
    }
    const groundingScore = Math.round(Math.min(100, groundedProbSum * 100));

    // 4. Top Candidate Dominance Gap (Rank 1 vs Rank 2)
    const top1Prob = candidates[0]?.probability || 0;
    const top2Prob = candidates[1]?.probability || 0;
    const topDominance = Math.round(top1Prob * 100);

    // 5. Repetition Risk check: if history is long (>5 tokens) and frequency penalty is zero/very low
    const repetitionRisk = historyLength > 5 && params.frequencyPenalty < 0.05 && top1Prob > 0.4;

    return {
      hallucinationRisk,
      groundingScore,
      topDominance,
      entropy: Math.round(entropy * 100) / 100,
      repetitionRisk,
    };
  }, [candidates, params, ragEnabled, historyLength]);

  const getRiskColor = (risk: number) => {
    if (risk < 20) return { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', label: 'Low' };
    if (risk < 50) return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', label: 'Medium' };
    return { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30', label: 'High' };
  };

  const riskBadge = getRiskColor(metrics.hallucinationRisk);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl glass-panel-liquid border-white/10 px-4 py-2 text-[11px] font-mono shadow-lg">
      {/* Telemetry Indicator Group 1: Hallucination Risk */}
      <div className="flex items-center space-x-2">
        <Flame className={`h-3.5 w-3.5 ${riskBadge.text}`} />
        <span className="text-slate-400">Hallucination Risk:</span>
        <span className={`flex items-center space-x-1 rounded-full px-2 py-0.5 font-bold border ${riskBadge.bg} ${riskBadge.text} ${riskBadge.border}`}>
          <span>{metrics.hallucinationRisk}%</span>
          <span className="text-[9px] uppercase">({riskBadge.label})</span>
        </span>
      </div>

      {/* Telemetry Indicator Group 2: Factual Grounding Index */}
      <div className="flex items-center space-x-2">
        <Anchor className={`h-3.5 w-3.5 ${ragEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
        <span className="text-slate-400">Fact Grounding:</span>
        <span className={`font-bold ${ragEnabled ? 'text-cyan-300' : 'text-slate-500'}`}>
          {ragEnabled ? `${metrics.groundingScore}%` : 'OFF'}
        </span>
      </div>

      {/* Telemetry Indicator Group 3: Top Token Dominance */}
      <div className="flex items-center space-x-2">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-slate-400">Top-1 Dominance:</span>
        <span className="font-bold text-amber-300">{metrics.topDominance}%</span>
      </div>

      {/* Telemetry Indicator Group 4: Distribution Entropy */}
      <div className="flex items-center space-x-2">
        <Activity className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-slate-400">Entropy:</span>
        <span className="font-bold text-purple-300">{metrics.entropy} bits</span>
      </div>

      {/* Repetition Alert Badge */}
      {metrics.repetitionRisk && (
        <div className="flex items-center space-x-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300 border border-amber-500/30 animate-pulse">
          <AlertCircle className="h-3 w-3 text-amber-400" />
          <span>Repetition Risk (Increase Freq Penalty)</span>
        </div>
      )}
    </div>
  );
};
