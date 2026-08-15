import React, { useState } from 'react';
import { LabScenario, LabEvaluationResult } from '../../types/labs';
import { SamplingParameters } from '../../types/sampling';
import { LAB_SCENARIOS } from '../../data/labScenarios';

interface LabPanelProps {
  activeLab: LabScenario;
  onSelectLab: (lab: LabScenario) => void;
  evaluation: LabEvaluationResult;
  params: SamplingParameters;
  onUpdateParams: (params: Partial<SamplingParameters>) => void;
  onResetScenario: () => void;
  completedLabIds: string[];
}

export const LabPanel: React.FC<LabPanelProps> = ({
  activeLab,
  onSelectLab,
  evaluation,
  params,
  onUpdateParams,
  onResetScenario,
  completedLabIds,
}) => {
  const [showHints, setShowHints] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentIndex = LAB_SCENARIOS.findIndex((l) => l.id === activeLab.id);
  const nextLab = currentIndex < LAB_SCENARIOS.length - 1 ? LAB_SCENARIOS[currentIndex + 1] : null;

  return (
    <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-5 backdrop-blur-md shadow-2xl flex flex-col gap-4 text-white">
      {/* Header & Scenario Navigation */}
      <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/40">
            {activeLab.badge}
          </span>
          <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
            activeLab.difficulty === 'beginner'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : activeLab.difficulty === 'intermediate'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
          }`}>
            {activeLab.difficulty}
          </span>
        </div>

        {/* Scenario Switcher dropdown */}
        <select
          value={activeLab.id}
          onChange={(e) => {
            const found = LAB_SCENARIOS.find((l) => l.id === e.target.value);
            if (found) onSelectLab(found);
          }}
          className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-cyan-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
        >
          {LAB_SCENARIOS.map((scenario, idx) => (
            <option key={scenario.id} value={scenario.id}>
              {completedLabIds.includes(scenario.id) ? '✅ ' : `${idx + 1}. `}
              {scenario.title}
            </option>
          ))}
        </select>
      </div>

      {/* Title & Concept */}
      <div>
        <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300">
          {activeLab.title}
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">{activeLab.subtitle}</p>
      </div>

      {/* Description & Objective */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3.5 flex flex-col gap-2 text-xs">
        <div>
          <span className="font-semibold text-cyan-300">Concept: </span>
          <span className="text-slate-300">{activeLab.conceptTaught}</span>
        </div>
        <p className="text-slate-300 leading-relaxed">{activeLab.description}</p>
        <div className="bg-cyan-950/40 border border-cyan-500/30 rounded p-2 text-cyan-200">
          <span className="font-bold text-cyan-400">🎯 Objective: </span>
          {activeLab.objective}
        </div>
      </div>

      {/* Status & Evaluation Banner */}
      <div className={`p-3.5 rounded-lg border flex flex-col gap-2 transition-all duration-300 ${
        evaluation.status === 'passed'
          ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200 shadow-lg shadow-emerald-900/20'
          : evaluation.status === 'aborted'
          ? 'bg-red-950/50 border-red-500/60 text-red-200 shadow-lg shadow-red-900/20'
          : evaluation.status === 'failed'
          ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
          : evaluation.status === 'running'
          ? 'bg-blue-950/40 border-blue-500/40 text-blue-200 animate-pulse'
          : 'bg-slate-800/40 border-slate-700/40 text-slate-400'
      }`}>
        <div className="flex items-center justify-between">
          <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
            {evaluation.status === 'passed' && '🎉 STATUS: SOLVED'}
            {evaluation.status === 'aborted' && '🛑 STATUS: LOOP HALTED'}
            {evaluation.status === 'failed' && '⚠️ STATUS: INCOMPLETE'}
            {evaluation.status === 'running' && '⚡ STATUS: EVALUATING...'}
            {evaluation.status === 'unattempted' && '⏳ STATUS: READY TO ATTEMPT'}
          </span>
          {evaluation.status === 'passed' && nextLab && (
            <button
              onClick={() => onSelectLab(nextLab)}
              className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow"
            >
              Next Challenge ➔
            </button>
          )}
        </div>
        <p className="text-xs leading-relaxed">{evaluation.feedback}</p>

        {/* Live Rule Checklist */}
        <div className="mt-1 pt-2 border-t border-white/10 flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Verification Rules:</span>
          {activeLab.verificationRules.map((rule) => {
            const isPassed = evaluation.passedRuleIds.includes(rule.id);
            return (
              <div key={rule.id} className="flex items-center gap-2 text-xs">
                <span>{isPassed ? '✅' : '❌'}</span>
                <span className={isPassed ? 'text-emerald-300 font-medium' : 'text-slate-400'}>
                  {rule.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Hints Accordion */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowHints(!showHints)}
          className="flex items-center justify-between text-xs text-cyan-400 hover:text-cyan-300 font-semibold py-1 focus:outline-none transition-colors"
        >
          <span>💡 Guided Hints & Parameter Targets ({activeLab.hints.length})</span>
          <span>{showHints ? '▲ Hide' : '▼ View Hints'}</span>
        </button>
        {showHints && (
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg p-3 flex flex-col gap-2 text-xs text-slate-300 animate-fadeIn">
            <ul className="list-disc list-inside space-y-1 text-slate-300">
              {activeLab.hints.map((hint, idx) => (
                <li key={idx}>{hint}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
        <button
          onClick={onResetScenario}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
        >
          ↺ Reset Lab State
        </button>

        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/40 transition-colors"
        >
          {showExplanation ? 'Hide Explanation' : '📖 Deep Explanation'}
        </button>
      </div>

      {/* Deep Technical Explanation Modal/Drawer */}
      {showExplanation && (
        <div className="bg-purple-950/30 border border-purple-500/30 rounded-lg p-3.5 text-xs text-purple-200 leading-relaxed flex flex-col gap-1.5 animate-fadeIn">
          <span className="font-bold text-purple-300">Why this happens in production:</span>
          <p>{activeLab.solutionExplanation}</p>
        </div>
      )}
    </div>
  );
};
