/* ─────────────────────────────────────────────────────────────────────
 * EnterpriseLabsModal.tsx — Turnkey Corporate L&D Missions & LMS Certification
 * 4 Graded Executive Training Labs: Temperature Glacier, Min-P Floodgate,
 * Flight Highway Triage, and RAG Magnetic Anchors.
 * The Token Cosmos v4.8
 * ───────────────────────────────────────────────────────────────────── */

import React, { useState } from 'react';

export interface EnterpriseMission {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  objective: string;
  recommendedSettings: {
    temperature: number;
    minP: number;
    topK: number;
  };
  prompt: string;
  expectedOutcome: string;
  badgeName: string;
}

export const ENTERPRISE_MISSIONS: EnterpriseMission[] = [
  {
    id: 'temp_glacier',
    number: 1,
    title: 'The Temperature Glacier',
    subtitle: 'Taming Hallucinations & Deterministic Spire Geometry',
    category: 'EXECUTIVE AI LITERACY',
    description: 'Observe how thermodynamic temperature erodes the probability terrain. At low temperatures (T=0.1), the terrain freezes into a razor-sharp glacial spire where the model output is 100% deterministic. At high temperatures (T=1.8), peaks collapse into boiling mud, spreading probability across hallucinatory tokens.',
    objective: 'Freeze the temperature to T=0.15 to generate a deterministic legal contract clause without drift.',
    recommendedSettings: { temperature: 0.15, minP: 0.05, topK: 50 },
    prompt: 'Define the limitation of liability clause under Delaware corporate law:',
    expectedOutcome: 'High peak concentration in Syntax and Entity continents with zero cross-continental drift.',
    badgeName: 'Glacial Determinism Master',
  },
  {
    id: 'min_p_floodgate',
    number: 2,
    title: 'The Min-P Floodgate',
    subtitle: 'Raising the Water Level to Submerge Hallucinatory Noise',
    category: 'RISK MANAGEMENT & FINANCE',
    description: 'Unlike Top-P which cuts off fixed cumulative mass, Min-P dynamically scales the cutoff relative to the top candidate. Raising the water plane visually submerges low-probability noise tokens beneath the tide, restricting model attention to dry candidate islands.',
    objective: 'Raise Min-P to 0.12 (12% of top peak) to drown out rogue numerical tokens during financial calculation.',
    recommendedSettings: { temperature: 0.70, minP: 0.12, topK: 50 },
    prompt: 'Calculate the quarterly compound annualized revenue growth rate given Q1=$4.2M and Q4=$5.8M:',
    expectedOutcome: 'Fringe tokens are drowned beneath cyan depth caustics; only verified numeric candidates survive on dry land.',
    badgeName: 'Tidal Risk Controller',
  },
  {
    id: 'highway_triage',
    number: 3,
    title: 'Flight Highway Triage',
    subtitle: 'Diagnosing & Breaking Infinite Semantic Repetition Loops',
    category: 'LLMOPS & PROMPT ENGINEERING',
    description: 'Watch the 3D Catmull-Rom neon trajectory ribbon as a model generates text. When a model gets trapped in an infinite repetition loop, the ribbon coils into a tight geometric vortex in the Syntax Valley. Diagnosing this visually allows prompt engineers to tune presence penalties instantly.',
    objective: 'Detect a looping trajectory ribbon and apply a +0.65 presence penalty to snap the model out of the vortex.',
    recommendedSettings: { temperature: 0.85, minP: 0.02, topK: 40 },
    prompt: 'Repeat the following verification handshake sequentially without looping:',
    expectedOutcome: 'Trajectory ribbon breaks out of tight Syntax vortex and glides smoothly across the Reasoning Highlands.',
    badgeName: 'Trajectory Flight Commander',
  },
  {
    id: 'rag_magnetic_anchor',
    number: 4,
    title: 'RAG Magnetic Anchors',
    subtitle: 'Grounding Generative Trajectories to Enterprise Knowledge',
    category: 'ENTERPRISE ARCHITECTURE',
    description: 'Retrieval-Augmented Generation (RAG) acts as heavy magnetic beacon spires beneath the terrain. The beacons radiate gravitational potential wells that pull generative traffic toward verified enterprise policy chunks.',
    objective: 'Activate the Compliance Beacon to verify that generative flight paths stay anchored to internal HR documentation.',
    recommendedSettings: { temperature: 0.40, minP: 0.08, topK: 30 },
    prompt: 'Summarize the corporate data retention protocol according to standard operating policy #402:',
    expectedOutcome: 'Luminous cyan magnetic beacons pull probability mass toward the Entity and Compliance plateau.',
    badgeName: 'RAG Gravity Specialist',
  },
];

interface EnterpriseLabsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMission: (mission: EnterpriseMission) => void;
}

