import React, { useState } from 'react';
import { Sparkles, Github, Layers, BookOpen, Orbit, Settings, Share2, Check } from 'lucide-react';

interface HeaderProps {
  activeTab: 'visualizer' | 'blog';
  setActiveTab: (tab: 'visualizer' | 'blog') => void;
  splitView: boolean;
  setSplitView: (val: boolean) => void;
  onOpenSettings: () => void;
  onCopySetupLink: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  splitView,
  setSplitView,
  onOpenSettings,
  onCopySetupLink,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    onCopySetupLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-cyan-500/15 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand logo & title */}
        <div className="flex items-center space-x-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 shadow-neon-cyan">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
              <Orbit className="h-5 w-5 animate-pulse text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="bg-gradient-to-r from-cyan-400 via-sky-200 to-purple-400 bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:text-xl">
                The Token Cosmos
              </h1>
              <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Interactive LLM Probability Visualizer & Educational Guide
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center space-x-2.5">
          {/* Share Setup Link */}
          <button
            onClick={handleCopy}
            aria-label="Copy current parameter setup link to clipboard"
            className="flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
            title="Copy Setup Link to Clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5 text-cyan-400" />}
            <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Share Setup'}</span>
          </button>

          {/* BYOE Engine Settings Gear */}
          <button
            onClick={onOpenSettings}
            aria-label="Open Bring Your Own Engine configuration settings modal"
            className="flex items-center space-x-1.5 rounded-lg p-2 text-xs font-medium bg-slate-900 text-slate-300 border border-slate-800 hover:border-purple-500/40 hover:text-purple-300 transition-all"
            title="Bring Your Own Engine (BYOE) Settings"
          >
            <Settings className="h-4 w-4 text-purple-400" />
          </button>

          {/* Split-View Toggle */}
          {activeTab === 'visualizer' && (
            <button
              onClick={() => setSplitView(!splitView)}
              aria-label={splitView ? 'Disable split view mode' : 'Enable side-by-side RAG split view mode'}
              className={`flex items-center space-x-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                splitView
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-neon-cyan'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
              title="Compare Baseline AI vs. Grounded RAG AI side-by-side"
            >
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden md:inline">{splitView ? 'Split-View Active' : 'Compare RAG Split-View'}</span>
            </button>
          )}

          {/* Tab buttons */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800" role="tablist">
            <button
              onClick={() => setActiveTab('visualizer')}
              role="tab"
              aria-selected={activeTab === 'visualizer'}
              aria-label="Switch to Interactive Cosmos Visualizer tab"
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                activeTab === 'visualizer'
                  ? 'bg-cyan-500 text-slate-950 font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Cosmos UI</span>
            </button>
            <button
              onClick={() => setActiveTab('blog')}
              role="tab"
              aria-selected={activeTab === 'blog'}
              aria-label="Switch to Educational Guide and Cheat Sheet tab"
              className={`flex items-center space-x-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
                activeTab === 'blog'
                  ? 'bg-purple-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Guide & Cheat Sheet</span>
            </button>
          </div>

          {/* GitHub link */}
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source code repository on GitHub"
            className="hidden sm:flex items-center justify-center rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            title="View Code Repository on GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
