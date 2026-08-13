import React, { useState, useEffect } from 'react';
import { Settings, X, Server, Key, CheckCircle2, RotateCcw, ShieldCheck, Cpu } from 'lucide-react';

export type ProviderType = 'default' | 'openai' | 'custom';

interface EngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (provider: ProviderType, url: string, key: string, model: string) => void;
  provider: ProviderType;
  customUrl: string;
  customApiKey: string;
  modelName: string;
}

export const EngineSettingsModal: React.FC<EngineSettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  provider,
  customUrl,
  customApiKey,
  modelName,
}) => {
  const [providerInput, setProviderInput] = useState<ProviderType>(provider);
  const [urlInput, setUrlInput] = useState<string>(customUrl);
  const [keyInput, setKeyInput] = useState<string>(customApiKey);
  const [modelInput, setModelInput] = useState<string>(modelName);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    setProviderInput(provider);
    setUrlInput(customUrl);
    setKeyInput(customApiKey);
    setModelInput(modelName);
  }, [provider, customUrl, customApiKey, modelName, isOpen]);

  if (!isOpen) return null;

  const handleProviderChange = (p: ProviderType) => {
    setProviderInput(p);
    if (p === 'openai') {
      setUrlInput('https://api.openai.com/v1');
      if (!modelInput) setModelInput('gpt-4o');
    } else if (p === 'custom' && !urlInput) {
      setUrlInput('http://localhost:1234/v1');
      if (!modelInput) setModelInput('local-model');
    } else if (p === 'default') {
      setUrlInput('');
      setKeyInput('');
      setModelInput('Cloud Run candidate demo');
    }
  };

  const handleSave = () => {
    onSave(providerInput, urlInput.trim(), keyInput.trim(), modelInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const handleReset = () => {
    setProviderInput('default');
    setUrlInput('');
    setKeyInput('');
    setModelInput('Cloud Run candidate demo');
    onSave('default', '', '', 'Cloud Run candidate demo');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl glass-panel border border-cyan-500/30 shadow-2xl p-6 space-y-5 bg-slate-950/90">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Settings className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Engine Configuration (BYOE)</h3>
              <p className="text-xs text-slate-400">Bring Your Own API Key or Local Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Security Alert Badge */}
        <div className="flex items-start space-x-2.5 rounded-xl bg-emerald-950/40 p-3 border border-emerald-500/30 text-xs text-emerald-200">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            API Keys and Custom URLs are stored <strong>100% locally in your browser (localStorage)</strong>. They bypass our backend and are never sent to our servers.
          </p>
        </div>

        {/* Form Inputs */}
        <div className="space-y-4">
          {/* Provider Select */}
          <div>
            <label htmlFor="provider-select" className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center space-x-1.5">
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>Select AI Provider Engine</span>
            </label>
            <select
              id="provider-select"
              aria-label="Select AI Provider Engine"
              value={providerInput}
              onChange={e => handleProviderChange(e.target.value as ProviderType)}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-cyan-300 font-semibold focus:border-cyan-400 focus:outline-none"
            >
              <option value="default">Default (Cloud Run candidate demo)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-3.5)</option>
              <option value="custom">Custom / Local (vLLM / LM Studio / Ollama)</option>
            </select>
          </div>

          {/* Model Name */}
          {providerInput !== 'default' && (
            <div>
              <label htmlFor="model-name-input" className="block text-xs font-semibold text-slate-200 mb-1.5">
                Model Name String
              </label>
              <input
                id="model-name-input"
                type="text"
                aria-label="Model Name String"
                value={modelInput}
                onChange={e => setModelInput(e.target.value)}
                placeholder="e.g. gpt-4o, gemini-1.5-pro, local-model"
                className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
          )}

          {/* Custom Base URL */}
          {(providerInput === 'custom' || providerInput === 'openai') && (
            <div>
              <label htmlFor="custom-url-input" className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center space-x-1.5">
                <Server className="h-3.5 w-3.5 text-cyan-400" />
                <span>Base API Endpoint URL</span>
              </label>
              <input
                id="custom-url-input"
                type="text"
                aria-label="Base API Endpoint URL"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="e.g. https://api.openai.com/v1 or http://localhost:1234/v1"
                className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-cyan-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Must support <code className="font-mono text-cyan-300">logprobs: true</code> to render token probability distribution.
              </p>
            </div>
          )}

          {/* API Key */}
          {providerInput !== 'default' && (
            <div>
              <label htmlFor="custom-key-input" className="block text-xs font-semibold text-slate-200 mb-1.5 flex items-center space-x-1.5">
                <Key className="h-3.5 w-3.5 text-purple-400" />
                <span>API Key (Stored in local browser storage)</span>
              </label>
              <input
                id="custom-key-input"
                type="password"
                aria-label="Custom API Key"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="sk-..."
                className="w-full rounded-xl bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-400 focus:outline-none font-mono"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleReset}
            type="button"
            aria-label="Reset engine configuration to default Cloud Run server"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:border-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            onClick={handleSave}
            type="button"
            aria-label="Save engine configuration"
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-md transition-colors"
          >
            {savedSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Configuration</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
