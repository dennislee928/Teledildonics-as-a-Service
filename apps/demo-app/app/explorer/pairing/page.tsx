"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { Unplug, Monitor, Cpu } from "lucide-react";

export default function PairingExplorer() {
  const client = useTaas();
  const [params, setParams] = useState({
    bridge_name: "DESKTOP_NODE_01",
    device_name: "GENERIC_HAPTIC_V1",
    capability: "vibrate",
    max_intensity: 100,
    transport_public_key: "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A="
  });

  const onExecute = () => {
    return client.pairDeviceBridge({
      workspace_id: "ws_demo",
      creator_id: "cr_demo",
      ...params,
      capability: params.capability as any
    });
  };

  return (
    <ApiExplorer 
      title="Hardware_Link" 
      endpoint="POST /v1/device-bridges/pair"
      description="Register a new device bridge and hardware node. This is the first step in onboarding a physical device to the TaaS network."
      onExecute={onExecute}
    >
      <div className="space-y-4">
        <InputGroup label="Bridge_Alias">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
            value={params.bridge_name}
            onChange={(e) => setParams({ ...params, bridge_name: e.target.value })}
          />
        </InputGroup>

        <InputGroup label="Hardware_Label">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
            value={params.device_name}
            onChange={(e) => setParams({ ...params, device_name: e.target.value })}
          />
        </InputGroup>

        <InputGroup label="Protocol_Capability">
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 appearance-none"
            value={params.capability}
            onChange={(e) => setParams({ ...params, capability: e.target.value })}
          >
            <option value="vibrate" className="bg-black">VIBRATE</option>
            <option value="oscillate" className="bg-black">OSCILLATE</option>
            <option value="rotate" className="bg-black">ROTATE</option>
          </select>
        </InputGroup>

        <InputGroup label="Public_Key_Exchange">
          <textarea 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-[10px] font-mono outline-none focus:border-red-500/50 transition-colors h-24 resize-none"
            value={params.transport_public_key}
            onChange={(e) => setParams({ ...params, transport_public_key: e.target.value })}
          />
        </InputGroup>
      </div>
    </ApiExplorer>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Monitor size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
