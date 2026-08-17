import React, { useState } from 'react';
import { SamplingParameters, PresetScenario, RawTokenCandidate } from '../types/sampling';
import { PRESET_SCENARIOS } from '../utils/tokenData';
import { CosmicGuide, ActiveParamType } from './CosmicGuide';
import { ActiveInteractionNotice } from './TheNavigator';
import { FrictionAnalysis } from './FrictionAnalysis';
import {
  Flame,
  CircleDot,
  Shield,
  Magnet,
  Sparkles,
  Bot,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  Plus,
  X,
  FileText,
  Anchor,
  Loader2,
  UserCheck,
  Code2,
  Search,
  Code,
  Clipboard,
  MessageSquare,
  Play,
  Copy,
  Check,
  Trash2,
  Terminal,
  AlertTriangle,
  Zap,
  Pause,
  RotateCcw,
} from 'lucide-react';

interface MissionControlProps {
  params: SamplingParameters;
  setParams: React.Dispatch<React.SetStateAction<SamplingParameters>>;
  prompt: string;
  setPrompt: (p: string) => void;
  outputLog?: string;
  onClearOutputLog?: () => void;
  systemPrompt: string;
  setSystemPrompt: (sp: string) => void;
  jsonSchema: string;
  setJsonSchema: (js: string) => void;
  jsonSchemaEnabled: boolean;
  setJsonSchemaEnabled: (e: boolean) => void;
  ragContext: string;
  setRagContext: (rc: string) => void;
  ragEnabled: boolean;
  setRagEnabled: (e: boolean) => void;
  onApplyPreset: (preset: PresetScenario) => void;
  onLaunchPrompt: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onGenerateNextStep?: () => void;
  onResetTimeline?: () => void;
  stepsCount?: number;
  onInteractFeature?: (notice: ActiveInteractionNotice) => void;
  isFetchingLogits?: boolean;
  rawLogits?: RawTokenCandidate[];
  isReasoningModel?: boolean;
}

