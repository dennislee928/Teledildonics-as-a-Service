"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { WorkspaceOverview } from "@taas/domain-sdk";
import Link from "next/link";
import { Activity, ShieldCheck, Box, ArrowRight, Shield, Fingerprint } from "lucide-react";
import { DotMatrixText, PillBadge, GlitchText, NothingButton } from "@dennislee928/nothingx-react-components";

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
    <div className="space-y-16 sm:space-y-20 animate-in fade-in duration-700">
      {/* Hero Section */}
      <section className="relative pt-8 sm:pt-12 pb-14 overflow-hidden">
        <div className="flex flex-col items-center text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <Shield size={12} className="text-red-500" />
            <span className="text-[10px] font-semibold tracking-wider text-red-500">Kernel provision active</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-none">
              <GlitchText active>TAAS Core</GlitchText>
            </h1>
            <div className="flex justify-center opacity-60">
              <DotMatrixText color="#71717a" dotSize={3}>Proto v2.4</DotMatrixText>
            </div>
          </div>

          <p className="max-w-xl text-sm sm:text-base text-white/60 leading-relaxed px-4">
            Industrial-grade telemetry relay for remote haptic sync. Zero-latency. Zero-trust.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Link href="/explorer/sessions">
              <NothingButton onClick={() => {}} variant="primary">
                Initialize workspace
              </NothingButton>
            </Link>
            <Link href="/explorer/pairing">
              <button className="px-6 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/15 transition-all text-sm font-medium">
                Pair device bridge
              </button>
            </Link>
          </div>
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/[0.04] rounded-full blur-[100px] -z-10" />
      </section>

      {/* Quick Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <QuickStat label="Network nodes" value={overview?.devices.length.toString() ?? "0"} />
        <QuickStat label="Relay streams" value={overview?.sessions.length.toString() ?? "0"} />
        <QuickStat label="Uptime" value="99.99%" />
        <QuickStat label="Regions" value="03" />
      </section>

      {/* Node Telemetry */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Node telemetry</h2>
            <p className="text-xs text-white/40 mt-1">Live kernel metrics snapshot</p>
          </div>
          <div className="flex gap-2">
            <PillBadge variant="live">Streaming</PillBadge>
            <PillBadge variant="neutral">Secure</PillBadge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            icon={<Activity size={20} />}
            title="System load"
            items={[
              { label: "ACK rate", value: overview?.metrics.ack_count.toString() ?? "0" },
              { label: "P95 latency", value: `${overview?.metrics.ack_p95_ms?.toFixed(1) ?? "0"} ms` },
              { label: "Error log", value: overview?.metrics.rule_rejections.toString() ?? "0" },
            ]}
          />
          <MetricCard
            icon={<ShieldCheck size={20} />}
            title="Security layer"
            items={[
              { label: "Auth", value: "X25519" },
              { label: "Encryption", value: "AES-GCM" },
              { label: "Active grants", value: overview?.sessions.filter(s => s.status === "armed").length.toString() ?? "0" },
            ]}
          />
          <MetricCard
            icon={<Box size={20} />}
            title="Infrastructure"
            items={[
              { label: "Region", value: overview?.workspace.region ?? "global-dev" },
              { label: "Providers", value: "Render API" },
              { label: "Relay type", value: "Secure SSE" },
            ]}
          />
        </div>
      </section>

      {/* Privacy highlight */}
      <section className="grid lg:grid-cols-2 gap-10 items-center py-12 sm:py-16 border-t border-white/[0.06]">
        <div className="space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center border border-white/[0.08]">
            <Fingerprint size={28} className="text-red-500" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
            Designed for <span className="text-red-500">extreme</span> privacy
          </h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Every command is cryptographically signed and sealed with ephemeral session keys. We never see your haptic patterns—we only relay the heartbeat.
          </p>
          <Link
            href="/explorer/handshake"
            className="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-400 transition-colors"
          >
            Explore security protocol <ArrowRight size={14} />
          </Link>
        </div>
        <div className="relative aspect-square rounded-2xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
          <div className="relative text-center animate-float">
            <DotMatrixText color="#e11d48" dotSize={8}>SAFE</DotMatrixText>
            <p className="text-[10px] mt-3 tracking-widest text-white/40">Zero trust verified</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-200">
      <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 hover:border-white/[0.08] transition-colors duration-200">
      <div className="flex items-center gap-3 mb-5 text-red-500">
        {icon}
        <h3 className="text-sm font-semibold tracking-wide text-white/90">{title}</h3>
      </div>
      <div className="space-y-4">
        {items.map(({ label, value }) => (
          <div key={label} className="flex justify-between items-baseline gap-4">
            <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-medium text-white/80 tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
