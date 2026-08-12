import React, { useState } from 'react';
import { Sparkles, Github, Layers, BookOpen, Orbit, Settings, Share2, Check, Swords, Code2 } from 'lucide-react';

interface HeaderProps {
  activeTab: 'visualizer' | 'blog';
  setActiveTab: (tab: 'visualizer' | 'blog') => void;
  splitView: boolean;
  setSplitView: (val: boolean) => void;
  onOpenSettings: () => void;
  onCopySetupLink: () => void;
  onOpenCodeExport?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  splitView,
  setSplitView,
  onOpenSettings,
  onCopySetupLink,
  onOpenCodeExport,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    onCopySetupLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#1c1c21]/95 border-b border-white/5 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand logo & title */}
        <div className="flex items-center space-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 border border-pink-500/30">
            <Orbit className="h-4 w-4 text-pink-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-white font-bold tracking-tight text-lg sm:text-xl">
                The Token Cosmos
              </h1>
              <span className="rounded-full bg-pink-500/20 px-2.5 py-0.5 text-[10px] font-mono text-pink-300 border border-pink-500/30">
                v4.0
              </span>
            </div>
            <p className="text-xs text-gray-400 hidden sm:block">
              Interactive LLM Probability Visualizer & Educational Guide
            </p>
          </div>
        </div>

        {/* Floating Pill Action Controls & Navigation */}
        <div className="flex items-center space-x-2">
          {/* Export Code Button (Pink Pill) */}
          {onOpenCodeExport && (
            <button
              onClick={onOpenCodeExport}
              aria-label="Export sampling setup into production code snippets"
              className="bg-pink-500 text-white rounded-full px-3.5 py-1.5 text-xs font-medium hover:bg-pink-400 transition-colors shadow-sm flex items-center space-x-1.5"
              title="Export Setup to Python / LangChain / cURL Code"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Export Code</span>
            </button>
          )}

          {/* Share Setup Link (Stealth Secondary Pill) */}
          <button
            onClick={handleCopy}
            aria-label="Copy current parameter setup link to clipboard"
            className="btn-secondary-matte rounded-full px-3.5 py-1.5 text-xs flex items-center space-x-1.5"
            title="Copy Setup Link to Clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Share Setup'}</span>
          </button>

          {/* BYOE Engine Settings Gear */}
          <button
            onClick={onOpenSettings}
            aria-label="Open Bring Your Own Engine configuration settings modal"
            className="btn-secondary-matte rounded-full p-2 text-xs"
            title="Bring Your Own Engine (BYOE) Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* A/B Duel Mode Toggle */}
          {activeTab === 'visualizer' && (
            <button
              onClick={() => setSplitView(!splitView)}
              aria-label={splitView ? 'Disable A/B Duel Mode' : 'Enable side-by-side A/B Duel Mode'}
              className={`flex items-center space-x-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                splitView
                  ? 'bg-pink-500 text-white border border-pink-400 shadow-sm'
                  : 'btn-secondary-matte'
              }`}
              title="Compare Model / Parameter Configurations side-by-side"
            >
              <Swords className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{splitView ? 'A/B Duel Active' : 'A/B Duel Mode'}</span>
            </button>
          )}

          {/* Floating Pill Navigation Tabs */}
          <div className="flex rounded-full bg-[#232329] p-1 border border-white/10" role="tablist">
            <button
              onClick={() => setActiveTab('visualizer')}
              role="tab"
              aria-selected={activeTab === 'visualizer'}
              aria-label="Switch to Interactive Cosmos Visualizer tab"
              className={`flex items-center space-x-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                activeTab === 'visualizer'
                  ? 'bg-pink-500 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Cosmos UI</span>
            </button>
            <button
              onClick={() => setActiveTab('blog')}
              role="tab"
              aria-selected={activeTab === 'blog'}
              aria-label="Switch to Guide & Cheat Sheet tab"
              className={`flex items-center space-x-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                activeTab === 'blog'
                  ? 'bg-pink-500 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Guide & Cheat Sheet</span>
            </button>
          </div>

          {/* GitHub Repository Link */}
          <a
            href="https://github.com/thokchomlolet03-cpu/the-token-cosmos"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open The Token Cosmos GitHub repository"
            className="btn-secondary-matte rounded-full p-2 text-xs"
            title="GitHub Repository"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