export const MissionControl: React.FC<MissionControlProps> = ({
  params,
  setParams,
  prompt,
  setPrompt,
  outputLog = '',
  onClearOutputLog,
  systemPrompt,
  setSystemPrompt,
  jsonSchema,
  setJsonSchema,
  jsonSchemaEnabled,
  setJsonSchemaEnabled,
  ragContext,
  setRagContext,
  ragEnabled,
  setRagEnabled,
  onApplyPreset,
  onLaunchPrompt,
  isPlaying = false,
  onTogglePlay,
  onGenerateNextStep,
  onResetTimeline,
  stepsCount = 0,
  onInteractFeature,
  isFetchingLogits = false,
  rawLogits = [],
  isReasoningModel = false,
}) => {
  const [activeTab, setActiveTab] = useState<'context' | 'thermodynamics' | 'llmops' | 'friction'>('context');
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState<boolean>(false);
  const [isSystemExpanded, setIsSystemExpanded] = useState<boolean>(Boolean(systemPrompt.trim()));
  const [isSchemaExpanded, setIsSchemaExpanded] = useState<boolean>(jsonSchemaEnabled);
  const [isRagExpanded, setIsRagExpanded] = useState<boolean>(ragEnabled);
  const [newBiasWord, setNewBiasWord] = useState('');
  const [newBiasVal, setNewBiasVal] = useState<number>(-100);
  const [newStopSeq, setNewStopSeq] = useState('');
  const [copiedLog, setCopiedLog] = useState(false);

  const [activeParam, setActiveParam] = useState<ActiveParamType>('temperature');

  const notifyInteraction = (notice: Omit<ActiveInteractionNotice, 'timestamp'>) => {
    if (onInteractFeature) {
      onInteractFeature({
        ...notice,
        timestamp: Date.now(),
      });
    }
  };

  const updateParam = <K extends keyof SamplingParameters>(key: K, value: SamplingParameters[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleAddBias = () => {
    if (!newBiasWord.trim()) return;
    const word = newBiasWord.trim();
    setParams(prev => ({
      ...prev,
      logitBiases: {
        ...prev.logitBiases,
        [word]: newBiasVal,
      },
    }));

    notifyInteraction({
      feature: `Logit Bias ('${word}': ${newBiasVal})`,
      whatItIs: `Direct numerical modifier applied to token '${word}' before Softmax normalization.`,
      whyItIs: `Allows strict black-listing (-100) or heavy boosting (+10.0) of target vocabulary terms.`,
      impact: newBiasVal <= -50 ? `Implodes token '${word}' into a red Black Hole (0% probability).` : `Boosts token '${word}' toward the center.`,
      guidance: `Use -100 to ban unwanted buzzwords ("delve", "testament").`,
    });

    setNewBiasWord('');
  };

  const handleRemoveBias = (word: string) => {
    setParams(prev => {
      const next = { ...prev.logitBiases };
      delete next[word];
      return { ...prev, logitBiases: next };
    });
  };

  const handleAddStopSeq = () => {
    if (!newStopSeq.trim()) return;
    const seq = newStopSeq.trim();
    if (!params.stopSequences.includes(seq)) {
      updateParam('stopSequences', [...params.stopSequences, seq]);
    }
    notifyInteraction({
      feature: `Emergency Stop Sequence ("${seq}")`,
      whatItIs: `Text pattern string that instantly halts generation when encountered.`,
      whyItIs: `Prevents endless runaway text generation loops.`,
      impact: `Truncates response output immediately when candidate matches "${seq}".`,
      guidance: `Add \\n\\n or END to stop multi-paragraph answers cleanly.`,
    });
    setNewStopSeq('');
  };

  const handleRemoveStopSeq = (seq: string) => {
    updateParam(
      'stopSequences',
      params.stopSequences.filter(s => s !== seq)
    );
  };

  const handleCopyOutput = () => {
    if (!outputLog) return;
    navigator.clipboard.writeText(outputLog);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2000);
  };

  const getPresetIcon = (iconName: string) => {
    const className = "h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors duration-200";
    switch (iconName) {
      case 'FileText':
        return <FileText className={className} />;
      case 'Code':
        return <Code className={className} />;
      case 'Clipboard':
        return <Clipboard className={className} />;
      case 'MessageSquare':
        return <MessageSquare className={className} />;
      default:
        return <Sliders className={className} />;
    }
  };

  const wordCount = outputLog.trim() ? outputLog.trim().split(/\s+/).length : 0;

  return (
    <div className="glass-panel-matte flex flex-col h-full rounded-xl overflow-hidden bg-[#0a0c16] border border-white/10">
      {/* ─── 3-Tab Operational Navigation Bar ─── */}
      <div className="border-b border-white/10 bg-[#0e1122] px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1 w-full">
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === 'context'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Context Deck</span>
            </button>

            <button
              onClick={() => setActiveTab('thermodynamics')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === 'thermodynamics'
                  ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Thermodynamics</span>
            </button>

            <button
              onClick={() => setActiveTab('llmops')}
              className={`flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === 'llmops'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              <span>LLMOps</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Tab Content Scroll Area ─── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 1: THE CONTEXT DECK (Default)                            */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeTab === 'context' && (
          <div className="space-y-4">
            {/* Example Templates Collapsible */}
            <div className="rounded-lg border border-white/10 bg-[#111424] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-300 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                  <span className="font-semibold text-white tracking-tight">Example Task Templates</span>
                </div>
                {isTemplatesExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>

              {isTemplatesExpanded && (
                <div className="p-2.5 border-t border-white/10 grid grid-cols-2 gap-2 bg-[#090b14]">
                  {PRESET_SCENARIOS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onApplyPreset(preset);
                        setIsTemplatesExpanded(false);
                      }}
                      className="flex flex-col items-start p-2 rounded-md bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/40 text-left transition-all group"
                    >
                      <div className="flex items-center space-x-1.5 mb-0.5">
                        {getPresetIcon(preset.icon)}
                        <span className="text-[11px] font-semibold text-gray-200 group-hover:text-white truncate">
                          {preset.name}
                        </span>
                      </div>
                      <span className="text-[9px] text-gray-400 font-mono truncate w-full">{preset.subtitle}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt Input (Strictly Read/Write for User) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="prompt-input" className="text-xs font-semibold text-gray-200 flex items-center space-x-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-400" />
                  <span className="tracking-tight">Your Message (The Prompt)</span>
                </label>
                <span className="text-[10px] text-gray-400 font-mono">User Input</span>
              </div>
              <textarea
                id="prompt-input"
                aria-label="Enter custom prompt for LLM sampling"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-[#070913] border border-white/15 px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none font-mono leading-relaxed shadow-inner"
                placeholder="Type your prompt here..."
              />
            </div>

            {/* Engine Output Log (Strictly Isolated Read-Only Component) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-200">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="tracking-tight">Engine Output Stream</span>
                  {isFetchingLogits && (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-emerald-400/90 font-mono">
                    {wordCount} words • {outputLog.length} chars
                  </span>
                  {outputLog && (
                    <>
                      <button
                        onClick={handleCopyOutput}
                        title="Copy Output"
                        className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
                      >
                        {copiedLog ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                      {onClearOutputLog && (
                        <button
                          onClick={onClearOutputLog}
                          title="Clear Output"
                          className="text-gray-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="w-full min-h-[72px] max-h-[160px] overflow-y-auto rounded-lg bg-[#05070f] border border-emerald-500/20 p-2.5 font-mono text-xs text-emerald-300 leading-relaxed shadow-inner">
                {outputLog ? (
                  <div className="whitespace-pre-wrap">{outputLog}</div>
                ) : (
                  <span className="text-gray-600 text-[11px] italic">
                    Generated text will stream here without altering your input prompt...
                  </span>
                )}
              </div>
            </div>

            {/* ─── Generation & Stream Control Deck ─── */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!prompt.trim()}
                aria-label={isPlaying ? 'Pause stream generation' : 'Auto-generate continuous stream'}
                className={`w-full flex items-center justify-center space-x-2 rounded-lg py-2.5 px-3 text-xs font-bold transition-all shadow-md ${
                  isPlaying
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-4 w-4 fill-current" />
                    <span>Pause Continuous Stream</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Auto-Generate Continuous Stream</span>
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onGenerateNextStep}
                  disabled={isFetchingLogits || isPlaying || !prompt.trim()}
                  className="flex items-center justify-center space-x-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 py-2 px-2 text-xs font-medium text-gray-200 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <Zap className="h-3.5 w-3.5 text-blue-400" />
                  <span>+1 Next Token</span>
                </button>

                <button
                  type="button"
                  onClick={onLaunchPrompt}
                  disabled={isFetchingLogits || isPlaying || !prompt.trim()}
                  className="flex items-center justify-center space-x-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 py-2 px-2 text-xs font-medium text-gray-200 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {isFetchingLogits ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
                      <span>Mapping...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                      <span>Map Logits (1 Step)</span>
                    </>
                  )}
                </button>
              </div>

              {stepsCount > 0 && onResetTimeline && (
                <button
                  type="button"
                  onClick={onResetTimeline}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 text-[11px] font-mono text-gray-400 hover:text-rose-300 hover:bg-rose-500/10 rounded border border-transparent hover:border-rose-500/20 transition-all"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Generation Timeline ({stepsCount} tokens)</span>
                </button>
              )}
            </div>

            {/* RAG Reference Facts Accordion */}
            <div className="rounded-lg border border-white/10 bg-[#111424] overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const nextState = !ragEnabled;
                  setRagEnabled(nextState);
                  setIsRagExpanded(nextState);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Anchor className={`h-3.5 w-3.5 ${ragEnabled ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className="font-semibold text-white tracking-tight">Provide Reference Facts (RAG)</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                      ragEnabled ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-black text-gray-500 border border-white/10'
                    }`}
                  >
                    {ragEnabled ? 'GROUNDED' : 'OFF'}
                  </span>
                </div>
                {isRagExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>

              {isRagExpanded && (
                <div className="p-3 border-t border-white/10 space-y-2 bg-[#090b14]">
                  <p className="text-[10px] text-gray-400 font-mono">
                    Paste factual source text below. The AI will ground its token probabilities on this document.
                  </p>
                  <textarea
                    value={ragContext}
                    onChange={e => setRagContext(e.target.value)}
                    rows={2}
                    className="w-full rounded-md bg-[#05070f] border border-white/15 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="Example: The governing jurisdiction is the State of Delaware. Maximum liability cap is $2,500,000 USD."
                  />
                </div>
              )}
            </div>

            {/* AI Personality & System Persona Accordion */}
            <div className="rounded-lg border border-white/10 bg-[#111424] overflow-hidden">
              <button
                type="button"
                onClick={() => setIsSystemExpanded(!isSystemExpanded)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <UserCheck className={`h-3.5 w-3.5 ${systemPrompt.trim() ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className="font-semibold text-white tracking-tight">AI Personality & Persona</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                      systemPrompt.trim() ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-black text-gray-500 border border-white/10'
                    }`}
                  >
                    {systemPrompt.trim() ? 'ACTIVE' : 'DEFAULT'}
                  </span>
                </div>
                {isSystemExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>

              {isSystemExpanded && (
                <div className="p-3 border-t border-white/10 space-y-2 bg-[#090b14]">
                  <textarea
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    rows={2}
                    className="w-full rounded-md bg-[#05070f] border border-white/15 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="You are a senior PostgreSQL DBA. Reply only with valid SQL queries..."
                  />
                </div>
              )}
            </div>

            {/* JSON Schema Accordion */}
            <div className="rounded-lg border border-white/10 bg-[#111424] overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  const nextState = !jsonSchemaEnabled;
                  setJsonSchemaEnabled(nextState);
                  setIsSchemaExpanded(nextState);
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Code2 className={`h-3.5 w-3.5 ${jsonSchemaEnabled ? 'text-blue-400' : 'text-gray-500'}`} />
                  <span className="font-semibold text-white tracking-tight">Force Strict Formatting (JSON)</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${
                      jsonSchemaEnabled ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-black text-gray-500 border border-white/10'
                    }`}
                  >
                    {jsonSchemaEnabled ? 'ACTIVE' : 'OFF'}
                  </span>
                </div>
                {isSchemaExpanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
              </button>

              {isSchemaExpanded && (
                <div className="p-3 border-t border-white/10 space-y-2 bg-[#090b14]">
                  <textarea
                    value={jsonSchema}
                    onChange={e => setJsonSchema(e.target.value)}
                    rows={2}
                    className="w-full rounded-md bg-[#05070f] border border-white/15 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder='{ "type": "object", "properties": { "result": { "type": "string" } } }'
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 2: THE THERMODYNAMIC ENGINE                              */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeTab === 'thermodynamics' && (
          <div className="space-y-4">
            <CosmicGuide params={params} activeParam={activeParam} />

            {isReasoningModel ? (
              <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-3.5">
                <div className="flex items-center space-x-2 mb-1.5">
                  <Bot className="h-4 w-4 text-purple-400 animate-pulse" />
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Reasoning Active</span>
                </div>
                <p className="text-[10px] text-purple-200/70 mb-3 leading-relaxed font-mono">
                  Standard sampling parameters are bypassed during reasoning exploration.
                </p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-200">Thinking Budget (Tokens)</span>
                    <span className="font-mono font-bold text-purple-400">{params.maxThinkingTokens || 2048}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="4096"
                    step="50"
                    value={params.maxThinkingTokens || 2048}
                    onChange={e => setParams(prev => ({ ...prev, maxThinkingTokens: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Temperature Slider with Dynamic Badges */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="temp-slider" className="font-semibold text-gray-200 flex items-center space-x-1">
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      <span>Creativity vs. Focus (Temperature)</span>
                    </label>
                    <span className="font-mono font-bold text-amber-400">{params.temperature.toFixed(2)}</span>
                  </div>
                  <input
                    id="temp-slider"
                    type="range"
                    min="0.01"
                    max="2.0"
                    step="0.01"
                    value={params.temperature}
                    onFocus={() => setActiveParam('temperature')}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setActiveParam('temperature');
                      updateParam('temperature', val);
                    }}
                    className="w-full"
                  />
                  <div className="flex items-center space-x-1.5 mt-1">
                    {params.temperature <= 0.3 ? (
                      <span className="rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                        <ShieldCheck className="h-3 w-3 text-blue-400" />
                        <span>Factual Precision (Legal / Code) ❄️</span>
                      </span>
                    ) : params.temperature > 0.9 ? (
                      <span className="rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                        <Flame className="h-3 w-3 text-rose-400" />
                        <span>Creative Chaos (Brainstorm / Fiction) 🔥</span>
                      </span>
                    ) : (
                      <span className="rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-mono font-medium flex items-center space-x-1">
                        <Zap className="h-3 w-3 text-cyan-400" />
                        <span>Balanced Reasoning (General QA) ⚡</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Top-K Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="topk-slider" className="font-semibold text-gray-200">Word Limit (Top-K)</label>
                    <span className="font-mono font-bold text-blue-400">{params.topK}</span>
                  </div>
                  <input
                    id="topk-slider"
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={params.topK}
                    onFocus={() => setActiveParam('topK')}
                    onChange={e => {
                      const val = parseInt(e.target.value, 10);
                      setActiveParam('topK');
                      updateParam('topK', val);
                    }}
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-400 font-mono">
                    Restricts selection to top K candidate tokens. Ignores all tail vocabulary.
                  </p>
                </div>

                {/* Top-P Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="topp-slider" className="font-semibold text-gray-200">Confidence Cutoff (Top-P)</label>
                    <span className="font-mono font-bold text-blue-400">{(params.topP * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    id="topp-slider"
                    type="range"
                    min="0.01"
                    max="1.0"
                    step="0.01"
                    value={params.topP}
                    onFocus={() => setActiveParam('topP')}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setActiveParam('topP');
                      updateParam('topP', val);
                    }}
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-400 font-mono">
                    Cumulative probability mass cutoff. Dynamically expands or contracts the candidate pool.
                  </p>
                </div>

                {/* Min-P Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="minp-slider" className="font-semibold text-gray-200">Ignore Wild Guesses (Min-P)</label>
                    <span className="font-mono font-bold text-blue-400">{(params.minP * 100).toFixed(1)}%</span>
                  </div>
                  <input
                    id="minp-slider"
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.01"
                    value={params.minP}
                    onFocus={() => setActiveParam('minP')}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setActiveParam('minP');
                      updateParam('minP', val);
                    }}
                    className="w-full"
                  />
                  <p className="text-[10px] text-gray-400 font-mono">
                    Waterline flood cutoff. Discards tokens with probability below P% of the top candidate.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════ */}
        {/* TAB 3: LLMOPS & TRIAGE (Advanced)                            */}
        {/* ═════════════════════════════════════════════════════════════ */}
        {activeTab === 'llmops' && (
          <div className="space-y-4">
            {/* Enterprise Warning Header */}
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start space-x-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-200/90 leading-relaxed font-mono">
                <strong>LLMOps Context Warning:</strong> Setting Frequency or Presence penalties too high (&gt;0.6) artificially penalizes essential grammar words (<em>"the"</em>, <em>"is"</em>, <em>"of"</em>) and numbers, which shatters reasoning coherence and triggers hallucination loops.
              </div>
            </div>

            {/* Frequency Penalty */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="freq-penalty-slider" className="font-semibold text-gray-200">Exhaustion Meter (Frequency Penalty)</label>
                <span className="font-mono font-bold text-purple-400">{params.frequencyPenalty.toFixed(2)}</span>
              </div>
              <input
                id="freq-penalty-slider"
                type="range"
                min="-2.0"
                max="2.0"
                step="0.01"
                value={params.frequencyPenalty}
                onFocus={() => setActiveParam('frequencyPenalty')}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setActiveParam('frequencyPenalty');
                  updateParam('frequencyPenalty', val);
                }}
                className="w-full"
              />
              <p className="text-[10px] text-gray-400 font-mono">
                Penalizes tokens proportionally to their exact count in history. Breaks repetitive phrase loops.
              </p>
            </div>

            {/* Presence Penalty */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="presence-penalty-slider" className="font-semibold text-gray-200">Horizon Booster (Presence Penalty)</label>
                <span className="font-mono font-bold text-purple-400">{params.presencePenalty.toFixed(2)}</span>
              </div>
              <input
                id="presence-penalty-slider"
                type="range"
                min="-2.0"
                max="2.0"
                step="0.01"
                value={params.presencePenalty}
                onFocus={() => setActiveParam('presencePenalty')}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setActiveParam('presencePenalty');
                  updateParam('presencePenalty', val);
                }}
                className="w-full"
              />
              <p className="text-[10px] text-gray-400 font-mono">
                Flat penalty on any token already present in conversation context. Encourages topic shifts.
              </p>
            </div>

            {/* Logit Bias Manager */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label htmlFor="bias-word-input" className="text-xs font-semibold text-gray-200 flex items-center space-x-1.5">
                <Magnet className="h-3.5 w-3.5 text-purple-400" />
                <span>Magnet / Black Hole (Logit Bias)</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(params.logitBiases).map(([word, bias]) => (
                  <span
                    key={word}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono border ${
                      bias < 0
                        ? 'bg-rose-950/40 text-rose-300 border-rose-800/50'
                        : 'bg-blue-950/40 text-blue-300 border-blue-800/50'
                    }`}
                  >
                    <span>'{word}':</span>
                    <span className="font-bold">{bias > 0 ? `+${bias}` : bias}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveBias(word)}
                      className="hover:text-white ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="bias-word-input"
                  type="text"
                  placeholder="Target word (e.g. delve)"
                  value={newBiasWord}
                  onChange={e => setNewBiasWord(e.target.value)}
                  className="flex-1 rounded-md bg-[#05070f] border border-white/15 px-2.5 py-1 text-xs text-gray-100 font-mono focus:border-blue-500 focus:outline-none"
                />
                <select
                  value={newBiasVal}
                  onChange={e => setNewBiasVal(parseFloat(e.target.value))}
                  className="rounded-md bg-[#05070f] border border-white/15 px-2 py-1 text-xs text-gray-200 font-mono focus:outline-none"
                >
                  <option value={-100}>-100 (Black Hole / Ban)</option>
                  <option value={-5}>-5.0 (Discourage)</option>
                  <option value={5}>+5.0 (Boost)</option>
                  <option value={10}>+10.0 (Magnet)</option>
                </select>
                <button
                  type="button"
                  onClick={handleAddBias}
                  className="rounded-md bg-purple-600 hover:bg-purple-500 text-white p-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Emergency Stop Sequences */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label htmlFor="stop-seq-input" className="text-xs font-semibold text-gray-200 flex items-center space-x-1.5">
                <CircleDot className="h-3.5 w-3.5 text-amber-400" />
                <span>Emergency Brake (Stop Sequences)</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {params.stopSequences.map(seq => (
                  <span
                    key={seq}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-mono bg-amber-950/40 text-amber-300 border border-amber-800/50"
                  >
                    <span>"{seq}"</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveStopSeq(seq)}
                      className="hover:text-white ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="stop-seq-input"
                  type="text"
                  placeholder="e.g. \n\n or END"
                  value={newStopSeq}
                  onChange={e => setNewStopSeq(e.target.value)}
                  className="flex-1 rounded-md bg-[#05070f] border border-white/15 px-2.5 py-1 text-xs text-gray-100 font-mono focus:border-amber-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddStopSeq}
                  className="rounded-md bg-amber-600/30 text-amber-300 border border-amber-500/40 p-1.5 hover:bg-amber-600/40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Friction Analysis Integration */}
            <div className="pt-2 border-t border-white/10">
              <FrictionAnalysis params={params} rawLogits={rawLogits} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
