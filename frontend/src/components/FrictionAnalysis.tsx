import React, { useState, useMemo } from 'react';
import {
  SamplingParameters,
  RawTokenCandidate,
  FrictionReport,
  FrictionSeverity,
} from '../types/sampling';
import { analyzeFriction } from '../utils/samplingMath';
import {
  Search,
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Activity,
  Zap,
  FileWarning,
  Gauge,
  Play,
} from 'lucide-react';

interface FrictionAnalysisProps {
  params: SamplingParameters;
  rawLogits: RawTokenCandidate[];
}

const SEVERITY_CONFIG: Record<FrictionSeverity, {
  icon: React.ElementType;
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotColor: string;
}> = {
  critical: {
    icon: AlertTriangle,
    label: 'Critical',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-300',
    borderClass: 'border-red-500/30',
    dotColor: '#ef4444',
  },
  warning: {
    icon: AlertCircle,
    label: 'Warning',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-500/30',
    dotColor: '#f59e0b',
  },
  info: {
    icon: Info,
    label: 'Info',
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-300',
    borderClass: 'border-sky-500/30',
    dotColor: '#38bdf8',
  },
};

const SAMPLE_TEXT = `Our onboarding process begins with a comprehensive background check taking 3-5 business days. Once completed, new hires receive their equipment and access credentials.

However, the IT provisioning system requires manual approval from three separate department heads, each operating on different schedules.

After equipment setup, employees must complete a mandatory 40-hour training program. But the training materials haven't been updated since 2019 and reference deprecated internal tools.

Despite these challenges, we expect full productivity within the first two weeks of employment.`;

