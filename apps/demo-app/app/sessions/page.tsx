"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Session, Device, RuleSet } from "@taas/domain-sdk";
import Link from "next/link";
import { Plus, Activity, Play, StopCircle } from "lucide-react";

export default function SessionsPage() {
  const client = useTaas();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rulesets, setRulesets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = () => {
    setLoading(true);
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(data => {
        setSessions(data.sessions);
        setDevices(data.devices);
        setRulesets(data.rulesets);
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchAll, [client]);

  const handleCreateSession = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    try {
      await client.createSession({
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        device_id: formData.get("deviceId") as string,
        rule_set_id: formData.get("ruleSetId") as string,
        max_intensity: parseInt(formData.get("maxIntensity") as string),
        max_duration_ms: parseInt(formData.get("maxDurationMs") as string),
      });
      fetchAll();
    } catch (err: any) {
      alert("Failed to create session: " + err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Sessions</h2>
          <p className="text-muted-foreground">Manage and monitor remote control sessions.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Create Session Form */}
        <div className="lg:col-span-1 border rounded-xl p-6 bg-card h-fit sticky top-24">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Plus size={18} /> New Session
          </h3>
          <form className="space-y-4" onSubmit={handleCreateSession}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Device</label>
              <select name="deviceId" className="w-full border rounded-md p-2 bg-background" required>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.connected ? '✅' : '❌'}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">RuleSet</label>
              <select name="ruleSetId" className="w-full border rounded-md p-2 bg-background" required>
                {rulesets.map(r => (
                  <option key={r.id} value={r.id}>Rule: {r.id} ({r.enabled ? 'On' : 'Off'})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Intensity</label>
                <input name="maxIntensity" type="number" defaultValue="88" className="w-full border rounded-md p-2 bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Duration (ms)</label>
                <input name="maxDurationMs" type="number" defaultValue="12000" className="w-full border rounded-md p-2 bg-background" />
              </div>
            </div>
            <button type="submit" className="w-full bg-accent text-accent-foreground py-2 rounded-md hover:bg-accent/90 transition-colors">
              Create Session
            </button>
          </form>
        </div>

        {/* Sessions List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-center py-12">Loading sessions...</div>
          ) : sessions.map(session => (
            <div key={session.id} className="border rounded-xl p-6 bg-card flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  session.status === 'armed' ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                }`}>
                  <Activity size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg">{session.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                      session.status === 'armed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-yellow-700'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Device: {session.device_id} • Rule: {session.rule_set_id}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link 
                  href={`/sessions/${session.id}`}
                  className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                  title="View Details"
                >
                  <Activity size={20} />
                </Link>
                {session.status === 'armed' ? (
                  <button 
                    onClick={() => client.stopSession(session.id, { reason: "manual stop" }).then(fetchAll)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                    title="Stop Session"
                  >
                    <StopCircle size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={() => client.armSession(session.id, { bridge_id: "bridge_demo", expires_in_ms: 3600000 }).then(fetchAll)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    title="Arm Session"
                  >
                    <Play size={20} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {sessions.length === 0 && !loading && (
            <div className="text-center py-12 border-2 border-dashed rounded-xl text-muted-foreground">
              No sessions found. Create one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
