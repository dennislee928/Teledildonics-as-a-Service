"use client";

import React, { useState, useEffect } from "react";
import { useTaas } from "@/components/TaasProvider";
import { TelemetryEvent } from "@taas/domain-sdk";
import { Radio, Activity, Terminal as TerminalIcon, Shield } from "lucide-react";
import { NothingCard, TerminalBlink, PillBadge, DottedDivider } from "@dennislee928/nothingx-react-components";

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
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 opacity-50 text-red-500">
          <Radio size={14} className="animate-pulse" />
          <span className="text-[10px] font-mono tracking-widest uppercase">STREAMING_API: GET /v1/sessions/{"{id}"}/stream</span>
        </div>
        <h2 className="text-5xl font-black tracking-tighter uppercase">Kernel_Stream</h2>
        <p className="text-sm text-muted-foreground font-mono uppercase tracking-tighter max-w-2xl">
          Establish a real-time Server-Sent Events (SSE) connection to monitor execution latency and hardware state transitions.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <NothingCard dark style={{ border: '1px solid #222', padding: 32, background: '#050505' }}>
            <div className="space-y-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-500/50">
                  <Shield size={10} />
                  <label className="text-[9px] font-black uppercase tracking-widest">Connection_Socket</label>
                </div>
                <input 
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="ENTER_SESSION_ID"
                />
              </div>

              <button 
                onClick={() => setIsConnected(!isConnected)}
                className={`w-full py-4 rounded-xl text-xs font-black tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 ${
                  isConnected 
                    ? "bg-transparent border border-red-500/50 text-red-500 hover:bg-red-500/10" 
                    : "bg-red-500 text-white hover:bg-red-600 shadow-[0_0_30px_rgba(255,0,0,0.1)]"
                }`}
              >
                {isConnected ? "TERMINATE_STREAM" : "ESTABLISH_SOCKET"}
              </button>

              <div className="p-6 border border-white/5 rounded-2xl bg-white/[0.02] space-y-4">
                 <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                    <span>Signal_Strength</span>
                    <span className={isConnected ? "text-green-500" : "text-red-500"}>{isConnected ? "NOMINAL" : "OFFLINE"}</span>
                 </div>
                 <div className="flex gap-1">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${isConnected ? "bg-red-500" : "bg-white/10"}`} style={{ opacity: i * 0.15 }} />
                    ))}
                 </div>
              </div>
            </div>
          </NothingCard>
        </div>

        <div className="lg:col-span-8">
          <NothingCard dark style={{ border: '1px solid #222', padding: 0, background: '#0a0a0a', overflow: 'hidden', height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <TerminalIcon size={14} className="text-red-500" />
                <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Real_Time_Log</span>
              </div>
              <TerminalBlink />
            </div>
            
            <div className="flex-1 p-6 font-mono text-[10px] overflow-auto scrollbar-hide space-y-2">
              {telemetry.map((t, i) => (
                <div key={i} className={`flex items-center gap-4 animate-in slide-in-from-left-2 duration-300 ${i === 0 ? "text-white" : "text-white/40"}`}>
                  <span className="shrink-0 opacity-30">[{new Date(t.executed_at).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 })}]</span>
                  <span className={`shrink-0 font-black uppercase ${t.status === 'ack' ? 'text-green-500' : 'text-red-500'}`}>{t.status}</span>
                  <span className="flex-1 truncate">ID: {t.session_id.substring(0,8)}... // STATE: {t.device_state}</span>
                  <span className="shrink-0 text-red-500/50">{t.latency_ms.toFixed(0)}MS</span>
                </div>
              ))}
              
              {telemetry.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4">
                   <Activity size={48} strokeWidth={1} className={isConnected ? "animate-pulse" : ""} />
                   <p className="text-[10px] font-mono tracking-[0.3em] uppercase">
                     {isConnected ? "AWAITING_RELAY_FRAME" : "SYSTEM_STANDBY"}
                   </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-black border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-white/20 uppercase tracking-[0.2em]">
               <div className="flex gap-4">
                  <span>Transport: SSE/EventSource</span>
                  <span>Buffer: 50_LINES</span>
               </div>
               <span>{telemetry.length} FRAMES_RECV</span>
            </div>
          </NothingCard>
        </div>
      </div>
    </div>
  );
}