export const FrictionAnalysis: React.FC<FrictionAnalysisProps> = ({
  params,
  rawLogits,
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [report, setReport] = useState<FrictionReport | null>(null);
  const [sensitivity, setSensitivity] = useState<number>(0.5);
  const [expandedPoints, setExpandedPoints] = useState<Set<number>>(new Set());
  const [showPhraseScores, setShowPhraseScores] = useState<boolean>(false);

  const handleAnalyze = async () => {
    if (!inputText.trim()) return;
    setIsAnalyzing(true);
    setReport(null);

    try {
      const result = await analyzeFriction(inputText, rawLogits, params, sensitivity);
      setReport(result);
      setExpandedPoints(new Set());
    } catch (err) {
      console.error('Friction analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadSample = () => {
    setInputText(SAMPLE_TEXT);
    setReport(null);
  };

  const toggleExpanded = (idx: number) => {
    setExpandedPoints(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Score color gradient for phrase heatmap
  const getScoreColor = (normalizedScore: number): string => {
    if (normalizedScore > 0.7) return '#10b981'; // green
    if (normalizedScore > 0.4) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const frictionCounts = useMemo(() => {
    if (!report) return { critical: 0, warning: 0, info: 0 };
    return {
      critical: report.frictionPoints.filter(p => p.severity === 'critical').length,
      warning: report.frictionPoints.filter(p => p.severity === 'warning').length,
      info: report.frictionPoints.filter(p => p.severity === 'info').length,
    };
  }, [report]);

  return (
    <div className="flex flex-col space-y-4 h-full">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/20">
          <Search className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Friction Analysis</h3>
          <p className="text-[10px] text-gray-400 font-mono">
            Joint log-probability • Drop-off detection
          </p>
        </div>
      </div>

      {/* Text Input Area */}
      <div className="relative">
        <textarea
          value={inputText}
          onChange={e => { setInputText(e.target.value); setReport(null); }}
          placeholder="Paste a business process, code block, job description, or any complex text to analyze for logical friction points..."
          rows={6}
          className="w-full rounded-lg bg-[#111111] border border-white/10 px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none focus:ring-0 resize-none font-mono leading-relaxed"
        />
        <div className="absolute bottom-2 right-2 flex items-center space-x-1.5">
          <button
            onClick={handleLoadSample}
            className="btn-secondary-matte px-2.5 py-1 text-[11px]"
          >
            Load Contract Sample
          </button>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !inputText.trim()}
            className="btn-primary-matte px-3 py-1 text-xs flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Scanning...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Analyze Friction</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sensitivity Slider */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5">
          <Gauge className="h-3.5 w-3.5 text-orange-400" />
          <span className="text-[11px] font-bold text-slate-300">Sensitivity</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={sensitivity}
          onChange={e => setSensitivity(parseFloat(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-slate-800 accent-orange-500"
        />
        <span className="text-[10px] font-mono text-orange-300 w-12 text-right">
          {sensitivity < 0.33 ? 'Loose' : sensitivity < 0.66 ? 'Balanced' : 'Strict'}
        </span>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || !inputText.trim()}
        className="flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Analyzing Friction...</span>
          </>
        ) : (
          <>
            <Zap className="h-3.5 w-3.5" />
            <span>Analyze Friction Points</span>
          </>
        )}
      </button>

      {/* Analysis Report */}
      {report && (
        <div className="flex flex-col space-y-3 overflow-y-auto flex-1 min-h-0">
          {/* Summary Dashboard */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Joint Log-Prob</div>
              <div className="text-sm font-bold text-cyan-300 font-mono">{report.totalJointLogProb.toFixed(1)}</div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Avg Score</div>
              <div className="text-sm font-bold text-purple-300 font-mono">{report.averageLogProb.toFixed(2)}</div>
            </div>
            <div className="rounded-lg bg-slate-950/80 border border-slate-800 p-2 text-center">
              <div className="text-[10px] text-slate-400 font-mono uppercase">Analysis</div>
              <div className="text-sm font-bold text-amber-300 font-mono">{report.analysisTimeMs}ms</div>
            </div>
          </div>

          {/* Friction Severity Counts */}
          <div className="flex items-center space-x-2">
            {(['critical', 'warning', 'info'] as FrictionSeverity[]).map(sev => {
              const config = SEVERITY_CONFIG[sev];
              const count = frictionCounts[sev];
              const Icon = config.icon;
              return (
                <div
                  key={sev}
                  className={`flex items-center space-x-1 rounded-lg px-2 py-1 text-[10px] font-mono font-bold border ${config.bgClass} ${config.textClass} ${config.borderClass}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{count} {config.label}</span>
                </div>
              );
            })}
          </div>

          {/* Phrase Heatmap Toggle */}
          <button
            onClick={() => setShowPhraseScores(!showPhraseScores)}
            className="flex items-center space-x-1.5 text-[11px] text-slate-300 hover:text-orange-300 transition-colors"
          >
            <Activity className="h-3.5 w-3.5 text-orange-400" />
            <span className="font-bold">Phrase-Level Heatmap</span>
            {showPhraseScores ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {showPhraseScores && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto rounded-lg bg-slate-950/60 p-2 border border-slate-800">
              {report.phrases.map((phrase, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2 rounded-md px-2 py-1 text-[10px] font-mono"
                >
                  <span
                    className="shrink-0 mt-1 h-2 w-2 rounded-full"
                    style={{ backgroundColor: getScoreColor(phrase.normalizedScore) }}
                  />
                  <span className="text-slate-300 leading-relaxed flex-1">{phrase.text}</span>
                  <span
                    className="shrink-0 font-bold"
                    style={{ color: getScoreColor(phrase.normalizedScore) }}
                  >
                    {phrase.logProb.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Friction Points — Collapsible Cards */}
          {report.frictionPoints.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-1.5">
                <FileWarning className="h-3.5 w-3.5 text-red-400" />
                <span className="text-[11px] font-bold text-slate-200">
                  Operational Friction Report ({report.frictionPoints.length} points)
                </span>
              </div>

              {report.frictionPoints.map((fp, idx) => {
                const config = SEVERITY_CONFIG[fp.severity];
                const Icon = config.icon;
                const isExpanded = expandedPoints.has(idx);

                return (
                  <div
                    key={idx}
                    className={`rounded-xl border ${config.borderClass} ${config.bgClass} overflow-hidden`}
                  >
                    <button
                      onClick={() => toggleExpanded(idx)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left"
                    >
                      <div className="flex items-center space-x-2">
                        <Icon className={`h-3.5 w-3.5 ${config.textClass}`} />
                        <span className={`text-[11px] font-bold ${config.textClass}`}>
                          {config.label} — Phrase #{fp.phraseIndex + 1}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Drop: {fp.logProbDrop.toFixed(2)}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-2.5 space-y-1.5 border-t border-slate-800/50">
                        <div className="mt-2 rounded-md bg-slate-950/60 px-2.5 py-1.5 text-[10px] font-mono text-slate-300 leading-relaxed">
                          "{fp.phrase}"
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                          <div>
                            <span className="text-slate-500">Previous Log-Prob:</span>{' '}
                            <span className="text-emerald-300">{fp.previousLogProb}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Current Log-Prob:</span>{' '}
                            <span className="text-red-300">{fp.currentLogProb}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-300 leading-relaxed italic">
                          💡 {fp.reason}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center">
              <span className="text-xs text-emerald-300 font-medium">
                ✅ No significant friction points detected at current sensitivity level
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
