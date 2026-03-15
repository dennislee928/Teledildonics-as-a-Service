"use client";

import React, { useEffect, useState } from "react";
import { Activity, Radio, Shield, Terminal } from "lucide-react";
import { TelemetryEvent } from "@taas/domain-sdk";
import { useTaas } from "@/components/TaasProvider";

export default function TelemetryExplorer() {
  const client = useTaas();
  const [sessionId, setSessionId] = useState("session_demo");
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isConnected) return;

    const cancel = client.subscribeSession(sessionId, (event) => {
      setTelemetry((previous) => [event, ...previous].slice(0, 50));
    });

    return () => cancel();
  }, [client, isConnected, sessionId]);

  return (
    <div className="space-y-6">
      <section className="surface">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="eyebrow">
              <Radio size={12} />
              Live session stream
            </div>
            <div className="space-y-2">
              <h1 className="page-title">Telemetry stream</h1>
              <p className="page-copy max-w-3xl">
                Monitor the server-sent event stream for a single session and watch the runtime feed update in real time.
              </p>
            </div>
          </div>
          <div className="status-pill mono-copy">GET /v1/sessions/{"{id}"}/stream</div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="surface space-y-5">
          <div className="space-y-2">
            <p className="metric-label">Connection target</p>
            <p className="text-sm text-[var(--text-muted)]">Point the stream at any session ID in the demo workspace.</p>
          </div>

          <div className="field-group">
            <label className="field-label">
              <Shield size={14} className="text-[var(--accent)]" />
              Session ID
            </label>
            <input
              className="control-input"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="session_demo"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsConnected((current) => !current)}
            className={isConnected ? "btn-secondary w-full" : "btn-primary w-full"}
          >
            {isConnected ? "Stop stream" : "Start stream"}
          </button>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <StatusTile label="Connection" value={isConnected ? "Connected" : "Idle"} />
            <StatusTile label="Buffered frames" value={String(telemetry.length)} />
            <StatusTile label="Latest status" value={telemetry[0]?.status ?? "none"} />
          </div>
        </div>

        <div className="surface-terminal response-frame">
          <div className="response-header">
            <div>
              <p className="metric-label">Realtime log</p>
              <p className="text-sm text-[var(--text-muted)]">Latest 50 telemetry frames from the relay path</p>
            </div>
            <div className="status-pill">
              <Terminal size={13} className="text-[var(--accent)]" />
              SSE
            </div>
          </div>

          <div className="response-body">
            {telemetry.length === 0 ? (
              <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-4 text-center text-[var(--text-soft)]">
                <Activity size={34} className={isConnected ? "animate-pulse text-[var(--accent)]" : "text-[var(--accent)]"} />
                <p className="mono-copy text-sm">
                  {isConnected ? "Waiting for the next telemetry frame…" : "Start the stream to view live frames."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {telemetry.map((frame, index) => (
                  <div
                    key={`${frame.sequence}-${index}`}
                    className={`rounded-[20px] border px-4 py-4 ${
                      index === 0 ? "border-[color:var(--border-strong)] bg-[var(--accent-soft)]" : "bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="status-pill mono-copy">{frame.status}</span>
                          <span className="mono-copy text-xs text-[var(--text-soft)]">
                            seq {frame.sequence}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text)]">{frame.device_state}</p>
                        <p className="mono-copy text-xs text-[var(--text-soft)]">
                          {new Date(frame.executed_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="mono-copy text-right text-sm text-[var(--text-muted)]">
                        <p>{frame.latency_ms.toFixed(0)} ms</p>
                        {frame.stop_reason ? <p className="mt-1 text-[var(--accent-strong)]">{frame.stop_reason}</p> : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="response-footer text-sm text-[var(--text-soft)]">
            <span className="mono-copy">Buffer 50</span>
            <span className="mono-copy">{isConnected ? "Subscribed" : "Disconnected"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted !rounded-[20px] !p-4">
      <p className="metric-label">{label}</p>
      <p className="mt-2 text-lg text-[var(--text)]">{value}</p>
    </div>
  );
}
