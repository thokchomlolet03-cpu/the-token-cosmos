import React, { useMemo } from 'react';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { calculateTokenEntropy } from '../utils/samplingMath';
import { Anchor, Activity, Zap, Flame, AlertCircle } from 'lucide-react';

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

  const getRiskLabel = (risk: number) => {
    if (risk < 20) return 'Low';
    if (risk < 50) return 'Medium';
    return 'High';
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#0A0A0A] border border-white/10 px-4 py-2 text-[11px] font-mono">
      {/* Telemetry Indicator Group 1: Hallucination Risk */}
      <div className="flex items-center space-x-2">
        <Flame className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-400">Hallucination Risk:</span>
        <span className="bg-[#111111] border border-white/10 text-gray-200 px-2 py-0.5 rounded-md font-medium text-xs">
          {metrics.hallucinationRisk}% ({getRiskLabel(metrics.hallucinationRisk)})
        </span>
      </div>

      {/* Telemetry Indicator Group 2: Factual Grounding Index */}
      <div className="flex items-center space-x-2">
        <Anchor className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-400">Fact Grounding:</span>
        <span className="bg-[#111111] border border-white/10 text-gray-200 px-2 py-0.5 rounded-md font-medium text-xs">
          {ragEnabled ? `${metrics.groundingScore}%` : 'OFF'}
        </span>
      </div>

      {/* Telemetry Indicator Group 3: Top Token Dominance */}
      <div className="flex items-center space-x-2">
        <Zap className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-400">Top-1 Dominance:</span>
        <span className="text-gray-100 font-medium">{metrics.topDominance}%</span>
      </div>

      {/* Telemetry Indicator Group 4: Distribution Entropy */}
      <div className="flex items-center space-x-2">
        <Activity className="h-3.5 w-3.5 text-gray-400" />
        <span className="text-gray-400">Entropy:</span>
        <span className="text-gray-100 font-medium">{metrics.entropy} bits</span>
      </div>

      {/* Repetition Alert Badge */}
      {metrics.repetitionRisk && (
        <div className="flex items-center space-x-1 rounded-md bg-[#161616] border border-white/15 px-2 py-0.5 text-[10px] text-gray-300">
          <AlertCircle className="h-3 w-3 text-amber-400" />
          <span>Repetition Risk (Increase Freq Penalty)</span>
        </div>
      )}
    </div>
  );
};
