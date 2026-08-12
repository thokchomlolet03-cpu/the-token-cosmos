import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Eye } from 'lucide-react';

interface HeroBannerProps {
  onLearnMore?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    return localStorage.getItem('token_cosmos_hero_collapsed') !== 'true';
  });

  const toggleExpand = () => {
    setIsExpanded(prev => {
      const next = !prev;
      localStorage.setItem('token_cosmos_hero_collapsed', next ? 'false' : 'true');
      return next;
    });
  };

  return (
    <div className="w-full rounded-xl glass-panel-matte overflow-hidden transition-all duration-300">
      {/* Banner Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#0A0A0A] border-b border-white/10">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 border border-white/20">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight flex items-center space-x-2">
              <span>Demystifying the LLM Black Box</span>
              <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-mono text-gray-300 border border-white/10">
                Interactive Cognitive HUD
              </span>
            </h2>
          </div>
        </div>

        <button
          onClick={toggleExpand}
          className="btn-secondary-matte px-2.5 py-1 text-xs flex items-center space-x-1"
        >
          <span>{isExpanded ? 'Hide Tour' : 'Show Tour'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Split-Reality Visual Comparison */}
      {isExpanded && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-[#0A0A0A]">
          {/* Left Side: The Chatbot Illusion */}
          <div className="rounded-xl bg-[#111111] border border-white/10 p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-gray-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                  The Chatbot Illusion (What Users See)
                </span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed font-mono bg-[#161616] p-3 rounded-lg border border-white/10">
                "Paris is the capital of France..."
              </p>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Standard AI interfaces hide how decisions are made. Text appears linearly, making AI look like a conscious speaker answering questions passively.
            </p>
          </div>

          {/* Right Side: The Token Cosmos Reality */}
          <div className="rounded-xl bg-[#111111] border border-white/10 p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-white" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                    The Token Cosmos Reality (What Actually Happens)
                  </span>
                </div>
                <Eye className="h-3.5 w-3.5 text-gray-400" />
              </div>

              {/* Animated Token Candidates Preview */}
              <div className="flex items-center space-x-2 bg-[#161616] p-2.5 rounded-lg border border-white/10 font-mono text-[11px]">
                <span className="rounded bg-[#222222] text-white border border-white/20 px-2 py-0.5 font-bold">
                  "Paris" (92%)
                </span>
                <span className="rounded bg-[#1A1A1A] text-gray-300 border border-white/10 px-1.5 py-0.5">
                  "Lyon" (3%)
                </span>
                <span className="rounded bg-[#1A1A1A] text-gray-400 border border-white/10 px-1.5 py-0.5">
                  "Rome" (1%)
                </span>
                <span className="text-gray-500 text-[10px]">+47 more candidates</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              <strong className="text-white">LLMs compute a probability galaxy</strong> of 50,000+ vocabulary candidates for every single word. Tune Temperature, Top-K, and RAG to force factual certainty or spark creative leaps!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
