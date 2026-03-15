"use client";

import React, { useState, useEffect } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { signInboundEvent, Session } from "@taas/domain-sdk";
import { Zap, Terminal as TerminalIcon, DollarSign } from "lucide-react";
import { SegmentedDisplay } from "@dennislee928/nothingx-react-components";

export default function SimulationExplorer() {
  const client = useTaas();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [params, setParams] = useState({
    sessionId: "session_demo",
    amount: "05.00"
  });

  useEffect(() => {
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(d => setSessions(d.sessions.filter(s => s.status === 'armed')))
      .catch(console.error);
  }, [client]);

  const onExecute = async () => {
    const event = await signInboundEvent({
      event_type: "tip.received",
      workspace_id: "ws_demo",
      creator_id: "cr_demo",
      source_id: params.sessionId,
      amount: parseFloat(params.amount),
      currency: "USD",
      occurred_at: new Date().toISOString(),
      idempotency_key: `sim-${Date.now()}`,
      metadata: { explorer: true }
    });

    return client.handleInboundEvent(event);
  };

  return (
    <ApiExplorer 
      title="Event_Simulator" 
      endpoint="POST /v1/inbound-events"
      description="Mock high-level business events (Tips, Subs, Cheers). The system evaluates these against RuleSets to emit low-level haptic commands."
      onExecute={onExecute}
    >
      <div className="space-y-8">
        <InputGroup label="Target_Session_Node">
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 appearance-none"
            value={params.sessionId}
            onChange={(e) => setParams({ ...params, sessionId: e.target.value })}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id} className="bg-black">{s.id} ({s.deviceId})</option>
            ))}
            {sessions.length === 0 && <option disabled className="bg-black">NO_ARMED_SESSIONS</option>}
          </select>
        </InputGroup>

        <div className="space-y-4">
          <InputGroup label="Tip_Value_Input">
            <div className="flex justify-center py-6 bg-red-500/5 border border-red-500/10 rounded-2xl mb-4">
               <SegmentedDisplay value={params.amount.split('.')[0]} color="#ff0000" size={48} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["01.00", "05.00", "10.00", "50.00"].map(val => (
                <button
                  key={val}
                  onClick={() => setParams({ ...params, amount: val })}
                  className={`py-2 rounded-lg text-[10px] font-black border transition-all ${
                    params.amount === val ? "bg-white text-black border-white" : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  ${parseFloat(val)}
                </button>
              ))}
            </div>
          </InputGroup>
        </div>

        <div className="p-4 border border-white/5 rounded-xl bg-white/[0.02] flex items-start gap-3">
           <TerminalIcon size={14} className="text-red-500 shrink-0 mt-0.5" />
           <p className="text-[9px] font-mono text-muted-foreground uppercase leading-relaxed">
             Security Note: All simulated events are signed with the DEV_PRIVATE_KEY before ingestion.
           </p>
        </div>
      </div>
    </ApiExplorer>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Zap size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
