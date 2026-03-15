"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { WorkspaceOverview } from "@taas/domain-sdk";
import { 
  Activity, 
  Clock, 
  AlertTriangle,
  Monitor,
  Zap,
  ShieldCheck,
  Radio
} from "lucide-react";
import { 
  NothingCard, 
  DotMatrixText, 
  PillBadge, 
  DottedDivider,
  TerminalBlink
} from "@dennislee928/nothingx-react-components";

export default function Dashboard() {
  const client = useTaas();
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(setOverview)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [client]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-12 h-12 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      <DotMatrixText color="#888" dotSize={2}>INITIALIZING_SYSTEM</DotMatrixText>
    </div>
  );

  if (error) return (
    <NothingCard dark style={{ border: '1px solid #ff0000', padding: 32 }}>
      <div className="flex items-center gap-4 text-red-500 mb-4">
        <AlertTriangle size={32} />
        <h2 className="text-2xl font-black">CRITICAL_ERROR</h2>
      </div>
      <p className="font-mono text-sm text-red-400/80">{error}</p>
    </NothingCard>
  );

  if (!overview) return null;

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck className="text-red-500" size={20} />
            <span className="text-[10px] font-mono tracking-[0.3em] text-red-500/80 uppercase font-black">SECURE_ENVIRONMENT_ACTIVE</span>
          </div>
          <h2 className="text-5xl font-black tracking-tighter">OVERVIEW</h2>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground bg-white/5 px-4 py-2 rounded-full border border-white/10">
          <TerminalBlink />
          <span>LAST_SYNC: {new Date(overview.generated_at).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="ACTIVE_SESSIONS" 
          value={overview.sessions.length.toString().padStart(2, '0')} 
          icon={<Activity size={16} />} 
        />
        <StatCard 
          title="IOT_NODES" 
          value={overview.devices.filter(d => d.connected).length.toString().padStart(2, '0')} 
          icon={<Monitor size={16} />} 
        />
        <StatCard 
          title="LOGIC_RULES" 
          value={overview.rulesets.filter(r => r.enabled).length.toString().padStart(2, '0')} 
          icon={<Zap size={16} />} 
        />
        <StatCard 
          title="PANIC_STOPS" 
          value={overview.metrics.panic_stops.toString().padStart(2, '0')} 
          icon={<AlertTriangle size={16} />} 
          critical={overview.metrics.panic_stops > 0}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        {/* Recent Telemetry */}
        <div className="lg:col-span-8">
          <NothingCard dark style={{ border: '1px solid #222', height: '100%', padding: 24 }}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black tracking-widest flex items-center gap-3">
                <Radio size={16} className="text-red-500" /> LIVE_TELEMETRY_FEED
              </h3>
              <PillBadge variant="neutral">REAL_TIME_v4</PillBadge>
            </div>
            
            <div className="space-y-1">
              {overview.recent_telemetry.slice(0, 8).map((t, i) => (
                <div key={i} className="flex items-center gap-6 p-3 rounded-lg hover:bg-white/5 transition-colors group">
                  <span className="font-mono text-[10px] text-muted-foreground w-16">{new Date(t.executed_at).toLocaleTimeString([], { hour12: false })}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs tracking-tight">{t.device_state}</span>
                      <div className="flex-1 opacity-20"><DottedDivider length={30} /></div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                        t.status === 'ack' ? 'border-green-500/30 text-green-500' : 'border-red-500/30 text-red-500'
                      }`}>
                        {t.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{t.latency_ms.toFixed(1)}ms</span>
                </div>
              ))}
              {overview.recent_telemetry.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 opacity-20">
                  <Activity size={48} strokeWidth={1} />
                  <p className="text-[10px] font-mono mt-4 tracking-widest">AWAITING_DATA_STREAM</p>
                </div>
              )}
            </div>
          </NothingCard>
        </div>

        {/* Audit Log */}
        <div className="lg:col-span-4">
          <NothingCard dark style={{ border: '1px solid #222', height: '100%', padding: 24, background: '#050505' }}>
            <div className="flex items-center gap-3 mb-8">
              <Clock size={16} className="text-red-500" />
              <h3 className="text-sm font-black tracking-widest uppercase">Security_Audit</h3>
            </div>
            
            <div className="space-y-6">
              {overview.recent_audit.slice(0, 6).map((a, i) => (
                <div key={i} className="relative pl-4 border-l border-white/10 group">
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-red-500/40 group-hover:bg-red-500 transition-colors" />
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-black text-red-500/80 tracking-tighter uppercase">{a.kind.replace('.', '_')}</span>
                    <span className="text-[8px] font-mono text-muted-foreground">{new Date(a.occurred_at).toLocaleTimeString([], { hour12: false })}</span>
                  </div>
                  <p className="text-[11px] font-mono text-white/60 leading-tight">ACTOR: {a.actor}</p>
                </div>
              ))}
            </div>
          </NothingCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, critical }: { title: string; value: string; icon: React.ReactNode; critical?: boolean }) {
  return (
    <NothingCard dark style={{ border: critical ? '1px solid #ff0000' : '1px solid #222', padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-[10px] font-black tracking-[0.2em] ${critical ? 'text-red-500' : 'text-muted-foreground'}`}>{title}</h3>
        <span className={critical ? 'text-red-500 animate-pulse' : 'text-white/40'}>{icon}</span>
      </div>
      <DotMatrixText color={critical ? "#ff0000" : "#ffffff"} dotSize={critical ? 5 : 4}>{value}</DotMatrixText>
    </NothingCard>
  );
}
