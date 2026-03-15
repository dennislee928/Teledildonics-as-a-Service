"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Activity, ArrowLeft, Radio, Shield, Zap } from "lucide-react";
import { TelemetryEvent } from "@taas/domain-sdk";
import { useTaas } from "@/components/TaasProvider";

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = useTaas();
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);

  useEffect(() => {
    const cancel = client.subscribeSession(id, (event) => {
      setTelemetry((previous) => [event, ...previous].slice(0, 30));
    });
    return () => cancel();
  }, [client, id]);

  const active = telemetry[0];

  return (
    <div className="space-y-6">
      <section className="surface">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <Link href="/explorer/sessions" className="btn-secondary inline-flex no-underline">
              <ArrowLeft size={16} />
              Back to sessions
            </Link>
            <div className="space-y-2">
              <div className="eyebrow">
                <Radio size={12} />
                Live session monitor
              </div>
              <h1 className="page-title">{id}</h1>
              <p className="page-copy max-w-3xl">
                This panel subscribes to the live telemetry stream for one session and keeps the latest runtime frames close at hand.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <HeaderStat label="Frames" value={String(telemetry.length)} />
            <HeaderStat label="Latest status" value={active?.status ?? "idle"} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="surface space-y-5">
          <div>
            <p className="metric-label">Current frame</p>
            <h2 className="mt-2 text-3xl text-[var(--text)]">Runtime posture</h2>
          </div>

          <div className="surface-muted flex min-h-[22rem] flex-col items-center justify-center gap-5 !rounded-[26px] text-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent)]">
              <Activity size={42} className={active ? "animate-pulse" : ""} />
            </div>
            <div className="space-y-2">
              <p className="text-3xl text-[var(--text)]">{active?.device_state ?? "Awaiting frames"}</p>
              <p className="text-sm text-[var(--text-muted)]">
                {active ? `Sequence ${active.sequence} · ${active.latency_ms.toFixed(0)} ms` : "No telemetry has arrived for this session yet."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard
              icon={<Shield size={16} />}
              label="Stop reason"
              value={active?.stop_reason ?? "none"}
            />
            <InfoCard
              icon={<Zap size={16} />}
              label="Executed at"
              value={active ? new Date(active.executed_at).toLocaleTimeString() : "—"}
            />
          </div>
        </div>

        <div className="surface-terminal response-frame">
          <div className="response-header">
            <div>
              <p className="metric-label">Frame history</p>
              <p className="text-sm text-[var(--text-muted)]">Latest 30 frames from the session stream</p>
            </div>
            <div className="status-pill mono-copy">session: {id}</div>
          </div>

          <div className="response-body">
            {telemetry.length === 0 ? (
              <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-4 text-center text-[var(--text-soft)]">
                <Activity size={34} className="text-[var(--accent)]" />
                <p className="mono-copy text-sm">Listening for telemetry…</p>
              </div>
            ) : (
              <div className="space-y-3">
                {telemetry.map((entry, index) => (
                  <div
                    key={`${entry.sequence}-${index}`}
                    className={`rounded-[20px] border px-4 py-4 ${
                      index === 0 ? "border-[color:var(--border-strong)] bg-[var(--accent-soft)]" : "bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="status-pill mono-copy">{entry.status}</span>
                          <span className="mono-copy text-xs text-[var(--text-soft)]">seq {entry.sequence}</span>
                        </div>
                        <p className="text-sm text-[var(--text)]">{entry.device_state}</p>
                        <p className="mono-copy text-xs text-[var(--text-soft)]">
                          {new Date(entry.executed_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="mono-copy text-right text-sm text-[var(--text-muted)]">
                        <p>{entry.latency_ms.toFixed(0)} ms</p>
                        {entry.error_code ? <p className="mt-1 text-[var(--accent-strong)]">{entry.error_code}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted !rounded-[20px] !p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg text-[var(--text)]">{value}</p>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="surface-muted !rounded-[20px] !p-4">
      <div className="flex items-center gap-2 text-[var(--accent)]">
        {icon}
        <span className="metric-label">{label}</span>
      </div>
      <p className="mt-3 text-sm text-[var(--text)]">{value}</p>
    </div>
  );
}
