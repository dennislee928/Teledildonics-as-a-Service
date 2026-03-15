"use client";

import React, { useState, useEffect } from "react";
import { useTaas } from "@/components/TaasProvider";
import { TelemetryEvent } from "@taas/domain-sdk";
import { Radio, Activity, Terminal as TerminalIcon, Shield } from "lucide-react";
import { TerminalBlink } from "@dennislee928/nothingx-react-components";

export default function TelemetryExplorer() {
  const client = useTaas();
  const [sessionId, setSessionId] = useState("session_demo");
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isConnected) return;

    const cancel = client.subscribeSession(sessionId, (event) => {
      setTelemetry(prev => [event, ...prev].slice(0, 50));
    });

    return () => {
      cancel();
    };
  }, [client, isConnected, sessionId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-red-500/80">
          <Radio size={12} className="animate-pulse" />
          <span className="text-[10px] font-medium tracking-wide">GET /v1/sessions/{"{id}"}/stream</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Kernel stream</h2>
        <p className="text-sm text-white/50 max-w-xl">
          Real-time Server-Sent Events (SSE) connection to monitor execution latency and hardware state.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-medium text-white/50">
                <Shield size={10} /> Connection
              </label>
              <input
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-red-500/40 transition-colors"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="session_id"
              />
            </div>

            <button
              onClick={() => setIsConnected(!isConnected)}
              className={`w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                isConnected
                  ? "bg-transparent border border-red-500/40 text-red-500 hover:bg-red-500/10"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {isConnected ? "Terminate stream" : "Establish socket"}
            </button>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-white/50">
                <span>Signal</span>
                <span className={isConnected ? "text-emerald-500" : "text-red-500/80"}>
                  {isConnected ? "Nominal" : "Offline"}
                </span>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${isConnected ? "bg-red-500/60" : "bg-white/10"}`}
                    style={{ opacity: 0.3 + i * 0.12 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden min-h-[420px]">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <TerminalIcon size={14} className="text-red-500/80" />
              <span className="text-[10px] font-medium text-white/50">Real-time log</span>
            </div>
            <TerminalBlink />
          </div>

          <div className="flex-1 p-4 font-mono text-[11px] overflow-auto scrollbar-hide space-y-1.5 min-h-[280px]">
            {telemetry.map((t, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 animate-in slide-up duration-200 ${i === 0 ? "text-white" : "text-white/40"}`}
              >
                <span className="shrink-0 text-white/30">
                  [{new Date(t.executed_at).toLocaleTimeString([], { hour12: false })}]
                </span>
                <span className={`shrink-0 font-medium ${t.status === "ack" ? "text-emerald-500" : "text-red-500"}`}>
                  {t.status}
                </span>
                <span className="flex-1 truncate">
                  {t.session_id.slice(0, 8)}… · {t.device_state}
                </span>
                <span className="shrink-0 text-white/40">{t.latency_ms.toFixed(0)} ms</span>
              </div>
            ))}

            {telemetry.length === 0 && (
              <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-white/30">
                <Activity size={40} strokeWidth={1.5} className={isConnected ? "animate-pulse" : ""} />
                <p className="text-[10px] font-medium">
                  {isConnected ? "Awaiting relay frame…" : "System standby"}
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-white/[0.06] flex justify-between items-center text-[9px] text-white/30">
            <div className="flex gap-4">
              <span>SSE</span>
              <span>Buffer 50</span>
            </div>
            <span>{telemetry.length} frames</span>
          </div>
        </div>
      </div>
    </div>
  );
}
