import React from 'react';
import { SamplingParameters } from '../types/sampling';
import { Sparkles, Info, Flame, CircleDot, Shield, Compass, Sliders } from 'lucide-react';

export type ActiveParamType = 'temperature' | 'topK' | 'topP' | 'minP' | 'frequencyPenalty' | 'presencePenalty';

interface CosmicGuideProps {
  params: SamplingParameters;
  activeParam: ActiveParamType;
}

export const CosmicGuide: React.FC<CosmicGuideProps> = ({ params, activeParam }) => {
  const getExplanation = () => {
    switch (activeParam) {
      case 'temperature': {
        const val = params.temperature;
        if (val <= 0.4) {
          return {
            title: 'Cold & Focused',
            icon: <Flame className="h-4 w-4 text-cyan-400" />,
            badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
            text: 'The AI acts like a strict roboticist. It ignores creative risks and laser-focuses on the safest, most obvious words. Perfect for data tasks.',
          };
        } else if (val <= 1.2) {
          return {
            title: 'Balanced Atmosphere',
            icon: <Flame className="h-4 w-4 text-amber-400" />,
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
            text: 'The AI mixes expected words with occasional surprising choices, mimicking natural human storytelling.',
          };
        } else {
          return {
            title: 'Supernova Chaos',
            icon: <Flame className="h-4 w-4 text-rose-400" />,
            badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
            text: 'The AI begins guessing wildly. It will hallucinate facts and string together bizarre sentences. Use for brainstorming only.',
          };
        }
      }

      case 'topK': {
        const val = params.topK;
        if (val <= 10) {
          return {
            title: 'Strict Cutoff',
            icon: <Sliders className="h-4 w-4 text-cyan-400" />,
            badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
            text: 'The AI is only allowed to look at the top few smartest choices. All background noise is completely blocked out.',
          };
        } else if (val < 50) {
          return {
            title: 'Broadening Horizons',
            icon: <Sliders className="h-4 w-4 text-sky-400" />,
            badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
            text: 'The AI considers a wider pool of decent options, allowing for more variety in its vocabulary.',
          };
        } else {
          return {
            title: 'Open Sky',
            icon: <Sliders className="h-4 w-4 text-purple-400" />,
            badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
            text: 'The AI is looking at the maximum number of candidates. It relies entirely on Temperature to decide what to pick.',
          };
        }
      }

      case 'topP': {
        const val = params.topP;
        if (val <= 0.5) {
          return {
            title: 'Tight Nucleus',
            icon: <CircleDot className="h-4 w-4 text-purple-400" />,
            badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
            text: 'The shield only captures the absolute most confident words. If the AI isn\'t sure, it won\'t say it.',
          };
        } else if (val <= 0.9) {
          return {
            title: 'Flexible Shield',
            icon: <CircleDot className="h-4 w-4 text-sky-400" />,
            badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
            text: 'The AI grabs a healthy mix of words until it reaches a solid confidence threshold.',
          };
        } else {
          return {
            title: 'Weak Shield',
            icon: <CircleDot className="h-4 w-4 text-pink-400" />,
            badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
            text: 'The AI lets almost everything through, capturing a massive pool of words regardless of how confident it is.',
          };
        }
      }

      case 'minP': {
        const val = params.minP;
        if (val <= 0.05) {
          return {
            title: 'Broad Base',
            icon: <Compass className="h-4 w-4 text-pink-400" />,
            badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
            text: 'Allows low probability tail candidates as long as they meet a minimal baseline cutoff.',
          };
        } else {
          return {
            title: 'Strict Gravity Well',
            icon: <Compass className="h-4 w-4 text-rose-400" />,
            badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
            text: 'Filters out any candidate whose chance drops below relative fraction of top star.',
          };
        }
      }

      case 'frequencyPenalty': {
        const val = params.frequencyPenalty;
        if (val === 0) {
          return {
            title: 'Repetitive Orbit',
            icon: <Shield className="h-4 w-4 text-slate-400" />,
            badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
            text: 'Previously used words retain full probability weight, allowing infinite repetitive loops.',
          };
        } else if (val < 1.0) {
          return {
            title: 'Synonym Searcher',
            icon: <Shield className="h-4 w-4 text-emerald-400" />,
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
            text: 'Gradually penalizes repetitive words, encouraging vocabulary variety.',
          };
        } else {
          return {
            title: 'Exhaustion Mode',
            icon: <Shield className="h-4 w-4 text-amber-400" />,
            badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
            text: 'Previously used words physically dim in opacity, forcing the AI away from familiar paths.',
          };
        }
      }

      case 'presencePenalty': {
        const val = params.presencePenalty;
        if (val === 0) {
          return {
            title: 'No Topic Shift',
            icon: <Shield className="h-4 w-4 text-slate-400" />,
            badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
            text: 'Does not penalize topic presence; AI stays focused on existing subject context.',
          };
        } else {
          return {
            title: 'Horizon Booster',
            icon: <Shield className="h-4 w-4 text-sky-400" />,
            badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
            text: 'Applies a one-time penalty on any word already seen, encouraging topic exploration.',
          };
        }
      }

      default:
        return {
          title: 'Interactive Math Engine',
          icon: <Info className="h-4 w-4 text-cyan-400" />,
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
          text: 'Drag any sampling slider to see real-time English explanations of LLM mathematical shifts.',
        };
    }
  };

  const info = getExplanation();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-slate-950/90 via-slate-900/90 to-cyan-950/40 p-3.5 shadow-neon-cyan backdrop-blur-md transition-all duration-200"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wider">
            Cosmic Guide Explanation
          </span>
        </div>
        <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${info.badgeColor}`}>
          {info.icon}
          <span>{info.title}</span>
        </div>
      </div>

      <p className="text-xs text-cyan-100 leading-relaxed font-sans font-normal">
        {info.text}
      </p>
    </div>
  );
};
