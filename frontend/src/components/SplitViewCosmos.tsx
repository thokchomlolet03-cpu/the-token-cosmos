import React from 'react';
import { ProcessedTokenCandidate, SamplingParameters } from '../types/sampling';
import { StarfieldCanvas } from './StarfieldCanvas';
import { Layers } from 'lucide-react';

interface SplitViewCosmosProps {
  baselineCandidates: ProcessedTokenCandidate[];
  ragCandidates: ProcessedTokenCandidate[];
  params: SamplingParameters;
  onSelectToken?: (token: ProcessedTokenCandidate) => void;
}

export const SplitViewCosmos: React.FC<SplitViewCosmosProps> = ({
  baselineCandidates,
  ragCandidates,
  params,
  onSelectToken,
}) => {
  return (
    <div className="w-full h-full min-h-[480px] grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Baseline AI Starfield */}
      <div className="relative w-full h-full border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <StarfieldCanvas
          candidates={baselineCandidates}
          params={params}
          ragEnabled={false}
          onSelectToken={onSelectToken}
          title="Baseline AI (No RAG)"
          subtitle="Unconstrained LLM Vocabulary Distribution"
        />
      </div>

      {/* Grounded AI RAG Starfield */}
      <div className="relative w-full h-full border border-cyan-500/30 rounded-2xl overflow-hidden shadow-neon-cyan">
        <StarfieldCanvas
          candidates={ragCandidates}
          params={params}
          ragEnabled={true}
          onSelectToken={onSelectToken}
          title="Grounded AI (RAG ON)"
          subtitle="Factual Anchor Shifting Logit Mass"
        />
      </div>
    </div>
  );
};
