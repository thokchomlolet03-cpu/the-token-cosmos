import React, { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, HelpCircle, ArrowRight, ShieldCheck, Eye } from 'lucide-react';

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
    <div className="w-full rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950/30 to-purple-950/40 border border-cyan-500/20 shadow-2xl overflow-hidden transition-all duration-300">
      {/* Banner Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/70 border-b border-cyan-500/10">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-neon-cyan">
            <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-950">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center space-x-2">
              <span>Demystifying the LLM Black Box</span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/20">
                Interactive Cognitive HUD
              </span>
            </h2>
          </div>
        </div>

        <button
          onClick={toggleExpand}
          className="flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-mono font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
        >
          <span>{isExpanded ? 'Hide Tour' : 'Show Tour'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Split-Reality Visual Comparison */}
      {isExpanded && (
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-950/40">
          {/* Left Side: The Chatbot Illusion */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-slate-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  The Chatbot Illusion (What Users See)
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                "Paris is the capital of France..."
              </p>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Standard AI interfaces hide how decisions are made. Text appears linearly, making AI look like a conscious speaker answering questions passively.
            </p>
          </div>

          {/* Right Side: The Token Cosmos Reality */}
          <div className="rounded-xl bg-gradient-to-r from-cyan-950/40 to-purple-950/40 border border-cyan-500/30 p-4 flex flex-col justify-between space-y-3 shadow-neon-cyan">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    The Token Cosmos Reality (What Actually Happens)
                  </span>
                </div>
                <Eye className="h-3.5 w-3.5 text-cyan-400" />
              </div>

              {/* Animated Token Candidates Preview */}
              <div className="flex items-center space-x-2 bg-slate-950/90 p-2.5 rounded-lg border border-cyan-500/20 font-mono text-[11px]">
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 font-bold">
                  "Paris" (92%)
                </span>
                <span className="rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5">
                  "Lyon" (3%)
                </span>
                <span className="rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5">
                  "Rome" (1%)
                </span>
                <span className="text-slate-500 text-[10px]">+47 more candidates</span>
              </div>
            </div>
            <p className="text-[11px] text-cyan-200/90 leading-relaxed">
              <strong>LLMs compute a probability galaxy</strong> of 50,000+ vocabulary candidates for every single word. Tune Temperature, Top-K, and RAG to force factual certainty or spark creative leaps!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
