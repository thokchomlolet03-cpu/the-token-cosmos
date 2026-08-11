import React from 'react';
import { FlightStep } from '../types/sampling';
import { Play, RotateCcw, ChevronLeft, ChevronRight, Orbit } from 'lucide-react';

interface FlightPathTimelineProps {
  steps: FlightStep[];
  currentStepIndex: number;
  onSelectStep: (index: number) => void;
  onGenerateNextStep: () => void;
  onResetTimeline: () => void;
  isGenerating?: boolean;
}

export const FlightPathTimeline: React.FC<FlightPathTimelineProps> = ({
  steps,
  currentStepIndex,
  onSelectStep,
  onGenerateNextStep,
  onResetTimeline,
  isGenerating = false,
}) => {
  const currentSentence = steps.map(s => s.selectedToken.token_str).join('');

  return (
    <div className="glass-panel w-full rounded-2xl p-4 border border-cyan-500/20 shadow-2xl flex flex-col space-y-3">
      {/* Flight Control Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Orbit className="h-5 w-5 text-cyan-400 animate-spin-slow" />
          <div>
            <h3 className="text-sm font-bold text-slate-100">Sentence Flight Path Trajectory</h3>
            <p className="text-xs text-slate-400">
              Click any token step to rewind the interactive Cosmos to that exact moment of decision
            </p>
          </div>
        </div>

        {/* Step Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => currentStepIndex > 0 && onSelectStep(currentStepIndex - 1)}
            disabled={currentStepIndex <= 0}
            aria-label="Rewind to previous token generation step"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Rewind Step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-xs font-mono font-bold text-cyan-400 px-2">
            Step {currentStepIndex + 1} of {steps.length}
          </span>

          <button
            onClick={() => currentStepIndex < steps.length - 1 && onSelectStep(currentStepIndex + 1)}
            disabled={currentStepIndex >= steps.length - 1}
            aria-label="Forward to next token generation step"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Forward Step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <button
            onClick={onGenerateNextStep}
            disabled={isGenerating}
            aria-label="Sample next token in sentence trajectory"
            className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-neon-cyan hover:opacity-90 transition-opacity"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isGenerating ? 'Sampling...' : 'Sample Next Token'}</span>
          </button>

          <button
            onClick={onResetTimeline}
            aria-label="Reset constellation flight path trajectory"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
            title="Reset Constellation Flight Path"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Generated Sentence Preview */}
      <div className="rounded-xl bg-slate-950/80 px-4 py-2 border border-slate-800 flex items-center space-x-2">
        <span className="text-xs font-bold uppercase text-slate-400 font-mono">Output:</span>
        <span className="text-xs font-mono text-cyan-200 tracking-wide">
          "{currentSentence}"
        </span>
      </div>

      {/* Constellation Step Nodes */}
      <div className="relative flex items-center space-x-3 overflow-x-auto py-2 px-1" role="list">
        {/* Constellation line background */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-slate-800 -translate-y-1/2 z-0" />

        {steps.map((step, idx) => {
          const isActive = idx === currentStepIndex;
          const isGrounded = step.selectedToken.is_rag_grounded;

          return (
            <button
              key={idx}
              onClick={() => onSelectStep(idx)}
              role="listitem"
              aria-label={`Step ${idx + 1}: Token ${step.selectedToken.token_str.trim()} with ${(step.selectedToken.probability * 100).toFixed(0)}% probability`}
              className={`relative z-10 flex flex-col items-center group transition-all transform hover:-translate-y-0.5 ${
                isActive ? 'scale-105' : ''
              }`}
            >
              {/* Star Node circle */}
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500 text-slate-950 shadow-neon-cyan ring-4 ring-cyan-500/20'
                    : isGrounded
                    ? 'border-cyan-400/60 bg-cyan-950/80 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 group-hover:border-slate-500'
                }`}
              >
                #{idx + 1}
              </div>

              {/* Token word pill */}
              <span
                className={`mt-1.5 rounded-md px-2 py-0.5 text-[11px] font-mono whitespace-nowrap border transition-all ${
                  isActive
                    ? 'border-cyan-400/60 bg-slate-900 text-cyan-300 font-semibold'
                    : 'border-slate-800 bg-slate-950/80 text-slate-400 group-hover:text-slate-200'
                }`}
              >
                "{step.selectedToken.token_str.trim()}"
              </span>

              {/* Probability pill */}
              <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                {(step.selectedToken.probability * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
