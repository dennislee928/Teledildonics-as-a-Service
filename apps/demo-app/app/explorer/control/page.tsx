"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { ZapOff, ShieldAlert, Play } from "lucide-react";

export default function ControlExplorer() {
  const client = useTaas();
  const [method, setMethod] = useState<"ARM" | "STOP">("ARM");
  const [params, setParams] = useState({
    sessionId: "session_demo",
    reason: "OPERATOR_PANIC_STOP",
    bridge_id: "bridge_demo",
    expires_in_ms: 3600000
  });

  const onExecute = () => {
    if (method === "ARM") {
      return client.armSession(params.sessionId, {
        bridge_id: params.bridge_id,
        expires_in_ms: params.expires_in_ms
      });
    } else {
      return client.stopSession(params.sessionId, {
        reason: params.reason
      });
    }
  };

  return (
    <ApiExplorer 
      title="Access_Control" 
      endpoint={method === "ARM" ? "POST /v1/sessions/{id}/arm" : "POST /v1/sessions/{id}/stop"}
      description="Manage the live state of a session. Arming binds a device bridge to a session, while Stopping triggers an immediate global kill-switch."
      onExecute={onExecute}
    >
      <div className="space-y-8">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
          {(["ARM", "STOP"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                method === m ? "bg-red-500 text-white shadow-lg" : "text-muted-foreground hover:text-white"
              }`}
            >
              {m}_COMMAND
            </button>
          ))}
        </div>

        <InputGroup label="Target_Session_ID">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
            value={params.sessionId}
            onChange={(e) => setParams({ ...params, sessionId: e.target.value })}
          />
        </InputGroup>

        {method === "ARM" ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <InputGroup label="Bridge_Hardware_ID">
              <input 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                value={params.bridge_id}
                onChange={(e) => setParams({ ...params, bridge_id: e.target.value })}
              />
            </InputGroup>
            <InputGroup label="Authorization_Lease (ms)">
              <input 
                type="number"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                value={params.expires_in_ms}
                onChange={(e) => setParams({ ...params, expires_in_ms: parseInt(e.target.value) })}
              />
            </InputGroup>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <InputGroup label="Termination_Reason">
              <textarea 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors h-24 resize-none"
                value={params.reason}
                onChange={(e) => setParams({ ...params, reason: e.target.value })}
              />
            </InputGroup>
            <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center gap-3">
               <ShieldAlert size={16} className="text-red-500" />
               <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">
                 Global_Kill_Switch_Warning
               </p>
            </div>
          </div>
        )}
      </div>
    </ApiExplorer>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