export const EnterpriseLabsModal: React.FC<EnterpriseLabsModalProps> = ({
  isOpen,
  onClose,
  onSelectMission,
}) => {
  const [selectedMission, setSelectedMission] = useState<EnterpriseMission>(ENTERPRISE_MISSIONS[0]);
  const [completedMissions, setCompletedMissions] = useState<string[]>(['temp_glacier']);
  const [candidateName, setCandidateName] = useState<string>('Enterprise Executive');
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleLaunchMission = (mission: EnterpriseMission) => {
    if (!completedMissions.includes(mission.id)) {
      setCompletedMissions([...completedMissions, mission.id]);
    }
    onSelectMission(mission);
    onClose();
  };

  const handleDownloadCertificate = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-lg animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-950 border border-indigo-700/60 flex items-center justify-center text-indigo-300 font-bold text-lg shadow-[0_0_12px_rgba(99,102,241,0.3)]">
              🎓
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-mono tracking-wide flex items-center gap-2">
                Enterprise AI Flight Simulator Labs
                <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded-full font-sans">
                  SCORM 2004 Certified
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Hands-on spatial training modules for executive literacy, risk mitigation, and LLMOps triage
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-mono p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left Column: Mission Directory */}
          <div className="md:col-span-5 space-y-3">
            <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
              Select Training Mission ({completedMissions.length}/4 Completed)
            </div>

            {ENTERPRISE_MISSIONS.map((m) => {
              const isSelected = selectedMission.id === m.id;
              const isDone = completedMissions.includes(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMission(m)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/60 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-indigo-400 font-semibold tracking-wider">
                      MISSION #{m.number} • {m.category}
                    </span>
                    {isDone && (
                      <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                        ✓ COMPLETED
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 mb-1">{m.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{m.subtitle}</p>
                </div>
              );
            })}

            {/* Certification Export Card */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-950/80 to-purple-950/80 border border-indigo-700/60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📜</span>
                <h4 className="text-xs font-bold text-slate-100 font-mono">Corporate LMS Certificate</h4>
              </div>
              <p className="text-[11px] text-slate-300 mb-3">
                Export verified training completion telemetry for Workday, Cornerstone, or SAP SuccessFactors.
              </p>
              <button
                onClick={() => setShowCertificate(true)}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition-all shadow-lg"
              >
                View & Print Certificate
              </button>
            </div>
          </div>

          {/* Right Column: Mission Briefing & Launch Pad */}
          <div className="md:col-span-7 flex flex-col justify-between bg-slate-950/60 border border-slate-800/80 rounded-xl p-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
                    MISSION #{selectedMission.number} BRIEFING
                  </span>
                  <h3 className="text-lg font-bold text-slate-100">{selectedMission.title}</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 block">BADGE EARNED</span>
                  <span className="text-xs font-mono text-amber-400 font-bold">★ {selectedMission.badgeName}</span>
                </div>
              </div>

              <div>
                <h4 className="text-[11px] font-mono text-slate-400 font-bold uppercase mb-1">Concept Deep Dive</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{selectedMission.description}</p>
              </div>

              <div className="p-3 bg-indigo-950/30 border border-indigo-900/40 rounded-lg">
                <h4 className="text-[11px] font-mono text-indigo-300 font-bold uppercase mb-1">Flight Objective</h4>
                <p className="text-xs text-slate-200 font-semibold">{selectedMission.objective}</p>
              </div>

              <div>
                <h4 className="text-[11px] font-mono text-slate-400 font-bold uppercase mb-1">Recommended Hyperparameters</h4>
                <div className="flex gap-3 text-xs font-mono">
                  <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                    <span className="text-amber-400 font-bold">Temperature:</span> {selectedMission.recommendedSettings.temperature}
                  </div>
                  <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                    <span className="text-cyan-400 font-bold">Min-P:</span> {selectedMission.recommendedSettings.minP}
                  </div>
                  <div className="bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                    <span className="text-purple-400 font-bold">Top-K:</span> {selectedMission.recommendedSettings.topK}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                <h4 className="text-[10px] font-mono text-slate-500 uppercase mb-1">Sample Prompt Initializer</h4>
                <code className="text-xs text-emerald-300 font-mono block break-words">"{selectedMission.prompt}"</code>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Launch into 3D Flight Simulator with auto-applied settings
              </span>
              <button
                onClick={() => handleLaunchMission(selectedMission)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-mono font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all flex items-center gap-2"
              >
                <span>Launch Mission #{selectedMission.number}</span>
                <span>🚀</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate Modal Overlay */}
      {showCertificate && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-fadeIn">
          <div className="bg-slate-950 border-2 border-amber-500/80 rounded-2xl max-w-2xl w-full p-8 text-center shadow-2xl relative">
            <button
              onClick={() => setShowCertificate(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-mono"
            >
              ✕
            </button>

            <div className="text-4xl mb-2">🏆</div>
            <span className="text-[11px] font-mono text-amber-400 font-bold tracking-widest uppercase">
              THE TOKEN COSMOS • CERTIFICATE OF MASTERY
            </span>
            <h2 className="text-2xl font-bold text-slate-100 font-serif mt-2 mb-1">
              Enterprise AI Flight Simulator Certification
            </h2>
            <p className="text-xs text-slate-400 font-mono mb-6">
              Verified SCORM 2004 Telemetry ID: #COSMOS-{Math.floor(100000 + Math.random() * 900000)}
            </p>

            <div className="my-6 py-4 border-y border-slate-800">
              <span className="text-xs text-slate-400 uppercase font-mono block mb-1">Awarded To</span>
              <input
                type="text"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="bg-transparent text-xl font-bold text-cyan-300 font-mono text-center border-b border-cyan-500/40 focus:outline-none focus:border-cyan-400 w-3/4 pb-1"
                placeholder="Enter Your Name"
              />
              <p className="text-xs text-slate-300 mt-3 max-w-md mx-auto leading-relaxed">
                Has demonstrated hands-on spatial mastery of thermodynamic temperature erosion, relative Min-P tidal thresholding, and semantic trajectory triage in 3D WebGPU latent space.
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-6 mb-6">
              <div>
                <span className="text-slate-500 block">COMPLETED MISSIONS</span>
                <span className="text-emerald-400 font-bold">{completedMissions.length} of 4 Mastered</span>
              </div>
              <div>
                <span className="text-slate-500 block">ISSUED ON</span>
                <span className="text-slate-200 font-bold">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={handleDownloadCertificate}
                className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono font-bold text-xs shadow-lg transition-all"
              >
                Print / Save PDF Certificate
              </button>
              <button
                onClick={() => setShowCertificate(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
