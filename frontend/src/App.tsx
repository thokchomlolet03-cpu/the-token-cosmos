import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { MissionControl } from './components/MissionControl';
import { TokenCosmosGraph } from './components/TokenCosmosGraph';
import { SplitViewCosmos } from './components/SplitViewCosmos';
import { EducationalBlog } from './components/EducationalBlog';
import { TheNavigator, ActiveInteractionNotice } from './components/TheNavigator';
import { EngineSettingsModal, ProviderType } from './components/EngineSettingsModal';
import { HeroBanner } from './components/HeroBanner';
import { CodeExportModal } from './components/CodeExportModal';
import { ModelLoadingOverlay } from './components/ModelLoadingOverlay';
import { SamplingParameters, ProcessedTokenCandidate, FlightStep, RawTokenCandidate, PresetScenario } from './types/sampling';
import { PRESET_SCENARIOS, SAMPLE_RAW_LOGITS_MAP } from './utils/tokenData';
import { calculateTokenProbabilities, normalizeOpenAILogprobs } from './utils/samplingMath';
import { useUrlState } from './utils/useUrlState';
import { useInferenceEngine } from './engine/useInferenceEngine';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'learn' | 'experiment' | 'export'>('experiment');
  const [splitView, setSplitView] = useState<boolean>(false);

  // ─── WebGPU Inference Engine (v4.0) ─────────────────────────────
  const inferenceEngine = useInferenceEngine();
  const [useSampleData, setUseSampleData] = useState<boolean>(false);

  // isCodeExportOpen is removed, replaced by activeTab === 'export'

  // Proactive Interaction Notice state for The Navigator AI explanations
  const [activeNotice, setActiveNotice] = useState<ActiveInteractionNotice | null>(null);

  // BYOE Engine Settings Modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [provider, setProvider] = useState<ProviderType>(() => {
    return (localStorage.getItem('token_cosmos_provider') as ProviderType) || 'default';
  });
  const [customUrl, setCustomUrl] = useState<string>(() => {
    return localStorage.getItem('token_cosmos_custom_url') || '';
  });
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('token_cosmos_custom_key') || '';
  });
  const [modelName, setModelName] = useState<string>(() => {
    return localStorage.getItem('token_cosmos_model_name') || 'Qwen2.5-0.5B';
  });

  // Default Primary Sampling Parameters (Universe A)
  const [params, setParams] = useState<SamplingParameters>({
    temperature: 0.7,
    topK: 40,
    topP: 0.9,
    minP: 0.02,
    frequencyPenalty: 0.1,
    presencePenalty: 0.1,
    stopSequences: [],
    logitBiases: {},
    maxThinkingTokens: 2048,
  });

  // Secondary A/B Duel Sampling Parameters (Universe B)
  const [duelParams, setDuelParams] = useState<SamplingParameters>({
    temperature: 1.5,
    topK: 50,
    topP: 0.95,
    minP: 0.01,
    frequencyPenalty: 0.0,
    presencePenalty: 0.0,
    stopSequences: [],
    logitBiases: {},
  });

  // Prompt, System Persona & RAG state
  const [prompt, setPrompt] = useState<string>(PRESET_SCENARIOS[0].prompt);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [jsonSchema, setJsonSchema] = useState<string>('{ "type": "object", "properties": { "answer": { "type": "string" } } }');
  const [jsonSchemaEnabled, setJsonSchemaEnabled] = useState<boolean>(false);
  const [ragContext, setRagContext] = useState<string>(PRESET_SCENARIOS[0].ragContext);
  const [ragEnabled, setRagEnabled] = useState<boolean>(PRESET_SCENARIOS[0].ragEnabled);
  const [isFetchingLogits, setIsFetchingLogits] = useState<boolean>(false);

  // Sync state to URL Query String for shareable setups
  const { copySetupLink } = useUrlState({
    params,
    setParams,
    prompt,
    setPrompt,
    systemPrompt,
    setSystemPrompt,
    ragContext,
    setRagContext,
    ragEnabled,
    setRagEnabled,
  });

  // Raw logits state (fed by WebGPU engine or hardcoded fallback)
  const [baselineRawLogits, setBaselineRawLogits] = useState<RawTokenCandidate[]>(
    SAMPLE_RAW_LOGITS_MAP['capital-france'].baseline
  );
  const [ragRawLogits, setRagRawLogits] = useState<RawTokenCandidate[]>(
    SAMPLE_RAW_LOGITS_MAP['capital-france'].rag
  );

  // ─── Bridge: WebGPU logits → existing RawTokenCandidate pipeline ──
  useEffect(() => {
    if (inferenceEngine.latestLogits && inferenceEngine.isModelLoaded) {
      // Extract RAG keywords for grounding detection
      const ragTokens = new Set<string>();
      if (ragEnabled && ragContext.trim()) {
        ragContext.split(/\s+/).filter(w => w.length > 3).forEach(w => ragTokens.add(w.toLowerCase()));
      }

      const candidates = inferenceEngine.logitsToRawCandidates(
        inferenceEngine.latestLogits,
        ragTokens,
      );

      if (candidates.length > 0) {
        setBaselineRawLogits(candidates);
        setRagRawLogits(candidates);
      }
    }
  }, [inferenceEngine.latestLogits, inferenceEngine.isModelLoaded, ragEnabled, ragContext, inferenceEngine.logitsToRawCandidates]);

  // Handle model selection from the loading overlay
  const handleSelectModel = (modelId: string) => {
    if (modelId === '__SAMPLE_DATA__') {
      setUseSampleData(true);
      return;
    }
    setUseSampleData(false);
    inferenceEngine.loadModel(modelId);
  };

  // Flight Path steps history
  const [steps, setSteps] = useState<FlightStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Save BYOE Settings locally in browser localStorage
  const handleSaveEngineSettings = (
    p: ProviderType,
    url: string,
    key: string,
    model: string
  ) => {
    setProvider(p);
    setCustomUrl(url);
    setCustomApiKey(key);
    setModelName(model);

    localStorage.setItem('token_cosmos_provider', p);
    if (url) localStorage.setItem('token_cosmos_custom_url', url);
    else localStorage.removeItem('token_cosmos_custom_url');

    if (key) localStorage.setItem('token_cosmos_custom_key', key);
    else localStorage.removeItem('token_cosmos_custom_key');

    if (model) localStorage.setItem('token_cosmos_model_name', model);
    else localStorage.removeItem('token_cosmos_model_name');
  };

  // Synthetic logit generator fallback for local testing
  const generateSyntheticLogits = (customPrompt: string, contextText: string, isRagOn: boolean, sysPersona?: string) => {
    const cleanPrompt = customPrompt.trim().toLowerCase();
    const ragKeywords = isRagOn && contextText ? contextText.split(/\s+/).filter(w => w.length > 3) : [];

    let customWords: string[] = [];

    if (sysPersona && (sysPersona.toLowerCase().includes('sql') || sysPersona.toLowerCase().includes('dba'))) {
      customWords = [' SELECT', ' FROM', ' WHERE', ' JOIN', ' GROUP', ' BY', ' ORDER', ' LIMIT', ' COUNT', ' MAX'];
    } else if (cleanPrompt.includes('steak')) {
      customWords = [' medium-rare', ' grill', ' searing', ' butter', ' seasoning', ' ribeye', ' pan', ' tender', ' garlic', ' salt'];
    } else if (cleanPrompt.includes('poem') || cleanPrompt.includes('server')) {
      customWords = [' crash', ' glowing', ' silicon', ' binary', ' silent', ' electric', ' echo', ' dark', ' pulse', ' memory'];
    } else if (cleanPrompt.includes('policy') || cleanPrompt.includes('work')) {
      customWords = [' remote', ' office', ' Tuesday', ' Thursday', ' schedule', ' hybrid', ' Monday', ' Friday', ' hours', ' team'];
    } else {
      const words = customPrompt.split(/\s+/).filter(w => w.length > 2);
      customWords = words.map(w => ` ${w}`);
      if (customWords.length < 5) {
        customWords.push(' optimal', ' result', ' answer', ' analysis', ' structure', ' concept');
      }
    }

    const baseline: RawTokenCandidate[] = [];
    const rag: RawTokenCandidate[] = [];

    for (let i = 0; i < 50; i++) {
      const word = i < customWords.length ? customWords[i] : ` candidate_${i + 1}`;
      const baseLogit = 16.0 - Math.log(i + 1) * 3.1 + Math.sin(i * 1.5) * 0.5;

      let isGrounded = false;
      let ragLogit = baseLogit;

      if (isRagOn && ragKeywords.length > 0) {
        const cleanW = word.trim().toLowerCase();
        for (const kw of ragKeywords) {
          if (cleanW.includes(kw.toLowerCase()) || kw.toLowerCase().includes(cleanW)) {
            isGrounded = true;
            ragLogit += 5.5;
            break;
          }
        }
      }

      baseline.push({
        token_id: 2000 + i,
        token_str: word,
        raw_logit: Math.round(baseLogit * 100) / 100,
        is_rag_grounded: false,
      });

      rag.push({
        token_id: 3000 + i,
        token_str: word,
        raw_logit: Math.round(ragLogit * 100) / 100,
        is_rag_grounded: isGrounded,
      });
    }

    baseline.sort((a, b) => b.raw_logit - a.raw_logit);
    rag.sort((a, b) => b.raw_logit - a.raw_logit);

    return { baseline, rag };
  };

  // Launch Prompt Evaluation Endpoint
  // Priority: WebGPU local model → BYOE API → Cloud backend → Synthetic fallback
  const handleLaunchPrompt = async () => {
    setIsFetchingLogits(true);
    try {
      // Route 1: WebGPU local model (full vocab logits or stream)
      if (inferenceEngine.isModelLoaded) {
        const fullPrompt = ragEnabled && ragContext.trim()
          ? `Context: ${ragContext}\n\nQuestion: ${prompt}`
          : prompt;
        
        const isReasoning = inferenceEngine.availableModels.find(m => m.id === inferenceEngine.state.modelId)?.isReasoning;
        
        if (isReasoning) {
            // For reasoning models, we want to watch the stream to see the thinking phase
            // We pass the thinking budget. The total tokens can be budget + some fixed output buffer
            inferenceEngine.generateSteps(fullPrompt, (params.maxThinkingTokens || 2048) + 1024, params.maxThinkingTokens);
        } else {
            // Standard models just evaluate a single pass
            inferenceEngine.getLogits(fullPrompt);
        }
        
        setIsFetchingLogits(false);
        return;
      }
      if (provider !== 'default' && (customApiKey || provider === 'custom')) {
        const endpointUrl = customUrl
          ? `${customUrl.replace(/\/$/, '')}/chat/completions`
          : 'https://api.openai.com/v1/chat/completions';

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (customApiKey) {
          headers['Authorization'] = `Bearer ${customApiKey}`;
        }

        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt.trim()) {
          messages.push({ role: 'system', content: systemPrompt.trim() });
        }
        let userContent = prompt;
        if (ragEnabled && ragContext.trim()) {
          userContent = `Retrieved Context: ${ragContext}\n\nUser Question: ${prompt}`;
        }
        messages.push({ role: 'user', content: userContent });

        const bodyPayload = {
          model: modelName || 'gpt-4o',
          messages,
          max_tokens: 1,
          temperature: params.temperature,
          logprobs: true,
          top_logprobs: 20,
        };

        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload),
        });

        if (res.ok) {
          const data = await res.json();
          const parsedCandidates = normalizeOpenAILogprobs(data, ragEnabled ? ragContext : undefined);
          if (parsedCandidates.length > 0) {
            setBaselineRawLogits(parsedCandidates);
            setRagRawLogits(parsedCandidates);
            return;
          }
        }
      }

      // Default Route to Cloud Run Python Backend
      const res = await fetch('/api/logits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          system_prompt: systemPrompt || null,
          rag_context: ragEnabled ? ragContext : null,
          top_n: 50,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.candidates && Array.isArray(data.candidates)) {
          setBaselineRawLogits(data.candidates);
          setRagRawLogits(data.candidates);
        }
      } else {
        throw new Error('Endpoint offline');
      }
    } catch (e) {
      const synthetic = generateSyntheticLogits(prompt, ragContext, ragEnabled, systemPrompt);
      setBaselineRawLogits(synthetic.baseline);
      setRagRawLogits(synthetic.rag);
    } finally {
      setIsFetchingLogits(false);
    }
  };

  // Apply Preset Scenario
  const handleApplyPreset = (preset: PresetScenario) => {
    setParams(prev => ({
      ...prev,
      ...preset.params,
    }));
    setPrompt(preset.prompt);
    setRagContext(preset.ragContext);
    setRagEnabled(preset.ragEnabled);

    if (preset.id === 'factual-roboticist') {
      setBaselineRawLogits(SAMPLE_RAW_LOGITS_MAP['capital-france'].baseline);
      setRagRawLogits(SAMPLE_RAW_LOGITS_MAP['capital-france'].rag);
    } else if (preset.id === 'wild-storyteller') {
      setBaselineRawLogits(SAMPLE_RAW_LOGITS_MAP['cybernetic-forest'].baseline);
      setRagRawLogits(SAMPLE_RAW_LOGITS_MAP['cybernetic-forest'].baseline);
    } else {
      const synthetic = generateSyntheticLogits(preset.prompt, preset.ragContext, preset.ragEnabled, systemPrompt);
      setBaselineRawLogits(synthetic.baseline);
      setRagRawLogits(synthetic.rag);
    }
  };

  const historyTokens = useMemo(() => {
    return steps.slice(0, currentStepIndex + 1).map(s => s.selectedToken.token_str);
  }, [steps, currentStepIndex]);

  const activeRawLogits = ragEnabled ? ragRawLogits : baselineRawLogits;

  // Primary processed candidates (Universe A)
  const processedCandidates = useMemo(() => {
    const raw = calculateTokenProbabilities(activeRawLogits, params, historyTokens);

    if (jsonSchemaEnabled && jsonSchema.trim()) {
      raw.forEach(c => {
        const clean = c.token_str.trim();
        if (clean.includes('candidate_') || clean.includes('fringe_') || clean.includes('Washington')) {
          c.probability = 0;
          c.isFiltered = true;
          c.filterReason = 'Banned';
          c.color = '#e11d48';
        }
      });
    }

    return raw;
  }, [activeRawLogits, params, historyTokens, jsonSchemaEnabled, jsonSchema]);

  // A/B Secondary processed candidates (Universe B)
  const duelCandidates = useMemo(() => {
    return calculateTokenProbabilities(activeRawLogits, duelParams, historyTokens);
  }, [activeRawLogits, duelParams, historyTokens]);

  const baselineCandidates = useMemo(() => {
    return calculateTokenProbabilities(baselineRawLogits, params, historyTokens);
  }, [baselineRawLogits, params, historyTokens]);

  const ragCandidates = useMemo(() => {
    return calculateTokenProbabilities(ragRawLogits, params, historyTokens);
  }, [ragRawLogits, params, historyTokens]);

  // Compute all step candidates list for perplexity heatmap in FlightPathTimeline
  const stepCandidatesList = useMemo(() => {
    return steps.map(s => calculateTokenProbabilities(s.rawLogits, s.params));
  }, [steps]);

  useEffect(() => {
    if (processedCandidates.length > 0) {
      const topToken = processedCandidates[0];
      const initialStep: FlightStep = {
        stepIndex: 0,
        selectedToken: topToken,
        promptSnippet: prompt,
        rawLogits: activeRawLogits,
        params,
        ragEnabled,
      };
      setSteps([initialStep]);
      setCurrentStepIndex(0);
    }
  }, [baselineRawLogits, ragRawLogits]);

  const handleSelectToken = (token: ProcessedTokenCandidate) => {
    const newStep: FlightStep = {
      stepIndex: steps.length,
      selectedToken: token,
      promptSnippet: prompt,
      rawLogits: activeRawLogits,
      params,
      ragEnabled,
    };
    const updated = [...steps.slice(0, currentStepIndex + 1), newStep];
    setSteps(updated);
    setCurrentStepIndex(updated.length - 1);

    setActiveNotice({
      feature: `Token Selection ("${token.token_str.trim()}")`,
      whatItIs: `Direct token selection on the starfield orbital canvas.`,
      whyItIs: `Allows step-by-step interactive trajectory steering.`,
      impact: `Appends "${token.token_str.trim()}" (${(token.probability * 100).toFixed(1)}%) to flight constellation.`,
      guidance: `Click any orbiting candidate star to force the LLM down a specific sentence path!`,
      timestamp: Date.now(),
    });
  };

  const handleGenerateNextStep = () => {
    if (processedCandidates.length === 0) return;
    setIsGenerating(true);
    setTimeout(() => {
      const chosen = processedCandidates.find(c => !c.isFiltered) || processedCandidates[0];
      handleSelectToken(chosen);
      setIsGenerating(false);
    }, 200);
  };

  const handleResetTimeline = () => {
    if (processedCandidates.length > 0) {
      const topToken = processedCandidates[0];
      const initialStep: FlightStep = {
        stepIndex: 0,
        selectedToken: topToken,
        promptSnippet: prompt,
        rawLogits: activeRawLogits,
        params,
        ragEnabled,
      };
      setSteps([initialStep]);
      setCurrentStepIndex(0);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#050714] text-gray-100 font-sans selection:bg-pink-500/30 selection:text-white select-text">
      {/* WebGPU Model Loading Overlay (Also acts as WebGPU Guardrail) */}
      {(!useSampleData || !inferenceEngine.isWebGPUAvailable) && (
        <ModelLoadingOverlay
          state={inferenceEngine.state}
          isWebGPUAvailable={inferenceEngine.isWebGPUAvailable}
          availableModels={inferenceEngine.availableModels}
          onSelectModel={handleSelectModel}
        />
      )}

      {/* Bypass App Initialization if WebGPU is missing */}
      {inferenceEngine.isWebGPUAvailable && (
        <>
          {/* Header Bar */}
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
        splitView={splitView}
        setSplitView={setSplitView}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onCopySetupLink={copySetupLink}
        // onOpenCodeExport is removed as it's handled by activeTab
      />

      {/* Main Workspace */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 flex flex-col space-y-6">
        {activeTab === 'experiment' ? (
          <>
            {/* Split-Reality Educational Hero Banner */}
            <HeroBanner />

            {/* Top Workspace Grid: Left Panel A (Mission Control) + Center Panel B (Starfield Canvas) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[580px]">
              {/* Panel A: Mission Control (Left Pane) */}
              <div className="lg:col-span-4 xl:col-span-4 h-full">
                <MissionControl
                  params={params}
                  setParams={setParams}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  systemPrompt={systemPrompt}
                  setSystemPrompt={setSystemPrompt}
                  jsonSchema={jsonSchema}
                  setJsonSchema={setJsonSchema}
                  jsonSchemaEnabled={jsonSchemaEnabled}
                  setJsonSchemaEnabled={setJsonSchemaEnabled}
                  ragContext={ragContext}
                  setRagContext={setRagContext}
                  ragEnabled={ragEnabled}
                  setRagEnabled={setRagEnabled}
                  onApplyPreset={handleApplyPreset}
                  onLaunchPrompt={handleLaunchPrompt}
                  onInteractFeature={notice => setActiveNotice(notice)}
                  isFetchingLogits={isFetchingLogits}
                  rawLogits={activeRawLogits}
                  isReasoningModel={inferenceEngine.availableModels.find(m => m.id === inferenceEngine.state.modelId)?.isReasoning}
                />
              </div>

              {/* Panel B: Center Canvas (The Token Cosmos Galaxy or A/B Duel) */}
              <div className="lg:col-span-8 xl:col-span-8 h-full flex flex-col min-h-[500px]">
                <div className="flex-1 min-h-[460px]">
                  {splitView ? (
                    <SplitViewCosmos
                      leftCandidates={processedCandidates}
                      rightCandidates={duelCandidates}
                      leftParams={params}
                      rightParams={duelParams}
                      leftTitle={
                        provider !== 'default'
                          ? `Universe A [${provider.toUpperCase()}] (${modelName})`
                          : `Universe A (Temp = ${params.temperature.toFixed(2)})`
                      }
                      leftSubtitle={`Primary Sampling Config • Top-K ${params.topK}`}
                      rightTitle={
                        provider !== 'default'
                          ? `Universe B [Cloud Run Qwen]`
                          : `Universe B (Temp = ${duelParams.temperature.toFixed(2)})`
                      }
                      rightSubtitle={`Secondary A/B Config • Top-K ${duelParams.topK}`}
                      leftRagEnabled={ragEnabled}
                      rightRagEnabled={ragEnabled}
                      onSelectToken={handleSelectToken}
                      onUpdateRightTemp={newTemp => setDuelParams(prev => ({ ...prev, temperature: newTemp }))}
                      isByoeMode={provider !== 'default'}
                      leftIsThinking={inferenceEngine.latestSnapshot?.isThinking}
                    />
                  ) : (
                    <TokenCosmosGraph
                      candidates={processedCandidates}
                      params={params}
                      ragEnabled={ragEnabled}
                      onSelectToken={handleSelectToken}
                      title="The Token Cosmos"
                      subtitle={
                        provider !== 'default'
                          ? `BYOE [${provider.toUpperCase()}] • ${modelName}`
                          : 'Cosmograph GPU Force-Directed Galaxy'
                      }
                      steps={steps}
                      currentStepIndex={currentStepIndex}
                      onSelectStep={idx => setCurrentStepIndex(idx)}
                      onGenerateNextStep={handleGenerateNextStep}
                      onResetTimeline={handleResetTimeline}
                      isGenerating={isGenerating}
                      allCandidatesByStep={stepCandidatesList}
                      historyLength={historyTokens.length}
                      modelId={inferenceEngine.state.modelId}
                      latestLogits={inferenceEngine.latestLogits}
                      isThinking={inferenceEngine.latestSnapshot?.isThinking}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Timeline is now integrated inside TokenCosmosGraph */}
          </>
        ) : activeTab === 'learn' ? (
          <EducationalBlog />
        ) : (
          <div className="flex-1 max-w-4xl mx-auto w-full pt-8">
            <div className="bg-[#1c1c21] rounded-xl border border-white/10 p-6 shadow-2xl overflow-hidden relative min-h-[600px]">
              <div className="absolute inset-0 overflow-y-auto p-2">
                <CodeExportModal
                  isOpen={true}
                  onClose={() => setActiveTab('experiment')}
                  params={params}
                  prompt={prompt}
                  systemPrompt={systemPrompt}
                  ragContext={ragContext}
                  ragEnabled={ragEnabled}
                  modelName={modelName}
                  provider={provider}
                  isReasoningModel={inferenceEngine.availableModels.find(m => m.id === inferenceEngine.state.modelId)?.isReasoning}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Free-Floating Draggable "The Navigator" AI Tourist Guide */}
      <TheNavigator
        params={params}
        setParams={setParams}
        prompt={prompt}
        setPrompt={setPrompt}
        ragContext={ragContext}
        setRagContext={setRagContext}
        ragEnabled={ragEnabled}
        setRagEnabled={setRagEnabled}
        topCandidateStr={processedCandidates[0]?.token_str?.trim() || 'Paris'}
        topCandidateProb={processedCandidates[0]?.probability || 0.85}
        activeInteractionNotice={activeNotice}
      />

      {/* BYOE Engine Configuration Settings Modal */}
      <EngineSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveEngineSettings}
        provider={provider}
        customUrl={customUrl}
        customApiKey={customApiKey}
        modelName={modelName}
      />
        </>
      )}
    </div>
  );
};
