"use client";

import { useEffect, useState, use } from "react";
import { useTaas } from "@/components/TaasProvider";
import { TelemetryEvent } from "@taas/domain-sdk";
import Link from "next/link";
import { ChevronLeft, Activity, Info, BarChart } from "lucide-react";

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
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/sessions" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Session Monitoring</h2>
          <p className="text-muted-foreground">Session ID: <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">{id}</code></p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Real-time Indicator */}
        <div className="border rounded-xl p-8 bg-card shadow-sm flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
          <div className={`w-40 h-40 rounded-full border-4 flex items-center justify-center transition-all duration-200 ${
            activeTelemetry ? 'border-accent bg-accent/5 scale-110' : 'border-muted bg-muted/20'
          }`}>
            <Activity size={60} className={activeTelemetry ? 'text-accent animate-pulse' : 'text-muted-foreground opacity-30'} />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-2xl uppercase tracking-tighter">
              {activeTelemetry?.device_state || 'IDLE'}
            </h3>
            <p className="text-muted-foreground text-sm flex items-center gap-2 justify-center">
              <span className={`w-2 h-2 rounded-full ${activeTelemetry ? 'bg-green-500 animate-ping' : 'bg-muted'}`} />
              {activeTelemetry ? 'Command Executing' : 'Monitoring for activity...'}
            </p>
          </div>
          
          {activeTelemetry && (
            <div className="grid grid-cols-2 gap-8 pt-4 w-full px-12">
              <div className="text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                <p className="text-lg font-mono text-green-600">{activeTelemetry.status}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Latency</p>
                <p className="text-lg font-mono">{activeTelemetry.latency_ms.toFixed(1)}ms</p>
              </div>
            </div>
          )}
        </div>

        {/* Live Stream */}
        <div className="border rounded-xl bg-card overflow-hidden flex flex-col h-[400px]">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/10">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <BarChart size={16} /> Telemetry Stream
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Real-time SSE</span>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-[10px] space-y-1">
            {telemetry.map((t, i) => (
              <div key={i} className={`flex gap-3 px-2 py-1 rounded transition-colors ${i === 0 ? 'bg-accent/10 border-l-2 border-accent' : ''}`}>
                <span className="text-muted-foreground">{new Date(t.executed_at).toLocaleTimeString()}</span>
                <span className={`font-bold uppercase ${t.status === 'ack' ? 'text-green-600' : 'text-accent'}`}>{t.status}</span>
                <span className="flex-1 text-muted-foreground">STATE: {t.device_state}</span>
                <span className="text-muted-foreground opacity-50">{t.latency_ms.toFixed(0)}ms</span>
              </div>
            ))}
            {telemetry.length === 0 && (
              <div className="h-full flex items-center justify-center text-muted-foreground italic">
                Waiting for incoming telemetry...
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-6 bg-accent/5 border-accent/10 flex items-start gap-4">
        <Info className="text-accent mt-0.5" size={20} />
        <div className="text-sm text-muted-foreground space-y-2">
          <p className="font-bold text-foreground">Understanding Telemetry</p>
          <p>
            This view uses standard <strong>Server-Sent Events (SSE)</strong> provided by the Control Plane. 
            Telemetry is emitted directly by the Companion App and routed through the Relay to your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
