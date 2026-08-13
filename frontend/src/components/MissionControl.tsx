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
  Compass,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sliders,
  Plus,
  X,
  FileText,
  Anchor,
  Rocket,
  Loader2,
  UserCheck,
  Code2,
  Search,
} from 'lucide-react';

interface MissionControlProps {
  params: SamplingParameters;
  setParams: React.Dispatch<React.SetStateAction<SamplingParameters>>;
  prompt: string;
  setPrompt: (p: string) => void;
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
  onInteractFeature,
  isFetchingLogits = false,
  rawLogits = [],
  isReasoningModel = false,
}) => {
  const [activeTab, setActiveTab] = useState<'sampling' | 'friction'>('sampling');
  const [isSystemExpanded, setIsSystemExpanded] = useState<boolean>(Boolean(systemPrompt.trim()));
  const [isSchemaExpanded, setIsSchemaExpanded] = useState<boolean>(jsonSchemaEnabled);
  const [isRagExpanded, setIsRagExpanded] = useState<boolean>(ragEnabled);
  const [isPenaltiesExpanded, setIsPenaltiesExpanded] = useState<boolean>(false);
  const [newBiasWord, setNewBiasWord] = useState('');
  const [newBiasVal, setNewBiasVal] = useState<number>(-100);
  const [newStopSeq, setNewStopSeq] = useState('');

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
      impact: newBiasVal <= -50 ? `Implodes token '${word}' into a red Black Hole icon on the outer fringe (0% chance).` : `Pulls token '${word}' toward the center supergiant star.`,
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

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case 'Bot':
        return <Bot className="h-4 w-4 text-slate-400" />;
      case 'Sparkles':
        return <Sparkles className="h-4 w-4 text-slate-400" />;
      case 'Compass':
        return <Compass className="h-4 w-4 text-slate-400" />;
      case 'ShieldCheck':
        return <ShieldCheck className="h-4 w-4 text-slate-400" />;
      default:
        return <Sliders className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="glass-panel-matte flex flex-col h-full rounded-xl overflow-hidden">
      {/* Header with Tab Switching */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#1c1c21] px-5 py-3">
        <div className="flex items-center space-x-2">
          <Sliders className="h-4 w-4 text-blue-400" />
          <h2 className="text-sm font-bold text-white tracking-tight hidden sm:block">Mission Control</h2>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-full bg-[#18181b] p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('sampling')}
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activeTab === 'sampling'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Sampling</span>
          </button>
          <button
            onClick={() => setActiveTab('friction')}
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
              activeTab === 'friction'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Friction Analysis</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {activeTab === 'friction' ? (
          <FrictionAnalysis params={params} rawLogits={rawLogits} />
        ) : (
          <div className="space-y-6">
            {/* Preset Scenarios ("Vibe Buttons") */}
            <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-gray-400 flex items-center space-x-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5 text-gray-300" />
              <span>Example Tasks</span>
            </label>
            <p className="text-[10px] text-gray-500 mb-2.5">Click one to see how the AI handles different jobs.</p>
            <div className="grid grid-cols-2 gap-2">
            {PRESET_SCENARIOS.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  onApplyPreset(preset);
                  notifyInteraction({
                    feature: `Preset: ${preset.name}`,
                    whatItIs: `Pre-configured hyperparameter setup calibrated for ${preset.name}.`,
                    whyItIs: `Demonstrates ideal settings for specific AI tasks (e.g. strict coding vs creative writing).`,
                    impact: `Re-allocates Temperature to ${preset.params.temperature}, Top-K to ${preset.params.topK}, and toggles RAG.`,
                    guidance: `Click presets to instantly jump between robotic factual accuracy and wild storytelling!`,
                  });
                }}
                aria-label={`Apply ${preset.name} preset: ${preset.subtitle}`}
                className="glass-panel-interactive-matte flex flex-col items-start p-3 rounded-lg text-left border border-white/10 hover:border-white/20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group"
              >
                <div className="flex items-center space-x-2 w-full mb-1">
                  {getPresetIcon(preset.icon)}
                  <span className="text-xs font-semibold text-gray-200 group-hover:text-white transition-colors duration-200 truncate">
                    {preset.name}
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-mono">{preset.subtitle}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Feature 1: System Override (Persona) Accordion */}
        <div className="rounded-xl border border-white/10 bg-[#111111] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsSystemExpanded(!isSystemExpanded)}
            aria-label="Toggle AI Personality and Role instructions"
            aria-expanded={isSystemExpanded}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <UserCheck className={`h-4 w-4 ${systemPrompt.trim() ? 'text-white' : 'text-gray-500'}`} />
              <span className="font-semibold text-white tracking-tight">AI Personality & Role</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-medium ${
                  systemPrompt.trim() ? 'bg-white/10 text-white border border-white/15' : 'bg-black text-gray-400 border border-white/10'
                }`}
              >
                {systemPrompt.trim() ? 'ACTIVE' : 'DEFAULT'}
              </span>
            </div>
            {isSystemExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {isSystemExpanded && (
            <div className="p-3 border-t border-white/10 space-y-2 bg-[#0A0A0A]">
              <p className="text-[11px] text-gray-400 leading-relaxed font-mono">
                Tell the AI who it should act like (e.g., <em>"You are a helpful tutor"</em>). Shifts the baseline word probabilities.
              </p>
              <textarea
                aria-label="System prompt persona instructions"
                value={systemPrompt}
                onChange={e => {
                  setSystemPrompt(e.target.value);
                  notifyInteraction({
                    feature: 'System Persona Override',
                    whatItIs: 'Top-level behavioral directive injected into model chat template.',
                    whyItIs: 'Establishes domain persona expertise before processing user prompts.',
                    impact: 'Shifts baseline raw logit distribution across entire vocabulary.',
                    guidance: 'Use for domain task specialization (e.g. SQL DBA, Legal clause parser).',
                  });
                }}
                rows={2}
                className="w-full rounded-lg bg-[#111111] border border-white/10 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:ring-0 focus:outline-none font-mono"
                placeholder="You are a senior PostgreSQL DBA. Reply only with valid SQL queries..."
              />
            </div>
          )}
        </div>

        {/* Custom Prompt Input & Launch Console */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="prompt-input" className="text-xs font-semibold text-gray-300 flex items-center space-x-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-white tracking-tight">Your Message (The Prompt)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Custom Prompt</span>
            </div>
            <textarea
              id="prompt-input"
              aria-label="Enter custom prompt for LLM sampling"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={2}
              className="w-full rounded-lg bg-[#111111] border border-white/10 px-3 py-2 text-xs text-gray-100 placeholder:text-gray-600 focus:border-gray-500 focus:outline-none focus:ring-0 resize-none font-mono leading-relaxed"
              placeholder="Type your question or starting sentence here..."
            />
          </div>

          {/* RAG Fact Injector Collapsible Box */}
          <div className="rounded-xl border border-white/10 bg-[#111111] overflow-hidden">
            <button
              onClick={() => {
                const nextState = !ragEnabled;
                setRagEnabled(nextState);
                setIsRagExpanded(nextState);
                notifyInteraction({
                  feature: `RAG Grounding (${nextState ? 'ON' : 'OFF'})`,
                  whatItIs: 'Retrieval-Augmented Generation context tethering.',
                  whyItIs: 'Forces the LLM to base its predictions on user-provided factual documents.',
                  impact: nextState ? 'Pulls grounded document terms to the center supergiant star via cyan laser beams.' : 'Un-tethers predictions, allowing parametric memory generation.',
                  guidance: 'Turn ON when accuracy is non-negotiable.',
                });
              }}
              aria-label={ragEnabled ? 'Turn RAG Fact Anchor OFF' : 'Turn RAG Fact Anchor ON'}
              aria-expanded={isRagExpanded}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Anchor className={`h-4 w-4 ${ragEnabled ? 'text-white' : 'text-gray-500'}`} />
                <span className="font-semibold text-white tracking-tight">Provide Reference Facts</span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-mono font-medium ${
                    ragEnabled ? 'bg-white/10 text-white border border-white/15' : 'bg-black text-gray-400 border border-white/10'
                  }`}
                >
                  {ragEnabled ? 'ON • Grounded' : 'OFF'}
                </span>
              </div>
              {isRagExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {isRagExpanded && (
              <div className="p-3 border-t border-white/10 space-y-2 bg-[#0A0A0A]">
                <div className="flex items-center space-x-1.5 text-[11px] text-gray-300 font-mono">
                  <Anchor className="h-3.5 w-3.5 text-gray-400" />
                  <span>Paste reference facts here. The AI will read this instead of guessing.</span>
                </div>
                <textarea
                  aria-label="Retrieved factual context for RAG grounding"
                  value={ragContext}
                  onChange={e => setRagContext(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="Example: Employees must be in the office Tuesday through Thursday. Monday and Friday are remote."
                />
              </div>
            )}
          </div>

          {/* Feature 4: Structured Output "Orbital Track" JSON Schema Accordion */}
          <div className="rounded-xl border border-white/10 bg-[#111111] overflow-hidden">
            <button
              onClick={() => {
                const nextState = !jsonSchemaEnabled;
                setJsonSchemaEnabled(nextState);
                setIsSchemaExpanded(nextState);
                notifyInteraction({
                  feature: `Structured Output JSON Schema (${nextState ? 'ACTIVE' : 'OFF'})`,
                  whatItIs: 'Rigid JSON grammar rule enforcer.',
                  whyItIs: 'Guarantees the AI returns valid JSON data structures instead of plain conversational prose.',
                  impact: nextState ? 'Non-conforming tokens drop to 0% probability and turn red, proving format compliance.' : 'Restores normal dictionary token vocabulary.',
                  guidance: 'Activate when building automated API data extraction pipelines.',
                });
              }}
              aria-label={jsonSchemaEnabled ? 'Turn Structured Output JSON Schema OFF' : 'Turn Structured Output JSON Schema ON'}
              aria-expanded={isSchemaExpanded}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center space-x-2">
                <Code2 className={`h-4 w-4 ${jsonSchemaEnabled ? 'text-blue-400' : 'text-slate-500'}`} />
                <span className="font-semibold text-slate-100">Force Strict Formatting</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    jsonSchemaEnabled ? 'bg-blue-500/20 text-blue-300 border border-blue-400/30' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {jsonSchemaEnabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              {isSchemaExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {isSchemaExpanded && (
              <div className="p-3 border-t border-white/10 space-y-2 bg-[#0A0A0A]">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Forces the AI to answer in a rigid data format instead of a paragraph.
                </p>
                <textarea
                  aria-label="JSON Schema for structured output enforcement"
                  value={jsonSchema}
                  onChange={e => setJsonSchema(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:border-blue-500 focus:outline-none font-mono"
                  placeholder='{ "type": "object", "properties": { "result": { "type": "string" } } }'
                />
              </div>
            )}
          </div>

          {/* Launch Constellation Button */}
          <button
            onClick={onLaunchPrompt}
            disabled={isFetchingLogits || !prompt.trim()}
            aria-label="Launch prompt evaluation and fetch token candidates"
            className="w-full flex items-center justify-center space-x-2 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isFetchingLogits ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Mapping AI Thoughts...</span>
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 fill-white text-white" />
                <span>Map the AI's Thoughts</span>
              </>
            )}
          </button>
        </div>

        {/* Real-Time Cosmic Guide Explanatory Panel */}
        <CosmicGuide params={params} activeParam={activeParam} />

        {/* Sampling Sliders (60 FPS Interactive) */}
        <div className="space-y-4 pt-2 border-t border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Brain Controls (How it Picks Words)</span>
          </h3>

          {isReasoningModel ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 shadow-lg shadow-purple-500/10">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="h-4 w-4 text-purple-400 animate-pulse" />
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-widest">Reasoning Active</span>
                </div>
                <p className="text-[10px] text-purple-200/70 mb-4 leading-relaxed">
                  Standard decoding parameters (Temperature, Top-P) are disabled during reasoning. Adjust the Thinking Budget to control latent space exploration depth.
                </p>

                {/* Thinking Budget Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <label htmlFor="thinking-budget" className="font-medium text-slate-200 flex items-center space-x-1">
                      <span>Thinking Budget</span>
                      <span className="text-slate-400 font-mono text-[11px]">(Max Tokens)</span>
                    </label>
                    <span className="font-mono font-bold text-purple-400">{params.maxThinkingTokens || 2048}</span>
                  </div>
                  <input
                    id="thinking-budget"
                    type="range"
                    min="50"
                    max="4096"
                    step="50"
                    value={params.maxThinkingTokens || 2048}
                    onChange={e => setParams(prev => ({ ...prev, maxThinkingTokens: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                  />
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 px-1 pt-1">
                    <span>50 (Fractured)</span>
                    <span>4096 (Deep Thought)</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Temperature Slider */}
              <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="temp-slider" className="font-medium text-slate-200 flex items-center space-x-1">
                <span>Creativity vs. Focus (Temperature)</span>
              </label>
              <span className="font-mono font-bold text-amber-400">{params.temperature.toFixed(2)}</span>
            </div>
            <input
              id="temp-slider"
              aria-label="Adjust Temperature T slider from 0.01 to 2.0"
              type="range"
              min="0.01"
              max="2.0"
              step="0.01"
              value={params.temperature}
              onFocus={() => {
                setActiveParam('temperature');
                notifyInteraction({
                  feature: `Cosmic Heat (Temperature T = ${params.temperature.toFixed(2)})`,
                  whatItIs: 'Softmax exponent scaling divisor for candidate logits.',
                  whyItIs: 'Controls the balance between deterministic focus and creative randomness.',
                  impact: params.temperature > 1.2 ? 'Outer asteroid stars glow brighter and flatten probability distribution.' : 'Sharpens top supergiant star probability toward 100%.',
                  guidance: 'Keep <0.3 for factual QA/code; set >1.0 for creative writing.',
                });
              }}
              onChange={e => {
                const val = parseFloat(e.target.value);
                setActiveParam('temperature');
                updateParam('temperature', val);
                notifyInteraction({
                  feature: `Temperature T (${val.toFixed(2)})`,
                  whatItIs: 'Softmax exponent scaling divisor.',
                  whyItIs: 'Controls output entropy and candidate randomness.',
                  impact: val > 1.2 ? 'Causes low-probability outer tokens to glow brighter.' : 'Focuses probability heavily on the top star.',
                  guidance: val > 1.2 ? 'High entropy mode active.' : 'Factual focus mode active.',
                });
              }}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">
              Low = Predictable and strict. High = Creative, random, and chaotic.
            </p>
            <div className="flex items-center space-x-1.5 mt-1">
              {params.temperature <= 0.2 ? (
                <span className="rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                  <ShieldCheck className="h-3 w-3 text-blue-400" />
                  <span>🟢 Factual Precision (Legal / Medical / Code)</span>
                </span>
              ) : params.temperature >= 1.2 ? (
                <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 text-[10px] font-mono font-bold flex items-center space-x-1">
                  <Flame className="h-3 w-3 text-rose-400" />
                  <span>🔴 High Entropy (Creative Fiction / Dialogue)</span>
                </span>
              ) : (
                <span className="rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 text-[10px] font-mono font-medium">
                  🔵 Balanced Assistant Mode (General Q&A)
                </span>
              )}
            </div>
          </div>

          {/* Top-K Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="topk-slider" className="font-medium text-slate-200 flex items-center space-x-1">
                <span>Word Limit (Top-K)</span>
              </label>
              <span className="font-mono font-bold text-blue-400">{params.topK}</span>
            </div>
            <input
              id="topk-slider"
              aria-label="Adjust Top-K slider from 1 to 100"
              type="range"
              min="1"
              max="100"
              step="1"
              value={params.topK}
              onFocus={() => {
                setActiveParam('topK');
                notifyInteraction({
                  feature: `Orbital Ring (Top-K = ${params.topK})`,
                  whatItIs: 'Strict top K rank vocabulary candidate filter.',
                  whyItIs: 'Eliminates absurd long-tail tokens regardless of temperature.',
                  impact: `Keeps top ${params.topK} candidate stars active; grays out outer tokens.`,
                  guidance: 'Set Top-K to 40 for standard conversational LLM sampling.',
                });
              }}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setActiveParam('topK');
                updateParam('topK', val);
                notifyInteraction({
                  feature: `Top-K Filter (${val})`,
                  whatItIs: 'Rank cutoff threshold.',
                  whyItIs: 'Hard-clips tokens beyond rank K.',
                  impact: `Only top ${val} candidates remain eligible for sampling.`,
                  guidance: `Top ${val} candidates active.`,
                });
              }}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">
              Only allow the AI to choose from the top K most likely words. Ignores the rest.
            </p>
          </div>

          {/* Top-P Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="topp-slider" className="font-medium text-slate-200 flex items-center space-x-1">
                <span>Confidence Cutoff (Top-P)</span>
              </label>
              <span className="font-mono font-bold text-blue-400">{(params.topP * 100).toFixed(0)}%</span>
            </div>
            <input
              id="topp-slider"
              aria-label="Adjust Top-P slider from 1% to 100%"
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
                notifyInteraction({
                  feature: `Energy Shield (Top-P = ${(val * 100).toFixed(0)}%)`,
                  whatItIs: 'Cumulative probability nucleus cutoff threshold.',
                  whyItIs: 'Dynamically resizes candidate pool based on confidence distribution.',
                  impact: `Drapes dynamic purple energy shield ring at cumulative ${(val * 100).toFixed(0)}%.`,
                  guidance: 'Set Top-P to 0.90 for balanced natural responses.',
                });
              }}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">
              Only use words that make up the top P% of total probability.
            </p>
          </div>

          {/* Min-P Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="minp-slider" className="font-medium text-slate-200 flex items-center space-x-1">
                <span>Ignore Wild Guesses (Min-P)</span>
              </label>
              <span className="font-mono font-bold text-blue-400">{(params.minP * 100).toFixed(1)}%</span>
            </div>
            <input
              id="minp-slider"
              aria-label="Adjust Min-P slider from 0% to 100%"
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
                notifyInteraction({
                  feature: `Gravity Well (Min-P = ${(val * 100).toFixed(1)}%)`,
                  whatItIs: 'Relative probability cutoff scaled to top star chance.',
                  whyItIs: 'Superior to Top-P at high temperatures because it scales dynamically.',
                  impact: `Filters candidates below ${(val * 100).toFixed(1)}% of top star probability.`,
                  guidance: 'Set Min-P to 0.05 (5%) for clean sampling at T>1.0.',
                });
              }}
              className="w-full"
            />
            <p className="text-[11px] text-slate-400">
              Hide words that have a near-zero chance of making sense.
            </p>
          </div>
            </>
          )}
            {/* Feature 5: Penalties & Guardrails Accordion */}
        <div className="rounded-xl border border-white/10 bg-[#111111] overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPenaltiesExpanded(!isPenaltiesExpanded)}
            aria-label="Toggle Penalties and Guardrails sampling options"
            aria-expanded={isPenaltiesExpanded}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium text-gray-200 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Shield className={`h-4 w-4 ${params.frequencyPenalty > 0 || params.presencePenalty > 0 || Object.keys(params.logitBiases).length > 0 || params.stopSequences.length > 0 ? 'text-blue-400' : 'text-gray-500'}`} />
              <span className="font-semibold text-white tracking-tight">Repetition Blockers (Penalties)</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  params.frequencyPenalty > 0 || params.presencePenalty > 0 || Object.keys(params.logitBiases).length > 0 || params.stopSequences.length > 0
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {params.frequencyPenalty > 0 || params.presencePenalty > 0 || Object.keys(params.logitBiases).length > 0 || params.stopSequences.length > 0 ? 'ACTIVE' : 'DEFAULT'}
              </span>
            </div>
            {isPenaltiesExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>

          {isPenaltiesExpanded && (
            <div className="p-4 border-t border-white/10 space-y-4 bg-[#0A0A0A]">
              {/* Frequency Penalty */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label htmlFor="freq-penalty-slider" className="font-medium text-slate-200">Exhaustion Meter (Frequency Penalty)</label>
                  <span className="font-mono font-bold text-blue-400">{params.frequencyPenalty.toFixed(2)}</span>
                </div>
                <input
                  id="freq-penalty-slider"
                  aria-label="Adjust Frequency Penalty (Exhaustion Meter) slider from -2 to 2"
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
                    notifyInteraction({
                      feature: `Exhaustion Meter (Frequency Penalty = ${val.toFixed(2)})`,
                      whatItIs: 'Repetition penalty proportional to exact token frequency count.',
                      whyItIs: 'Breaks stubborn repetitive phrases and word loops.',
                      impact: 'Words used repeatedly in context history dim in opacity.',
                      guidance: 'Increase >0.5 to stop the model from repeating words.',
                    });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
              </div>

              {/* Presence Penalty */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label htmlFor="presence-penalty-slider" className="font-medium text-slate-200">Horizon Booster (Presence Penalty)</label>
                  <span className="font-mono font-bold text-blue-400">{params.presencePenalty.toFixed(2)}</span>
                </div>
                <input
                  id="presence-penalty-slider"
                  aria-label="Adjust Presence Penalty (Horizon Booster) slider from -2 to 2"
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
                    notifyInteraction({
                      feature: `Horizon Booster (Presence Penalty = ${val.toFixed(2)})`,
                      whatItIs: 'Flat penalty applied once to any token present in context.',
                      whyItIs: 'Encourages the model to introduce fresh new topics.',
                      impact: 'Broadens vocabulary scope across outer orbital rings.',
                      guidance: 'Increase >0.5 to encourage diverse topic exploration.',
                    });
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                />
              </div>

              {/* Logit Bias / Black Hole Magnet */}
              <div className="space-y-2">
                <label htmlFor="bias-word-input" className="text-xs font-medium text-slate-200 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <Magnet className="h-3.5 w-3.5 text-blue-400" />
                    <span>Magnet / Black Hole (Logit Bias)</span>
                  </span>
                </label>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {Object.entries(params.logitBiases).map(([word, bias]) => (
                    <span
                      key={word}
                      className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-mono border ${
                        bias < 0
                          ? 'bg-slate-900 text-slate-300 border border-slate-700'
                          : 'bg-blue-950/60 text-blue-300 border border-blue-800/50'
                      }`}
                    >
                      <span>'{word}':</span>
                      <span className="font-bold">{bias > 0 ? `+${bias}` : bias}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBias(word)}
                        aria-label={`Remove logit bias for ${word}`}
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
                    aria-label="Word to apply logit bias to"
                    value={newBiasWord}
                    onChange={e => setNewBiasWord(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                  />
                  <select
                    aria-label="Select logit bias value"
                    value={newBiasVal}
                    onChange={e => setNewBiasVal(parseFloat(e.target.value))}
                    className="rounded-lg bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-200 font-mono focus:outline-none"
                  >
                    <option value={-100}>-100 (Black Hole / Ban)</option>
                    <option value={-5}>-5.0 (Discourage)</option>
                    <option value={5}>+5.0 (Boost)</option>
                    <option value={10}>+10.0 (Magnet)</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddBias}
                    aria-label="Add logit bias word"
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white p-1.5 shadow-md transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Stop Sequences Tag Input */}
              <div className="space-y-2">
                <label htmlFor="stop-seq-input" className="text-xs font-medium text-slate-200 flex items-center space-x-1">
                  <CircleDot className="h-3.5 w-3.5 text-blue-400" />
                  <span>Emergency Brake (Stop Sequences)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {params.stopSequences.map(seq => (
                    <span
                      key={seq}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 text-amber-300 border border-slate-700"
                    >
                      <span>"{seq}"</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStopSeq(seq)}
                        aria-label={`Remove stop sequence ${seq}`}
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
                    placeholder="e.g. \n or END"
                    aria-label="Stop sequence string to add"
                    value={newStopSeq}
                    onChange={e => setNewStopSeq(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddStopSeq}
                    aria-label="Add stop sequence"
                    className="rounded-lg bg-amber-500/20 p-1.5 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>      </div>
        </div>
      )}
    </div>
  </div>
  );
};
