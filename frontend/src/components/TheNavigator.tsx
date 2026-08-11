import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SamplingParameters } from '../types/sampling';
import {
  Compass,
  X,
  Send,
  Volume2,
  VolumeX,
  Minimize2,
  AudioWaveform,
  Move,
  Flame,
  Anchor,
  Ban,
  ShieldAlert,
  Lightbulb,
} from 'lucide-react';

export interface ActiveInteractionNotice {
  feature: string;
  value?: any;
  whatItIs: string;
  whyItIs: string;
  impact: string;
  guidance: string;
  timestamp: number;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'navigator';
  text: string;
  timestamp: string;
  badge?: string;
}

interface TheNavigatorProps {
  params: SamplingParameters;
  setParams: React.Dispatch<React.SetStateAction<SamplingParameters>>;
  prompt: string;
  setPrompt: (p: string) => void;
  ragContext: string;
  setRagContext: (rc: string) => void;
  ragEnabled: boolean;
  setRagEnabled: (e: boolean) => void;
  topCandidateStr?: string;
  topCandidateProb?: number;
  activeInteractionNotice?: ActiveInteractionNotice | null;
}

export const TheNavigator: React.FC<TheNavigatorProps> = ({
  params,
  setParams,
  prompt,
  setPrompt,
  ragContext,
  setRagContext,
  ragEnabled,
  setRagEnabled,
  topCandidateStr = 'Paris',
  topCandidateProb = 0.85,
  activeInteractionNotice = null,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true); // Muted by default for browser autoplay policy
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Free-floating Draggable Position State
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 180 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const posStartRef = useRef<{ x: number; y: number }>({ x: 24, y: 180 });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'navigator',
      text: "Greetings, Explorer! I am your free-floating Navigator guide. You can drag my console anywhere on the screen! Whenever you touch a slider, toggle a preset, or click any control, I will explain what it is, why it exists, and how it impacts AI probabilities.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Web Speech API Native Text-to-Speech (TTS) Execution
  const speakText = useCallback((text: string) => {
    if (isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    // Cancel previous queued speech to prevent backlog during rapid drag
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(
      v =>
        v.name.includes('Google') ||
        v.name.includes('Samantha') ||
        v.name.includes('Zira') ||
        v.name.includes('Natural') ||
        v.lang.startsWith('en')
    );

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  // Stop speech if muted
  useEffect(() => {
    if (isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isMuted]);

  // Handle Proactive Interaction Notifications whenever user touches any slider or UI control
  const lastNoticeTimeRef = useRef<number>(0);
  useEffect(() => {
    if (!activeInteractionNotice || activeInteractionNotice.timestamp <= lastNoticeTimeRef.current) {
      return;
    }
    lastNoticeTimeRef.current = activeInteractionNotice.timestamp;

    const formattedText = `💡 ${activeInteractionNotice.feature.toUpperCase()}\n\n• WHAT IT IS: ${activeInteractionNotice.whatItIs}\n• WHY IT EXISTS: ${activeInteractionNotice.whyItIs}\n• HOW IT IMPACTS: ${activeInteractionNotice.impact}\n• GUIDANCE: ${activeInteractionNotice.guidance}`;

    const newMsg: ChatMessage = {
      id: `notice-${Date.now()}`,
      sender: 'navigator',
      text: formattedText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      badge: activeInteractionNotice.feature,
    };

    setMessages(prev => [...prev, newMsg]);

    // Speak proactive explanation audio
    const spokenSummary = `${activeInteractionNotice.feature}. ${activeInteractionNotice.impact} ${activeInteractionNotice.guidance}`;
    speakText(spokenSummary);
  }, [activeInteractionNotice, speakText]);

  // Mouse Drag Handlers for Free-Floating UI Mobility
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking header or move handle
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      
      const newX = Math.max(10, Math.min(window.innerWidth - 380, posStartRef.current.x + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 500, posStartRef.current.y + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Construct silent state snapshot payload for deep awareness
  const getUIStateSnapshot = () => {
    return {
      prompt,
      temperature: params.temperature,
      topK: params.topK,
      topP: params.topP,
      minP: params.minP,
      frequencyPenalty: params.frequencyPenalty,
      presencePenalty: params.presencePenalty,
      ragEnabled,
      logitBiases: params.logitBiases,
      topCandidateStr,
      topCandidateProb: `${(topCandidateProb * 100).toFixed(1)}%`,
    };
  };

  // State-aware response engine
  const generateNavigatorResponse = (userQuery: string): { text: string; badge?: string } => {
    const q = userQuery.toLowerCase();
    const state = getUIStateSnapshot();

    if (q.includes('hallucinat') || q.includes('heat') || q.includes('wild')) {
      return {
        text: `Look at the canvas! At Temperature ${state.temperature.toFixed(2)}, candidate probabilities flatten out. Low-probability outer asteroids glow brighter, causing the model to guess wildly. Lower Temperature to below 0.3 to restore factual focus!`,
        badge: 'Heat Entropy Warning',
      };
    } else if (q.includes('truth') || q.includes('fact') || q.includes('rag')) {
      return {
        text: `When RAG Grounding is ${state.ragEnabled ? 'ON' : 'OFF'}, retrieved factual context anchors logits. Grounded tokens get pulled to the center supergiant by cyan laser beams, forcing the LLM to stay tethered to facts!`,
        badge: 'RAG Tether Active',
      };
    } else if (q.includes('ban') || q.includes('delve') || q.includes('black hole') || q.includes('bias')) {
      return {
        text: `Applying a -100 Logit Bias creates a mathematical Black Hole! Target words implode into red cross icons on the outer fringe, making it impossible for the AI to select them.`,
        badge: 'Logit Bias Black Hole',
      };
    } else if (q.includes('repeat') || q.includes('loop') || q.includes('exhaust')) {
      return {
        text: `Frequency Penalty (${state.frequencyPenalty.toFixed(2)}) acts as an Exhaustion Meter! Words that have already appeared in the sentence context physically dim in opacity, forcing the model to pick fresh vocabulary.`,
        badge: 'Exhaustion Meter',
      };
    } else {
      return {
        text: `You're currently evaluating prompt "${state.prompt.slice(0, 30)}..." with Temperature ${state.temperature.toFixed(2)} and Top-K ${state.topK}. The top predicted next token is "${state.topCandidateStr}" (${state.topCandidateProb}). Try adjusting the Cosmic Heat slider or toggling RAG to see how the starfield shifts!`,
        badge: 'Cosmos State Analysis',
      };
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputMessage.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    setTimeout(() => {
      const response = generateNavigatorResponse(text);
      const navMsg: ChatMessage = {
        id: `nav-${Date.now()}`,
        sender: 'navigator',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        badge: response.badge,
      };
      setMessages(prev => [...prev, navMsg]);
      setIsTyping(false);

      speakText(response.text);
    }, 400);
  };

  // Interactive Tour Stop Callbacks
  const handleTourStop1_Hallucination = () => {
    setParams(prev => ({
      ...prev,
      temperature: 2.0,
      topK: 50,
    }));
    setRagEnabled(false);
    handleSendMessage('Show me how an AI hallucinates!');
  };

  const handleTourStop2_RAGTruth = () => {
    setParams(prev => ({
      ...prev,
      temperature: 0.1,
      topK: 5,
    }));
    setRagEnabled(true);
    if (!ragContext.trim()) {
      setRagContext('Paris is the capital of France. The Eiffel Tower is located on the Champ de Mars in Paris.');
    }
    handleSendMessage('How do I force the AI to tell the truth?');
  };

  const handleTourStop3_BlackHoleBan = () => {
    setParams(prev => ({
      ...prev,
      logitBiases: {
        ...prev.logitBiases,
        'delve': -100,
        'delves': -100,
      },
    }));
    handleSendMessage('How do I ban annoying buzzwords like "delve"?');
  };

  const handleTourStop4_FrequencyExhaustion = () => {
    setParams(prev => ({
      ...prev,
      frequencyPenalty: 1.2,
      presencePenalty: 0.5,
    }));
    handleSendMessage('How do I fix repetitive text and looping?');
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
      }}
      className="font-sans select-none"
    >
      {!isOpen ? (
        // Floating Draggable Launcher Button
        <button
          onClick={() => setIsOpen(true)}
          onMouseDown={handleMouseDown}
          aria-label="Open The Navigator Tourist Guide Chatbot (Draggable)"
          className="group flex items-center space-x-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 p-0.5 shadow-neon-cyan hover:scale-105 transition-transform duration-150 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center space-x-2 rounded-[14px] bg-slate-950 px-4 py-2.5">
            <Move className="h-3.5 w-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
            <div className={`relative flex h-7 w-7 items-center justify-center rounded-xl ${
              isSpeaking ? 'bg-cyan-500 text-slate-950 shadow-neon-cyan animate-pulse' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/40'
            }`}>
              <Compass className="h-4 w-4 animate-spin-slow" />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-90" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400" />
                </span>
              )}
            </div>
            <div className="text-left">
              <span className="block text-xs font-bold text-slate-100 group-hover:text-cyan-300">
                The Navigator
              </span>
              <span className="block text-[10px] text-cyan-400/80 font-mono">
                {isSpeaking ? '🔊 Speaking...' : 'Draggable Guide • Real-time AI'}
              </span>
            </div>
          </div>
        </button>
      ) : (
        // Free-Floating Draggable Glassmorphic Chat Console
        <div className="flex flex-col w-[360px] sm:w-[400px] h-[540px] rounded-2xl glass-panel border border-cyan-500/30 shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in duration-200 bg-slate-950/95">
          {/* Header Bar (Draggable Drag Handle) */}
          <div
            onMouseDown={handleMouseDown}
            className="flex items-center justify-between border-b border-cyan-500/20 bg-slate-950 px-4 py-3 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center space-x-2.5">
              <Move className="h-4 w-4 text-cyan-400/70" />
              <div className={`relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 p-0.5 ${
                isSpeaking ? 'shadow-neon-cyan ring-2 ring-cyan-400' : ''
              }`}>
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                  <Compass className="h-4 w-4 text-cyan-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-slate-100">The Navigator</h3>
                  {isSpeaking && (
                    <span className="flex items-center space-x-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-400/30">
                      <AudioWaveform className="h-3 w-3 animate-pulse text-cyan-400" />
                      <span>Speaking</span>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-cyan-400 font-mono flex items-center space-x-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Free-Floating Mobility • Real-time AI</span>
                </p>
              </div>
            </div>

            {/* Mute/Unmute Audio Toggle & Minimize */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setIsMuted(!isMuted)}
                aria-label={isMuted ? 'Unmute Web Speech API voice assistant' : 'Mute voice assistant'}
                className={`p-1.5 rounded-lg transition-colors ${
                  !isMuted
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-neon-cyan'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
                title={isMuted ? 'Unmute Voice Assistant (Web Speech API)' : 'Mute Voice Assistant'}
              >
                {!isMuted ? <Volume2 className="h-4 w-4 text-cyan-400 animate-pulse" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Minimize The Navigator guide"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Live State Snapshot Indicator Badge */}
          <div className="flex items-center justify-between bg-slate-900/90 px-4 py-1.5 border-b border-slate-800 text-[10px] font-mono text-slate-300">
            <span>Temp: <strong className="text-amber-400">{params.temperature.toFixed(2)}</strong></span>
            <span>Top-K: <strong className="text-cyan-400">{params.topK}</strong></span>
            <span>RAG: <strong className={ragEnabled ? 'text-cyan-400' : 'text-slate-400'}>{ragEnabled ? 'ON' : 'OFF'}</strong></span>
            <span>Voice: <strong className={!isMuted ? 'text-cyan-300' : 'text-slate-500'}>{!isMuted ? 'ON' : 'MUTED'}</strong></span>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-950/40 select-text">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.badge && (
                  <span className="mb-1 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300 border border-cyan-500/20">
                    ⚡ {msg.badge}
                  </span>
                )}
                <div
                  className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 font-medium rounded-br-none'
                      : 'bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-1 text-[9px] font-mono text-slate-500 px-1">
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 p-2 rounded-2xl rounded-bl-none w-16">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce delay-100" />
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce delay-200" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Interactive Tour Stop Chips (Action Callbacks) */}
          <div className="border-t border-slate-800 bg-slate-950/80 p-2 space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-1">
              Interactive Tour Stops (Action Callbacks)
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={handleTourStop1_Hallucination}
                aria-label="Tour Stop: Show me how an AI hallucinates"
                className="flex items-center space-x-1 rounded-lg bg-slate-900 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-950/40 transition-colors"
              >
                <Flame className="h-3 w-3 text-amber-400" />
                <span>1. Hallucination Demo</span>
              </button>

              <button
                onClick={handleTourStop2_RAGTruth}
                aria-label="Tour Stop: Force AI to tell the truth with RAG"
                className="flex items-center space-x-1 rounded-lg bg-slate-900 border border-cyan-500/30 px-2 py-1 text-[10px] text-cyan-300 hover:bg-cyan-950/40 transition-colors"
              >
                <Anchor className="h-3 w-3 text-cyan-400" />
                <span>2. RAG Fact Anchor</span>
              </button>

              <button
                onClick={handleTourStop3_BlackHoleBan}
                aria-label="Tour Stop: Ban annoying words with Black Hole Logit Bias"
                className="flex items-center space-x-1 rounded-lg bg-slate-900 border border-rose-500/30 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40 transition-colors"
              >
                <Ban className="h-3 w-3 text-rose-400" />
                <span>3. Black Hole Ban</span>
              </button>

              <button
                onClick={handleTourStop4_FrequencyExhaustion}
                aria-label="Tour Stop: Fix word repetition with Exhaustion Meter"
                className="flex items-center space-x-1 rounded-lg bg-slate-900 border border-emerald-500/30 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-950/40 transition-colors"
              >
                <ShieldAlert className="h-3 w-3 text-emerald-400" />
                <span>4. Fix Repetition</span>
              </button>
            </div>
          </div>

          {/* Input Bar */}
          <div className="flex items-center space-x-2 border-t border-slate-800 bg-slate-950 p-3 select-text">
            <input
              type="text"
              aria-label="Ask The Navigator guide a question"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask The Navigator about the dashboard..."
              className="flex-1 rounded-xl bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
            />
            <button
              onClick={() => handleSendMessage()}
              aria-label="Send message to The Navigator"
              className="rounded-xl bg-cyan-500 p-2 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
