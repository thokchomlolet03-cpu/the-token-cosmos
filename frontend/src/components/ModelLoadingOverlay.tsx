/* ─────────────────────────────────────────────────────────────────────
 * ModelLoadingOverlay — Download/Init Progress UI
 * Shows model download progress, VRAM status, and WebGPU availability.
 * The Token Cosmos v4.0
 * ───────────────────────────────────────────────────────────────────── */

import React from 'react';
import { Download, Cpu, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { InferenceState, ModelOption } from '../engine/types';

interface ModelLoadingOverlayProps {
  state: InferenceState;
  isWebGPUAvailable: boolean;
  availableModels: ModelOption[];
  onSelectModel: (modelId: string) => void;
}

export const ModelLoadingOverlay: React.FC<ModelLoadingOverlayProps> = ({
  state,
  isWebGPUAvailable,
  availableModels,
  onSelectModel,
}) => {
  // Don't render when model is ready and loaded
  if (state.status === 'ready' && state.modelId) return null;

  // Don't render during generation
  if (state.status === 'generating') return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050714]/90 backdrop-blur-lg">
      <div className="w-full max-w-md mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-pink-500/20 border border-white/10 mb-4">
            <Cpu className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            WebGPU Inference Engine
          </h2>
          <p className="text-sm text-gray-400 mt-1 font-mono">
            In-browser LLM for full logit extraction
          </p>
        </div>

        {/* WebGPU Status Guardrail */}
        {!isWebGPUAvailable ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">WebGPU Unsupported</p>
                <p className="text-xs text-red-200/70 mt-1">
                  Your browser or device does not support WebGPU, which is strictly required for The Token Cosmos 3D Engine. 
                </p>
                <a href="https://caniuse.com/webgpu" target="_blank" rel="noreferrer" className="inline-block mt-3 px-3 py-1 bg-red-500/20 text-red-300 text-[10px] rounded hover:bg-red-500/40 transition-colors">
                  Check Browser Requirements &rarr;
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>

        {/* Loading / Downloading State */}
        {(state.status === 'downloading' || state.status === 'loading') && (
          <div className="rounded-xl bg-white/5 border border-white/10 p-5 mb-4">
            <div className="flex items-center space-x-3 mb-3">
              {state.status === 'downloading' ? (
                <Download className="w-5 h-5 text-cyan-400 animate-bounce" />
              ) : (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              )}
              <span className="text-sm text-white font-mono">{state.progressText}</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-pink-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${state.progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-gray-500 font-mono">
                {state.status === 'downloading' ? 'Downloading weights' : 'Initializing WebGPU'}
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-bold">
                {state.progress}%
              </span>
            </div>
          </div>
        )}

        {/* Error State */}
        {state.status === 'error' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 mb-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">Engine Error</p>
                <p className="text-xs text-red-200/70 mt-1 font-mono break-all">
                  {state.error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Model Selection (shown when idle or error) */}
        {(state.status === 'idle' || state.status === 'error') && isWebGPUAvailable && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-mono mb-3 text-center">
              Select a model to load
            </p>
            {availableModels.map((model) => (
              <button
                key={model.id}
                onClick={() => onSelectModel(model.id)}
                className="w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 p-4 text-left transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {model.label}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider ${
                        model.tier === 'light'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : model.tier === 'standard'
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      }`}>
                        {model.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{model.description}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs text-gray-400 font-mono">{model.size}</div>
                    <div className="text-[9px] text-gray-600 font-mono">
                      {model.vocabSize.toLocaleString()} tokens
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Skip / Use Sample Data */}
        <div className="mt-4 text-center">
          <button
            onClick={() => onSelectModel('__SAMPLE_DATA__')}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors font-mono underline underline-offset-4"
          >
            Skip — use pre-computed sample data instead
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
