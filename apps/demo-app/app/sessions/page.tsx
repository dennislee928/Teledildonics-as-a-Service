"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Session, Device, RuleSet } from "@taas/domain-sdk";
import Link from "next/link";
import { Plus, Activity, Play, StopCircle, ArrowRight } from "lucide-react";
import { 
  NothingCard, 
  NothingButton, 
  DotMatrixText, 
  DottedDivider,
  PillBadge
} from "@dennislee928/nothingx-react-components";

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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <div className="flex items-center gap-3 mb-2 opacity-50">
          <Activity size={16} />
          <span className="text-[10px] font-mono tracking-widest uppercase">Traffic_Control</span>
        </div>
        <h2 className="text-5xl font-black tracking-tighter">SESSIONS</h2>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        {/* Create Session Form */}
        <div className="lg:col-span-4 h-fit sticky top-24">
          <NothingCard dark style={{ border: '1px solid #333', padding: 32, background: '#050505' }}>
            <h3 className="text-sm font-black tracking-[0.2em] mb-8 flex items-center gap-3">
              <Plus size={16} className="text-red-500" /> PROVISION_NODE
            </h3>
            
            <form className="space-y-6" onSubmit={handleCreateSession}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Target_Device</label>
                <select name="deviceId" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-mono appearance-none focus:border-red-500/50 outline-none transition-colors" required>
                  {devices.map(d => (
                    <option key={d.id} value={d.id} className="bg-black">{d.name} {d.connected ? ' (LIVE)' : ' (OFFLINE)'}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Logic_RuleSet</label>
                <select name="ruleSetId" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-mono appearance-none focus:border-red-500/50 outline-none transition-colors" required>
                  {rulesets.map(r => (
                    <option key={r.id} value={r.id} className="bg-black">{r.id} {r.enabled ? ' (ENABLED)' : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Max_Intensity</label>
                  <input name="maxIntensity" type="number" defaultValue="88" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-mono focus:border-red-500/50 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">TTL (ms)</label>
                  <input name="maxDurationMs" type="number" defaultValue="12000" className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm font-mono focus:border-red-500/50 outline-none" />
                </div>
              </div>

              <div className="pt-4">
                <NothingButton onClick={() => {}} variant="primary">
                  EXECUTE_PROVISION
                </NothingButton>
              </div>
            </form>
          </NothingCard>
        </div>

        {/* Sessions List */}
        <div className="lg:col-span-8 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-20">
               <DotMatrixText color="#888" dotSize={2}>FETCHING_RECORDS</DotMatrixText>
            </div>
          ) : sessions.map(session => (
            <NothingCard key={session.id} dark style={{ border: '1px solid #222', padding: '24px 32px' }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                    session.status === 'armed' ? 'border-red-500 bg-red-500/10 text-red-500 animate-pulse' : 'border-white/10 text-white/20'
                  }`}>
                    <Activity size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-black text-xl tracking-tighter uppercase">{session.id}</span>
                      <PillBadge color={session.status === 'armed' ? '#ff0000' : '#333'}>
                        {session.status.toUpperCase()}
                      </PillBadge>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      NODE: {session.deviceId} // LOGIC: {session.ruleSetId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link 
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black tracking-widest hover:bg-white/10 transition-colors uppercase"
                  >
                    Monitor <ArrowRight size={14} className="text-red-500" />
                  </Link>
                  
                  {session.status === 'armed' ? (
                    <button 
                      onClick={() => client.stopSession(session.id, { reason: "manual stop" }).then(fetchAll)}
                      className="p-3 text-red-500 hover:bg-red-500/10 rounded-full transition-colors border border-red-500/20"
                      title="TERMINATE_SESSION"
                    >
                      <StopCircle size={20} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => client.armSession(session.id, { bridge_id: "bridge_demo", expires_in_ms: 3600000 }).then(fetchAll)}
                      className="p-3 text-green-500 hover:bg-green-500/10 rounded-full transition-colors border border-green-500/20"
                      title="ARM_NODE"
                    >
                      <Play size={20} />
                    </button>
                  )}
                </div>
              </div>
              <DottedDivider style={{ marginTop: 20, opacity: 0.1 }} />
            </NothingCard>
          ))}
          
          {sessions.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-32 border-2 border-dashed border-white/5 rounded-[32px] opacity-30 text-center">
              <Activity size={48} strokeWidth={1} className="mb-4" />
              <p className="text-xs font-mono tracking-[0.3em] uppercase">No_Active_Nodes_Detected</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
