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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      <header className="flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            SDLC Command Center
          </h1>
          <p className="text-muted-foreground mt-2">The Token Cosmos - Governance & Telemetry</p>
        </div>
        <div className="text-sm font-medium px-3 py-1 rounded-full bg-accent/20 text-accent border border-accent/30 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          Static CI Metrics ({new Date(lastUpdated).toLocaleTimeString()})
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* DORA METRICS */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 border-b border-border pb-2"><Zap className="w-5 h-5 text-yellow-400" /> DORA Core Metrics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Deployment Frequency" value={dora.deploymentFrequency} icon={<Layers className="text-blue-400"/>} trend="+12%" />
            <MetricCard title="Lead Time for Changes" value={dora.leadTimeForChanges} icon={<Clock className="text-purple-400"/>} trend="-5m" />
            <MetricCard title="Change Failure Rate" value={dora.changeFailureRate} icon={<XCircle className="text-red-400"/>} trend="-0.5%" />
            <MetricCard title="Time to Restore" value={dora.timeToRestoreService} icon={<CheckCircle className="text-green-400"/>} trend="-2m" />
          </div>

          <div className="bg-card border border-border rounded-xl p-6 h-72">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Deployment Velocity (7 Days)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="deploys" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30 font-semibold flex justify-between items-center">
              <span>Recent Deployments (.github/workflows/deploy.yml)</span>
              <span className="text-xs text-muted-foreground">Last 24 hours</span>
            </div>
            <div className="divide-y divide-border">
              {deploys.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No recent deployments.</div>}
              {deploys.map((dep, i) => (
                <div key={i} className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3">
                    {dep.status === 'success' ? <CheckCircle className="w-5 h-5 text-accent" /> : <XCircle className="w-5 h-5 text-destructive" />}
                    <div>
                      <div className="font-medium text-sm font-mono text-primary hover:underline cursor-pointer">{dep.sha}</div>
                      <div className="text-xs text-muted-foreground">{new Date(dep.timestamp).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">{dep.duration}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* GOVERNANCE & SPACE */}
        <div className="space-y-6">
          
          <h2 className="text-xl font-bold flex items-center gap-2 border-b border-border pb-2"><BookOpen className="w-5 h-5 text-orange-400" /> Governance</h2>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">ADR Ledger</h3>
            <div className="space-y-3">
              {adrs.map(adr => (
                <div key={adr.id} className="text-sm p-3 bg-muted/40 rounded-lg border border-border/50">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs text-primary">ADR {adr.id}</span>
                    <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">{adr.status}</span>
                  </div>
                  <div className="font-medium line-clamp-2">{adr.title}</div>
                </div>
              ))}
            </div>
            <button className="w-full py-2 text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors rounded-lg border border-primary/20">
              View All Decisions
            </button>
          </div>

          <h2 className="text-xl font-bold flex items-center gap-2 border-b border-border pb-2 pt-4"><GitMerge className="w-5 h-5 text-pink-400" /> SPACE Metrics</h2>
          <div className="grid gap-3">
            <SpaceCard label="Developer Satisfaction" value={`${space.satisfaction}%`} progress={space.satisfaction} color="bg-pink-500" />
            <SpaceCard label="Review Efficiency" value={`${space.efficiency}%`} progress={space.efficiency} color="bg-indigo-500" />
            <SpaceCard label="Weekly Commits (Activity)" value={space.activity.toString()} progress={Math.min(100, (space.activity/150)*100)} color="bg-blue-500" />
          </div>

        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, trend }: any) => (
  <div className="bg-card border border-border rounded-xl p-5 flex flex-col justify-between">
    <div className="flex justify-between items-start mb-4">
      <h3 className="text-sm font-medium text-muted-foreground leading-tight">{title}</h3>
      <div className="p-2 bg-muted/50 rounded-lg">{icon}</div>
    </div>
    <div className="flex items-end justify-between">
      <span className="text-2xl font-black">{value}</span>
      <span className={`text-xs font-bold ${trend.startsWith('+') ? 'text-accent' : 'text-primary'}`}>{trend}</span>
    </div>
  </div>
);

const SpaceCard = ({ label, value, progress, color }: any) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <div className="flex justify-between items-center mb-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
    <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${progress}%` }}></div>
    </div>
  </div>
);
