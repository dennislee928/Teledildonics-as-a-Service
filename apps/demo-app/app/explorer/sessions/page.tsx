"use client";

import React, { useState, useEffect } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { Activity, Plus, Database, Cpu } from "lucide-react";

export default function SessionsExplorer() {
  const client = useTaas();
  const [method, setMethod] = useState<"LIST" | "CREATE">("LIST");
  const [createParams, setCreateParams] = useState({
    device_id: "dev_demo",
    rule_set_id: "rule_demo",
    max_intensity: 88,
    max_duration_ms: 12000
  });

  const onExecute = () => {
    if (method === "LIST") {
      return client.getWorkspaceOverview("ws_demo", "cr_demo").then(d => d.sessions);
    } else {
      return client.createSession({
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        ...createParams
      });
    }
  };

  return (
    <ApiExplorer 
      title="Session_Manager" 
      endpoint={method === "LIST" ? "GET /v1/workspaces/{id}/overview" : "POST /v1/sessions"}
      description="Provision and audit remote control sessions. Active sessions are required before any haptic commands can be dispatched."
      onExecute={onExecute}
    >
      <div className="space-y-8">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
          {(["LIST", "CREATE"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-widest transition-all ${
                method === m ? "bg-red-500 text-white shadow-lg" : "text-muted-foreground hover:text-white"
              }`}
            >
              {m}_NODES
            </button>
          ))}
        </div>

        {method === "CREATE" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <InputGroup label="Target_Device_ID">
              <input 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                value={createParams.device_id}
                onChange={(e) => setCreateParams({ ...createParams, device_id: e.target.value })}
              />
            </InputGroup>

            <InputGroup label="Logic_Rule_ID">
              <input 
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                value={createParams.rule_set_id}
                onChange={(e) => setCreateParams({ ...createParams, rule_set_id: e.target.value })}
              />
            </InputGroup>

            <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Intensity_Limit">
                <input 
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                  value={createParams.max_intensity}
                  onChange={(e) => setCreateParams({ ...createParams, max_intensity: parseInt(e.target.value) })}
                />
              </InputGroup>
              <InputGroup label="Session_TTL (ms)">
                <input 
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
                  value={createParams.max_duration_ms}
                  onChange={(e) => setCreateParams({ ...createParams, max_duration_ms: parseInt(e.target.value) })}
                />
              </InputGroup>
            </div>
          </div>
        )}

        {method === "LIST" && (
          <div className="p-6 border border-white/5 rounded-2xl bg-white/[0.02] text-center space-y-4">
             <Database size={24} className="mx-auto text-muted-foreground opacity-20" />
             <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest leading-relaxed">
               Execute the call to fetch the current <br /> session state from the kernel.
             </p>
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
        <Cpu size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
