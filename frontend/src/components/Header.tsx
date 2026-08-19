import React, { useState } from 'react';
import { Sparkles, Github, Layers, BookOpen, Compass, Settings, Share2, Check, Swords, Code2, GraduationCap } from 'lucide-react';

interface HeaderProps {
  activeTab: 'learn' | 'experiment' | 'labs' | 'export';
  setActiveTab: (tab: 'learn' | 'experiment' | 'labs' | 'export') => void;
  splitView: boolean;
  setSplitView: (val: boolean) => void;
  onOpenSettings: () => void;
  onCopySetupLink: () => void;
  onOpenCodeExport?: () => void;
  showNavigator?: boolean;
  setShowNavigator?: (val: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  splitView,
  setSplitView,
  onOpenSettings,
  onCopySetupLink,
  onOpenCodeExport,
  showNavigator,
  setShowNavigator,
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = () => {
    onCopySetupLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0f172a]/95 border-b border-white/10 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:flex-nowrap sm:px-6 sm:py-3">
        {/* Brand logo & title */}
        <div className="flex min-w-0 flex-1 items-center space-x-3 sm:flex-none">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 border border-sky-500/30">
            <Compass className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="whitespace-nowrap text-base font-bold text-white sm:text-xl">
                The Token Cosmos
              </h1>
              <span className="hidden rounded-full border border-sky-500/30 bg-sky-500/20 px-2.5 py-0.5 font-mono text-[10px] text-sky-300 sm:inline">
                Atlas v6.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Latent Space Navigation Atlas & Cartographic LLM Visualizer
            </p>
          </div>
        </div>

        {/* Floating Pill Action Controls & Navigation */}
        <div className="flex w-full items-center justify-between gap-1 overflow-x-auto sm:ml-auto sm:w-auto sm:justify-end sm:gap-2">
          {/* Share Setup Link */}
          <button
            onClick={handleCopy}
            aria-label="Copy current parameter setup link to clipboard"
            className="btn-secondary-matte flex shrink-0 items-center space-x-1.5 rounded-full p-2 text-xs sm:px-3.5 sm:py-1.5"
            title="Copy Setup Link to Clipboard"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Link Copied!' : 'Share Setup'}</span>
          </button>

          {/* BYOE Engine Settings Gear */}
          <button
            onClick={onOpenSettings}
            aria-label="Open Bring Your Own Engine configuration settings modal"
            className="btn-secondary-matte shrink-0 rounded-full p-2 text-xs"
            title="Bring Your Own Engine (BYOE) Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* AI Tourist Guide Toggle */}
          {setShowNavigator && (
            <button
              onClick={() => setShowNavigator(!showNavigator)}
              aria-label={showNavigator ? 'Hide AI Navigator Guide' : 'Open AI Navigator Guide'}
              className={`flex shrink-0 items-center space-x-1.5 rounded-full p-2 text-xs font-medium transition-all sm:px-3 sm:py-1.5 ${
                showNavigator
                  ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-sm'
                  : 'btn-secondary-matte'
              }`}
              title="Toggle AI Tourist Guide"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="hidden lg:inline">{showNavigator ? 'Guide Active' : 'AI Guide'}</span>
            </button>
          )}

          {/* A/B Duel Mode Toggle */}
          {activeTab === 'experiment' && (
            <button
              onClick={() => setSplitView(!splitView)}
              aria-label={splitView ? 'Disable A/B Duel Mode' : 'Enable side-by-side A/B Duel Mode'}
              className={`flex shrink-0 items-center space-x-2 rounded-full p-2 text-xs font-medium transition-all sm:px-3.5 sm:py-1.5 ${
                splitView
                  ? 'bg-blue-600 text-white border border-blue-500 shadow-sm'
                  : 'btn-secondary-matte'
              }`}
              title="Compare Model / Parameter Configurations side-by-side"
            >
              <Swords className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{splitView ? 'A/B Duel Active' : 'A/B Duel Mode'}</span>
            </button>
          )}

          {/* Floating Pill Navigation Tabs */}
          <div className="flex shrink-0 rounded-full border border-white/10 bg-[#232329] p-1" role="tablist">
            <button
              onClick={() => setActiveTab('learn')}
              role="tab"
              aria-selected={activeTab === 'learn'}
              aria-label="Switch to LEARN mode"
              className={`flex items-center space-x-1.5 rounded-full p-2 text-xs font-medium transition-all sm:px-3.5 sm:py-1 ${
                activeTab === 'learn'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">LEARN</span>
            </button>
            <button
              onClick={() => setActiveTab('labs')}
              role="tab"
              aria-selected={activeTab === 'labs'}
              aria-label="Switch to LABS mode"
              className={`flex items-center space-x-1.5 rounded-full p-2 text-xs font-medium transition-all sm:px-3.5 sm:py-1 ${
                activeTab === 'labs'
                  ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">LABS</span>
            </button>
            <button
              onClick={() => setActiveTab('experiment')}
              role="tab"
              aria-selected={activeTab === 'experiment'}
              aria-label="Switch to EXPERIMENT mode"
              className={`flex items-center space-x-1.5 rounded-full p-2 text-xs font-medium transition-all sm:px-3.5 sm:py-1 ${
                activeTab === 'experiment'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">EXPERIMENT</span>
            </button>
            <button
              onClick={() => setActiveTab('export')}
              role="tab"
              aria-selected={activeTab === 'export'}
              aria-label="Switch to EXPORT mode"
              className={`flex items-center space-x-1.5 rounded-full p-2 text-xs font-medium transition-all sm:px-3.5 sm:py-1 ${
                activeTab === 'export'
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">EXPORT</span>
            </button>
          </div>

          {/* GitHub Repository Link */}
          <a
            href="https://github.com/thokchomlolet03-cpu/the-token-cosmos"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open The Token Cosmos GitHub repository"
            className="btn-secondary-matte shrink-0 rounded-full p-2 text-xs"
            title="GitHub Repository"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
};
