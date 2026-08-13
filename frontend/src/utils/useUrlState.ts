import { useEffect, useCallback, useRef } from 'react';
import { SamplingParameters } from '../types/sampling';

interface UrlStateProps {
  params: SamplingParameters;
  setParams: React.Dispatch<React.SetStateAction<SamplingParameters>>;
  prompt: string;
  setPrompt: (p: string) => void;
  systemPrompt: string;
  setSystemPrompt: (sp: string) => void;
  ragContext: string;
  setRagContext: (rc: string) => void;
  ragEnabled: boolean;
  setRagEnabled: (re: boolean) => void;
}

export function useUrlState({
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
}: UrlStateProps) {
  const skipInitialWrite = useRef(true);

  // Sync state to URL Query Params whenever state changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipInitialWrite.current) {
      skipInitialWrite.current = false;
      return;
    }

    const query = new URLSearchParams();
    if (params.temperature !== 0.7) query.set('temp', params.temperature.toString());
    if (params.topK !== 40) query.set('topk', params.topK.toString());
    if (params.topP !== 0.9) query.set('topp', params.topP.toString());
    if (params.minP !== 0.02) query.set('minp', params.minP.toString());
    if (params.frequencyPenalty !== 0.1) query.set('freq', params.frequencyPenalty.toString());
    if (params.presencePenalty !== 0.1) query.set('pres', params.presencePenalty.toString());
    query.set('rag', ragEnabled ? '1' : '0');
    if (systemPrompt.trim()) query.set('sys', systemPrompt.trim());
    if (prompt.trim()) query.set('prompt', prompt.trim());
    if (ragContext.trim()) query.set('ragctx', ragContext.trim());

    const newUrl = `${window.location.pathname}?${query.toString()}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [params, prompt, systemPrompt, ragContext, ragEnabled]);

  // Load state from URL Query Params on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const query = new URLSearchParams(window.location.search);
    const temp = query.get('temp');
    const topk = query.get('topk');
    const topp = query.get('topp');
    const minp = query.get('minp');
    const freq = query.get('freq');
    const pres = query.get('pres');
    const rag = query.get('rag');
    const sys = query.get('sys');
    const p = query.get('prompt');
    const ragctx = query.get('ragctx');

    if (temp || topk || topp || minp || freq || pres) {
      setParams(prev => ({
        ...prev,
        temperature: temp ? parseFloat(temp) : prev.temperature,
        topK: topk ? parseInt(topk, 10) : prev.topK,
        topP: topp ? parseFloat(topp) : prev.topP,
        minP: minp ? parseFloat(minp) : prev.minP,
        frequencyPenalty: freq ? parseFloat(freq) : prev.frequencyPenalty,
        presencePenalty: pres ? parseFloat(pres) : prev.presencePenalty,
      }));
    }

    if (rag !== null) setRagEnabled(rag === '1');
    if (sys) setSystemPrompt(sys);
    if (p) setPrompt(p);
    if (ragctx) setRagContext(ragctx);
  }, []);

  const copySetupLink = useCallback(() => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(window.location.href);
  }, []);

  return { copySetupLink };
}
