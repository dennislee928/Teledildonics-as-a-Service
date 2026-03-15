"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { WorkspaceOverview } from "@taas/domain-sdk";
import Link from "next/link";
import { 
  Activity, 
  Clock, 
  AlertTriangle,
  Monitor,
  Zap,
  ShieldCheck,
  Radio,
  ArrowRight,
  Shield,
  ZapOff,
  Box,
  Fingerprint
} from "lucide-react";
import { 
  NothingCard, 
  DotMatrixText, 
  PillBadge, 
  DottedDivider,
  TerminalBlink,
  GlitchText,
  NothingButton
} from "@dennislee928/nothingx-react-components";

export default function Home() {
  const client = useTaas();
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [client]);

  return (
    <div className="space-y-24 animate-in fade-in duration-1000">
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-red-500/5 border border-red-500/20 mb-4 animate-bounce">
            <Shield size={14} className="text-red-500" />
            <span className="text-[10px] font-black tracking-[0.3em] text-red-500 uppercase">KERNEL_PROVISION_ACTIVE</span>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none italic">
              <GlitchText active>TAAS_CORE</GlitchText>
            </h1>
            <div className="flex justify-center">
              <DotMatrixText color="#888" dotSize={3}>PROTO_V2.4</DotMatrixText>
            </div>
          </div>

          <p className="max-w-2xl text-lg text-muted-foreground font-mono leading-relaxed uppercase tracking-tighter opacity-60 px-6">
            The world's first industrial-grade telemetry relay for remote haptic synchronization. 
            Zero-latency. Zero-trust. Pure sensation.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-8">
            <Link href="/explorer/sessions">
              <NothingButton onClick={() => {}} variant="primary">
                INITIALIZE_WORKSPACE
              </NothingButton>
            </Link>
            <Link href="/explorer/pairing">
              <button className="px-8 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-xs font-black tracking-[0.2em] uppercase">
                Pair_Device_Bridge
              </button>
            </Link>
          </div>
        </div>

        {/* Decorative background elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-[120px] -z-10" />
      </section>

      {/* Quick Stats Banner */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-1">
        <QuickStat label="Network_Nodes" value={overview?.devices.length.toString() || "00"} />
        <QuickStat label="Relay_Streams" value={overview?.sessions.length.toString() || "00"} />
        <QuickStat label="Uptime_Percent" value="99.99" />
        <QuickStat label="Global_Regions" value="03" />
      </section>

      {/* Main Stats Grid */}
      <section className="space-y-10">
        <div className="flex items-end justify-between border-b border-white/10 pb-6">
          <div>
            <h2 className="text-4xl font-black tracking-tighter">NODE_TELEMETRY</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-2">Live_Kernel_Metrics_Snapshot</p>
          </div>
          <div className="hidden sm:flex gap-2">
             <PillBadge variant="live">Streaming</PillBadge>
             <PillBadge variant="neutral">Secure</PillBadge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <NothingCard dark style={{ border: '1px solid #222', padding: 32 }}>
            <div className="flex items-center gap-4 mb-8 text-red-500">
              <Activity size={24} />
              <h3 className="text-sm font-black tracking-widest uppercase">System_Load</h3>
            </div>
            <div className="space-y-6">
              <MetricRow label="ACK_RATE" value={overview?.metrics.ack_count.toString() || "0"} />
              <MetricRow label="P95_LATENCY" value={`${overview?.metrics.ack_p95_ms.toFixed(1) || "0"}ms`} />
              <MetricRow label="ERROR_LOG" value={overview?.metrics.rule_rejections.toString() || "0"} />
            </div>
          </NothingCard>

          <NothingCard dark style={{ border: '1px solid #222', padding: 32 }}>
            <div className="flex items-center gap-4 mb-8 text-red-500">
              <ShieldCheck size={24} />
              <h3 className="text-sm font-black tracking-widest uppercase">Security_Layer</h3>
            </div>
            <div className="space-y-6">
              <MetricRow label="AUTH_VERSION" value="X25519" />
              <MetricRow label="ENCRYPTION" value="AES_GCM" />
              <MetricRow label="ACTIVE_GRANTS" value={overview?.sessions.filter(s => s.status === 'armed').length.toString() || "0"} />
            </div>
          </NothingCard>

          <NothingCard dark style={{ border: '1px solid #222', padding: 32 }}>
            <div className="flex items-center gap-4 mb-8 text-red-500">
              <Box size={24} />
              <h3 className="text-sm font-black tracking-widest uppercase">Infrastructure</h3>
            </div>
            <div className="space-y-6">
              <MetricRow label="REGION" value={overview?.workspace.region || "US_EAST"} />
              <MetricRow label="PROVIDERS" value="RENDER_API" />
              <MetricRow label="RELAY_TYPE" value="SECURE_SSE" />
            </div>
          </NothingCard>
        </div>
      </section>

      {/* Feature Highlight */}
      <section className="grid lg:grid-cols-2 gap-12 items-center py-20 border-t border-white/5">
        <div className="space-y-8">
          <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10">
            <Fingerprint size={32} className="text-red-500" />
          </div>
          <h2 className="text-5xl font-black tracking-tighter leading-tight italic uppercase">
            Designed for <br /><span className="text-red-500">Extreme</span> Privacy
          </h2>
          <p className="text-muted-foreground font-mono uppercase tracking-tighter opacity-60 leading-relaxed">
            Every command is cryptographically signed by our central authority and sealed using ephemeral session keys. 
            We never see your haptic patterns. We only relay the heartbeat.
          </p>
          <div className="pt-4">
             <Link href="/explorer/handshake" className="text-xs font-black tracking-widest text-red-500 hover:text-white transition-colors flex items-center gap-2 uppercase">
               Explore Security Protocol <ArrowRight size={14} />
             </Link>
          </div>
        </div>
        <div className="relative aspect-square glass-dark rounded-[48px] border border-white/10 flex items-center justify-center overflow-hidden group">
           <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
           <div className="relative text-center animate-float">
              <DotMatrixText color="#ff0000" dotSize={10}>SAFE</DotMatrixText>
              <p className="font-mono text-[10px] mt-4 tracking-[0.5em] text-white/40">ZERO_TRUST_VERIFIED</p>
           </div>
        </div>
      </section>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/5 p-8 bg-white/[0.01] hover:bg-white/[0.03] transition-colors group">
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-2 group-hover:text-red-500/50 transition-colors">{label}</p>
      <p className="text-4xl font-black italic tracking-tighter group-hover:scale-105 transition-transform origin-left">{value}</p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-end border-b border-white/5 pb-2">
      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className="text-xs font-mono font-bold text-white/80">{value}</span>
    </div>
  );
}
