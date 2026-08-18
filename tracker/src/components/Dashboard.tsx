import { useEffect, useState } from 'react';
import { fetchTrackerData, type TrackerData } from '../lib/github';
import { Activity, GitMerge, CheckCircle, XCircle, Clock, BookOpen, Layers, Zap } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Mon', deploys: 3 },
  { name: 'Tue', deploys: 5 },
  { name: 'Wed', deploys: 2 },
  { name: 'Thu', deploys: 6 },
  { name: 'Fri', deploys: 4 },
  { name: 'Sat', deploys: 1 },
  { name: 'Sun', deploys: 2 },
];

export const Dashboard = () => {
  const [trackerData, setTrackerData] = useState<TrackerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTrackerData()
      .then(setTrackerData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 text-center text-destructive flex flex-col items-center justify-center min-h-[50vh]">
        <XCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-bold">Failed to Load Telemetry</h2>
        <p className="mt-2 text-muted-foreground text-sm max-w-md">
          {error}
        </p>
        <p className="mt-4 text-xs bg-muted p-2 rounded text-left">
          Make sure you ran the `generate_sdlc_metrics.py` script to build the local metrics.json file.
        </p>
      </div>
    );
  }

  if (!trackerData) {
    return <div className="p-8 text-center animate-pulse text-muted-foreground">Loading Ephemeral Telemetry...</div>;
  }

  const { dora, space, deployments: deploys, adrs, lastUpdated } = trackerData;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-fade-in-up">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-8 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground flex items-center gap-3 drop-shadow-lg">
            <Activity className="w-10 h-10 text-primary drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            SDLC Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg font-light tracking-wide">The Token Cosmos - Governance & Telemetry</p>
        </div>
        <div className="text-sm font-medium px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20 flex items-center gap-2 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
          </span>
          Static CI Metrics ({new Date(lastUpdated).toLocaleTimeString()})
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* DORA METRICS */}
        <div className="lg:col-span-3 space-y-8 animate-fade-in-up animate-delay-100">
          <h2 className="text-2xl font-bold flex items-center gap-3 pb-2"><Zap className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" /> DORA Core Metrics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Deployment Frequency" value={dora.deploymentFrequency} icon={<Layers className="text-blue-400"/>} trend="+12%" />
            <MetricCard title="Lead Time for Changes" value={dora.leadTimeForChanges} icon={<Clock className="text-purple-400"/>} trend="-5m" />
            <MetricCard title="Change Failure Rate" value={dora.changeFailureRate} icon={<XCircle className="text-red-400"/>} trend="-0.5%" />
            <MetricCard title="Time to Restore" value={dora.timeToRestoreService} icon={<CheckCircle className="text-green-400"/>} trend="-2m" />
          </div>

          <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6 h-80 shadow-2xl transition-all duration-300 hover:shadow-primary/5 hover:border-primary/20">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-6">Deployment Velocity (7 Days)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(9, 9, 11, 0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }} 
                  itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="deploys" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#09090b' }} activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-card backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:border-white/10">
            <div className="px-6 py-4 border-b border-border bg-white/5 font-semibold flex justify-between items-center">
              <span className="tracking-wide">Recent Deployments (.github/workflows/deploy.yml)</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Last 24 hours</span>
            </div>
            <div className="divide-y divide-border/50">
              {deploys.length === 0 && <div className="p-8 text-sm text-muted-foreground text-center">No recent deployments.</div>}
              {deploys.map((dep, i) => (
                <div key={i} className="flex justify-between items-center p-5 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-4">
                    {dep.status === 'success' ? <CheckCircle className="w-5 h-5 text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" /> : <XCircle className="w-5 h-5 text-destructive drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" />}
                    <div>
                      <div className="font-semibold text-sm font-mono text-primary/90 group-hover:text-primary cursor-pointer transition-colors">{dep.sha}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 tracking-wide">{new Date(dep.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground/70 bg-white/5 px-2 py-1 rounded-md">{dep.duration}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GOVERNANCE & SPACE */}
        <div className="space-y-8 animate-fade-in-up animate-delay-200">
          
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 pb-4"><BookOpen className="w-6 h-6 text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.5)]" /> Governance</h2>
            <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6 space-y-5 shadow-2xl transition-all duration-300 hover:border-white/10">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">ADR Ledger</h3>
              <div className="space-y-4">
                {adrs.map(adr => (
                  <div key={adr.id} className="text-sm p-4 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-xs font-bold text-primary/90">ADR {adr.id}</span>
                      <span className="text-[10px] uppercase font-black tracking-wider text-accent bg-accent/10 px-2.5 py-1 rounded-md border border-accent/20">{adr.status}</span>
                    </div>
                    <div className="font-medium text-foreground/90 leading-relaxed">{adr.title}</div>
                  </div>
                ))}
              </div>
              <button className="w-full py-3 mt-2 text-xs font-bold tracking-widest uppercase bg-primary/10 hover:bg-primary/20 text-primary transition-all rounded-xl border border-primary/20 hover:border-primary/40 focus:ring-2 focus:ring-primary/50 outline-none">
                View All Decisions
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3 pb-4 pt-2"><GitMerge className="w-6 h-6 text-pink-400 drop-shadow-[0_0_10px_rgba(244,114,182,0.5)]" /> SPACE Metrics</h2>
            <div className="grid gap-4">
              <SpaceCard label="Developer Satisfaction" value={`${space.satisfaction}%`} progress={space.satisfaction} color="bg-gradient-to-r from-pink-600 to-pink-400" />
              <SpaceCard label="Review Efficiency" value={`${space.efficiency}%`} progress={space.efficiency} color="bg-gradient-to-r from-indigo-600 to-indigo-400" />
              <SpaceCard label="Weekly Commits (Activity)" value={space.activity.toString()} progress={Math.min(100, (space.activity/150)*100)} color="bg-gradient-to-r from-blue-600 to-blue-400" />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-6 flex flex-col justify-between shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:border-white/10 group">
    <div className="flex justify-between items-start mb-6">
      <h3 className="text-sm font-bold text-muted-foreground leading-tight tracking-wide group-hover:text-foreground/80 transition-colors">{title}</h3>
      <div className="p-2.5 bg-black/40 rounded-xl border border-white/5 shadow-inner">{icon}</div>
    </div>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-black tracking-tight">{value}</span>
      <span className={`text-xs font-black px-2 py-1 rounded-md bg-black/40 border border-white/5 ${trend.startsWith('+') ? 'text-accent' : 'text-primary'}`}>{trend}</span>
    </div>
  </div>
);

const SpaceCard = ({ label, value, progress, color }: any) => (
  <div className="bg-card backdrop-blur-xl border border-border rounded-2xl p-5 shadow-xl transition-all duration-300 hover:border-white/10 hover:shadow-2xl hover:-translate-y-0.5 group">
    <div className="flex justify-between items-center mb-3">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest group-hover:text-foreground/80 transition-colors">{label}</span>
      <span className="text-sm font-black tracking-wider">{value}</span>
    </div>
    <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden shadow-inner border border-white/5">
      <div className={`${color} h-2 rounded-full transition-all duration-1000 ease-out`} style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);
