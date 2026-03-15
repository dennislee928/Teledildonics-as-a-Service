"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { WorkspaceOverview } from "@taas/domain-sdk";
import { 
  Users, 
  Unplug, 
  Zap, 
  Activity, 
  Clock, 
  AlertTriangle 
} from "lucide-react";

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

  if (loading) return <div className="animate-pulse flex space-x-4">Loading Dashboard...</div>;
  if (error) return <div className="text-destructive font-medium">Error: {error}</div>;
  if (!overview) return <div>No data available.</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Workspace Overview</h2>
        <p className="text-muted-foreground">Manage your workspace and monitor real-time activity.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Sessions" 
          value={overview.sessions.length} 
          icon={<Activity className="text-blue-500" size={20} />} 
        />
        <StatCard 
          title="Active Devices" 
          value={overview.devices.filter(d => d.connected).length} 
          icon={<Unplug className="text-green-500" size={20} />} 
        />
        <StatCard 
          title="Active Rules" 
          value={overview.rulesets.filter(r => r.enabled).length} 
          icon={<Zap className="text-yellow-500" size={20} />} 
        />
        <StatCard 
          title="Panic Stops" 
          value={overview.metrics.panic_stops} 
          icon={<AlertTriangle className="text-destructive" size={20} />} 
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Telemetry */}
        <div className="col-span-4 border rounded-xl p-6 bg-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Activity size={18} /> Recent Telemetry
          </h3>
          <div className="space-y-4">
            {overview.recent_telemetry.slice(0, 5).map((t, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <div className="flex flex-col">
                  <span className="font-medium">{t.device_state}</span>
                  <span className="text-xs text-muted-foreground">{new Date(t.executed_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                    t.status === 'ack' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-yellow-700'
                  }`}>
                    {t.status}
                  </span>
                  <span className="text-xs font-mono">{t.latency_ms.toFixed(1)}ms</span>
                </div>
              </div>
            ))}
            {overview.recent_telemetry.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm italic">
                No telemetry recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="col-span-3 border rounded-xl p-6 bg-card">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Clock size={18} /> Audit Log
          </h3>
          <div className="space-y-4">
            {overview.recent_audit.slice(0, 5).map((a, i) => (
              <div key={i} className="flex flex-col gap-1 text-sm border-b pb-2 last:border-0">
                <div className="flex justify-between">
                  <span className="font-medium text-xs uppercase text-accent">{a.kind}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(a.occurred_at).toLocaleTimeString()}</span>
                </div>
                <span className="text-xs opacity-80">Actor: {a.actor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-6 bg-card shadow-sm">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
