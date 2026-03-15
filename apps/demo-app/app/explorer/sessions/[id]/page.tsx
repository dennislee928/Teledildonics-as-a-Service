"use client";

import { useEffect, useState, use } from "react";
import { useTaas } from "@/components/TaasProvider";
import { TelemetryEvent } from "@taas/domain-sdk";
import Link from "next/link";
import { ChevronLeft, Activity, Info, BarChart, Radio, Cpu, Zap } from "lucide-react";
import { 
  NothingCard, 
  DotMatrixText, 
  DottedDivider,
  PillBadge,
  TerminalBlink,
  GlitchText,
  ProgressDots
} from "@dennislee928/nothingx-react-components";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = useTaas();
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [activeTelemetry, setActiveTelemetry] = useState<TelemetryEvent | null>(null);

  useEffect(() => {
    const cancel = client.subscribeSession(id, (event) => {
      setTelemetry(prev => [event, ...prev].slice(0, 50));
      setActiveTelemetry(event);
      setTimeout(() => setActiveTelemetry(null), 1000);
    });
    return () => cancel();
  }, [client, id]);

  return (
    <div className="space-y-10 animate-in fade-in duration-1000">
      <div className="flex items-center gap-6">
        <Link href="/sessions" className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all group">
          <ChevronLeft size={24} className="group-hover:text-red-500 transition-colors" />
        </Link>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Live_Node_Monitor</span>
            <TerminalBlink />
          </div>
          <h2 className="text-4xl font-black tracking-tighter uppercase">{id}</h2>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Real-time Indicator */}
        <div className="lg:col-span-7">
          <NothingCard dark style={{ border: '1px solid #222', padding: 60, background: '#050505', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div className="relative mb-12">
              <div className={`w-56 h-56 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                activeTelemetry ? 'border-red-500 bg-red-500/5 scale-105' : 'border-white/5 bg-transparent'
              }`}>
                <Activity size={80} className={activeTelemetry ? 'text-red-500 animate-pulse' : 'text-white/10'} />
              </div>
              
              {/* Outer orbit dots */}
              <div className="absolute inset-[-20px] border border-white/5 rounded-full animate-[spin_20s_linear_infinite]" />
              <div className="absolute inset-[-40px] border border-white/5 border-dashed rounded-full animate-[spin_30s_linear_infinite_reverse]" />
            </div>

            <div className="text-center space-y-4">
              <div className="h-12 flex items-center justify-center">
                {activeTelemetry ? (
                  <div className="text-3xl">
                    <GlitchText active>{activeTelemetry.device_state.toUpperCase()}</GlitchText>
                  </div>
                ) : (
                  <h3 className="text-3xl font-black opacity-20 tracking-widest uppercase">NODE_IDLE</h3>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-4">
                <ProgressDots count={12} value={activeTelemetry ? Math.floor(Math.random() * 100) : 0} color="#ff0000" />
                <p className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground uppercase">
                  {activeTelemetry ? 'Signal_Execution_v4' : 'Awaiting_Relay_Command'}
                </p>
              </div>
            </div>
            
            {activeTelemetry && (
              <div className="grid grid-cols-2 gap-12 pt-12 w-full max-w-sm">
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">RELAY_ACK</p>
                  <p className="text-2xl font-mono text-white font-black">{activeTelemetry.status.toUpperCase()}</p>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">LATENCY_MS</p>
                  <p className="text-2xl font-mono text-white font-black">{activeTelemetry.latency_ms.toFixed(1)}</p>
                </div>
              </div>
            )}
          </NothingCard>
        </div>

        {/* Live Stream */}
        <div className="lg:col-span-5">
          <NothingCard dark style={{ border: '1px solid #222', background: '#0a0a0a', height: '100%', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <h3 className="text-xs font-black tracking-widest flex items-center gap-3">
                <Radio size={16} className="text-red-500" /> KERNEL_STREAM
              </h3>
              <PillBadge variant="neutral">SSE_LAYER_7</PillBadge>
            </div>
            
            <div className="flex-1 overflow-auto p-6 font-mono text-[10px] space-y-2 scrollbar-hide">
              {telemetry.map((t, i) => (
                <div key={i} className={`group flex gap-4 px-4 py-2 rounded-xl transition-all ${i === 0 ? 'bg-red-500/10 border border-red-500/20 translate-x-1' : 'hover:bg-white/5 border border-transparent opacity-60'}`}>
                  <span className="text-muted-foreground font-bold whitespace-nowrap">{new Date(t.executed_at).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 })}</span>
                  <span className={`font-black uppercase w-12 ${t.status === 'ack' ? 'text-green-500' : 'text-red-500'}`}>{t.status}</span>
                  <span className="flex-1 text-white/80 tracking-tighter">EXEC: {t.device_state}</span>
                  <span className="text-[9px] font-black text-red-500 opacity-40">{t.latency_ms.toFixed(0)}MS</span>
                </div>
              ))}
              {telemetry.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <Activity size={32} className="mb-4" />
                  <p className="uppercase tracking-[0.3em]">Awaiting_Socket_Data</p>
                </div>
              )}
            </div>

            <div className="p-6 bg-black border-t border-white/5">
               <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span>SSE_ACTIVE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span>HEARTBEAT_OK</span>
                  </div>
               </div>
            </div>
          </NothingCard>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <FeatureInfo icon={<Cpu size={18} />} title="Edge_Enforcement" desc="Command validation occurs locally at the companion node with zero-latency safety checks." />
        <FeatureInfo icon={<Zap size={18} />} title="Atomic_Sync" desc="Synchronized haptic patterns across multiple devices with sub-10ms jitter compensation." />
        <FeatureInfo icon={<BarChart size={18} />} title="Telemetry_Insights" desc="Real-time performance metrics and error-rate monitoring for all active sessions." />
      </div>
    </div>
  );
}

function FeatureInfo({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-[24px] bg-white/2 border border-white/5 hover:border-red-500/20 transition-all group">
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-4 text-muted-foreground group-hover:text-red-500 transition-colors">
        {icon}
      </div>
      <h4 className="font-black text-xs tracking-widest uppercase mb-2">{title}</h4>
      <p className="text-[10px] font-mono leading-relaxed text-muted-foreground uppercase tracking-tighter opacity-60">{desc}</p>
    </div>
  );
}
