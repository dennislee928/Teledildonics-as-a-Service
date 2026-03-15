"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Lock,
  Radio,
  Shield,
  Unplug,
  Zap,
} from "lucide-react";
import { WorkspaceOverview } from "@taas/domain-sdk";
import { useTaas } from "@/components/TaasProvider";

const ROUTES = [
  {
    href: "/explorer/sessions",
    title: "Session lifecycle",
    copy: "Create, arm, and inspect live sessions with the same IDs used by the control API demo.",
    icon: <Activity size={18} />,
  },
  {
    href: "/explorer/pairing",
    title: "Bridge pairing",
    copy: "Bootstrap a bridge, exchange transport keys, and inspect the server response without fake chrome.",
    icon: <Unplug size={18} />,
  },
  {
    href: "/explorer/rules",
    title: "Rules and pricing",
    copy: "Tune the economic mapping from event amounts into capped haptic commands and cooldown limits.",
    icon: <Zap size={18} />,
  },
  {
    href: "/explorer/telemetry",
    title: "Telemetry stream",
    copy: "Watch the live SSE flow and confirm latency, device state, and stop conditions in one place.",
    icon: <Radio size={18} />,
  },
];

export default function Home() {
  const client = useTaas();
  const [overview, setOverview] = useState<WorkspaceOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .getWorkspaceOverview("ws_demo", "cr_demo")
      .then(setOverview)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [client]);

  const armedSessions = overview?.sessions.filter((session) => session.status === "armed").length ?? 0;
  const lastTelemetry = overview?.recent_telemetry[0];

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
          <div className="space-y-6">
            <div className="eyebrow">
              <Shield size={12} />
              Demo workspace online
            </div>

            <div className="space-y-4">
              <h1 className="page-title max-w-4xl">A cleaner cockpit for the TaaS control plane.</h1>
              <p className="page-copy max-w-2xl">
                The demo app now behaves like an operational console instead of a novelty terminal skin.
                Use it to inspect the live workspace, run API calls, and monitor the real transport surface.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/explorer/sessions" className="btn-primary no-underline">
                Open session explorer
                <ArrowRight size={16} />
              </Link>
              <Link href="/explorer/telemetry" className="btn-secondary no-underline">
                Watch telemetry
              </Link>
            </div>
          </div>

          <div className="surface-muted flex flex-col gap-4 !rounded-[24px]">
            <div>
              <p className="metric-label">Workspace identity</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text)]">ws_demo</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Creator `cr_demo`, seeded for local development.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <StatusRow label="Region" value={overview?.workspace.region ?? "global-dev"} />
              <StatusRow label="Latest telemetry" value={lastTelemetry?.status ?? "none"} />
              <StatusRow label="Last device state" value={lastTelemetry?.device_state ?? "idle"} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Devices" value={loading ? "…" : String(overview?.devices.length ?? 0)} />
        <StatCard label="Sessions" value={loading ? "…" : String(overview?.sessions.length ?? 0)} />
        <StatCard label="Armed sessions" value={loading ? "…" : String(armedSessions)} />
        <StatCard
          label="P95 latency"
          value={loading ? "…" : `${overview?.metrics.ack_p95_ms?.toFixed(1) ?? "0.0"} ms`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="surface">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="metric-label">Focused routes</p>
              <h2 className="mt-2 text-3xl text-[var(--text)]">Explore the demo without digging through ugly forms.</h2>
            </div>
            <div className="status-pill">
              <Lock size={13} className="text-[var(--accent)]" />
              Signed commands
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {ROUTES.map((route) => (
              <Link key={route.href} href={route.href} className="metric-tile no-underline">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    {route.icon}
                  </div>
                  <ArrowRight size={18} className="text-[var(--text-soft)]" />
                </div>
                <h3 className="mt-5 text-2xl text-[var(--text)]">{route.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{route.copy}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="surface space-y-5">
          <div>
            <p className="metric-label">Runtime posture</p>
            <h2 className="mt-2 text-3xl text-[var(--text)]">Live workspace summary</h2>
          </div>

          <div className="space-y-3">
            <StatusBlock
              icon={<BarChart3 size={16} />}
              title="Rule rejections"
              value={loading ? "…" : String(overview?.metrics.rule_rejections ?? 0)}
              copy="Requests blocked by cooldowns, rate limits, or invalid state."
            />
            <StatusBlock
              icon={<Shield size={16} />}
              title="Panic stops"
              value={loading ? "…" : String(overview?.metrics.panic_stops ?? 0)}
              copy="Emergency stop requests received by the control plane."
            />
            <StatusBlock
              icon={<Radio size={16} />}
              title="Recent ACKs"
              value={loading ? "…" : String(overview?.metrics.ack_count ?? 0)}
              copy="Observed acknowledgements flowing back from the device runtime."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[var(--border)] bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-[var(--text-soft)]">{label}</span>
      <span className="mono-copy text-sm text-[var(--text)]">{value}</span>
    </div>
  );
}

function StatusBlock({
  icon,
  title,
  value,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  copy: string;
}) {
  return (
    <div className="surface-muted !rounded-[22px] !p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent)]">
            {icon}
          </div>
          <div>
            <p className="font-semibold text-[var(--text)]">{title}</p>
            <p className="text-sm text-[var(--text-muted)]">{copy}</p>
          </div>
        </div>
        <span className="mono-copy text-xl text-[var(--text)]">{value}</span>
      </div>
    </div>
  );
}
