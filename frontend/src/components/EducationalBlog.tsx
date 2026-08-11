import React from 'react';
import { BookOpen, Sparkles, Sliders, ShieldCheck, Flame, Magnet, Anchor, CheckCircle2, HelpCircle } from 'lucide-react';

export const EducationalBlog: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl space-y-10 py-6 px-4 sm:px-6">
      {/* Blog Hero Header */}
      <div className="glass-panel rounded-3xl p-8 border border-cyan-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="inline-flex items-center space-x-2 rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 border border-cyan-500/20">
            <BookOpen className="h-3.5 w-3.5" />
            <span>LLM Mechanics Deep Dive</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight bg-gradient-to-r from-slate-100 via-sky-200 to-cyan-300 bg-clip-text text-transparent">
            Demystifying LLM Sampling: How Parameters Shape AI Token Cosmos
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Large Language Models are not sentient reasoning engines—they are hyper-dimensional <strong>next-token probability predictors</strong>. Understanding how logits are sampled turns everyday AI prompts into precise, predictable tools.
          </p>
        </div>
      </div>

      {/* Article Section 1: The Probability Galaxy */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 space-y-4 border border-slate-800">
        <h3 className="text-xl font-bold text-cyan-300 flex items-center space-x-2">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          <span>1. The Visual Metaphor: Logits & Softmax</span>
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          At every step of text generation, the neural network evaluates its entire vocabulary (often 32,000 to 128,000 candidate tokens). It outputs an unnormalized vector of raw numbers called <strong>logits ($z_i$)</strong>.
        </p>
        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 font-mono text-xs text-cyan-200 overflow-x-auto">
          <p className="text-slate-400 mb-2">// Softmax transformation converting unnormalized raw logits into normalized percentages:</p>
          <p className="text-amber-300">P(x_i) = exp((z_i - z_max) / T) / Σ exp((z_j - z_max) / T)</p>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          High logits (&gt;10) become glowing center supergiants in the Token Cosmos. Low logits (&lt;0) form dim outer asteroid belts. The sampling parameters act as cosmic filters that shape which stars are eligible to be chosen.
        </p>
      </section>

      {/* Article Section 2: Deep Dive into Filters */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 border border-amber-500/20 space-y-3">
          <div className="flex items-center space-x-2 text-amber-400 font-bold">
            <Flame className="h-5 w-5" />
            <h4>Temperature ($T$) — The Cosmic Heat</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Temperature scales logits prior to softmax. At <strong>T = 0.1</strong>, logits become sharp peaks, creating a deterministic, cold focus on top facts. At <strong>T = 1.5</strong>, probability mass flattens across candidate tokens, introducing wild creative entropy.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-cyan-500/20 space-y-3">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <Sliders className="h-5 w-5" />
            <h4>Top-K & Top-P (Nucleus) Filtering</h4>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Top-K</strong> truncates candidate tokens strictly by rank index $k$. <strong>Top-P</strong> (Nucleus sampling) dynamically selects the smallest candidate pool whose cumulative sum reaches percentage $p$ (e.g. 90%), adapting naturally to uncertain prompts.
          </p>
        </div>
      </section>

      {/* Power User Cheat Sheet Table */}
      <section className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6 border border-purple-500/20 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-purple-300 flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-purple-400" />
              <span>Power User Cheat Sheet: Troubleshooting Guide</span>
            </h3>
            <p className="text-xs text-slate-400">
              Quick-reference lookup table mapping common daily AI prompts and failure modes to exact parameter adjustments.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-300 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Common AI Frustration</th>
                <th className="px-4 py-3">Root Cause</th>
                <th className="px-4 py-3">Recommended Parameter Fix</th>
                <th className="px-4 py-3">Expected Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-slate-300 font-mono">
              <tr className="hover:bg-slate-900/90 transition-colors">
                <td className="px-4 py-3 font-semibold text-rose-300">"Stop repeating words or looping"</td>
                <td className="px-4 py-3 text-slate-400">Zero context penalty allowing tokens to re-occur infinitely</td>
                <td className="px-4 py-3 text-emerald-400">
                  Frequency Penalty: <span className="font-bold text-white">0.5</span><br />
                  Presence Penalty: <span className="font-bold text-white">0.3</span>
                </td>
                <td className="px-4 py-3 text-slate-300">Penalizes previously seen tokens; forces vocabulary evolution.</td>
              </tr>

              <tr className="hover:bg-slate-900/90 transition-colors">
                <td className="px-4 py-3 font-semibold text-amber-300">"Stop hallucinating facts"</td>
                <td className="px-4 py-3 text-slate-400">High temperature picking outer low-probability noise tokens</td>
                <td className="px-4 py-3 text-cyan-400">
                  RAG Fact Anchor: <span className="font-bold text-white">ON</span><br />
                  Temperature: <span className="font-bold text-white">0.1</span> • Top-K: <span className="font-bold text-white">5</span>
                </td>
                <td className="px-4 py-3 text-slate-300">Strictly anchors logits to retrieved factual context.</td>
              </tr>

              <tr className="hover:bg-slate-900/90 transition-colors">
                <td className="px-4 py-3 font-semibold text-purple-300">"Stop saying overuse words ('Delve')"</td>
                <td className="px-4 py-3 text-slate-400">High baseline frequency logit bias in model weights</td>
                <td className="px-4 py-3 text-pink-400">
                  Logit Bias: <span className="font-bold text-white font-mono">'Delve': -100</span>
                </td>
                <td className="px-4 py-3 text-slate-300">Black-hole zeroing of logit mass; completely bans target token.</td>
              </tr>

              <tr className="hover:bg-slate-900/90 transition-colors">
                <td className="px-4 py-3 font-semibold text-sky-300">"Boost creative metaphors / stories"</td>
                <td className="px-4 py-3 text-slate-400">Low temperature restricting choices to generic common paths</td>
                <td className="px-4 py-3 text-purple-400">
                  Temperature: <span className="font-bold text-white">1.3</span><br />
                  Top-P: <span className="font-bold text-white">0.95</span>
                </td>
                <td className="px-4 py-3 text-slate-300">Expands nucleus shield; unlocks surprising imaginative tokens.</td>
              </tr>

              <tr className="hover:bg-slate-900/90 transition-colors">
                <td className="px-4 py-3 font-semibold text-emerald-300">"Enforce technical domain terms"</td>
                <td className="px-4 py-3 text-slate-400">Model preferring casual everyday synonyms over technical terms</td>
                <td className="px-4 py-3 text-amber-400">
                  Logit Bias: <span className="font-bold text-white font-mono">'quantum': +5.0</span><br />
                  Min-P: <span className="font-bold text-white">0.1</span>
                </td>
                <td className="px-4 py-3 text-slate-300">Magnetically pulls probability mass to specific technical terms.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
