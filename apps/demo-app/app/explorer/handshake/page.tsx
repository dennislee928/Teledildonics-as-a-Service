"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { Shield, Key, Cpu } from "lucide-react";

export default function HandshakePage() {
  const client = useTaas();
  const [params, setParams] = useState({
    device_name: "X-Series Pro",
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
      title="Secure_Handshake" 
      endpoint="POST /v1/device-bridges/pair"
      description="Establish a zero-trust encrypted bridge between a physical device and the TaaS control plane. This negotiates the ephemeral X25519 session key."
      onExecute={onExecute}
    >
      <div className="space-y-4">
        <InputGroup label="Device_Identity">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
            value={params.device_name}
            onChange={(e) => setParams({ ...params, device_name: e.target.value })}
          />
        </InputGroup>

        <InputGroup label="Capability_Profile">
          <select 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 appearance-none"
            value={params.capability}
            onChange={(e) => setParams({ ...params, capability: e.target.value })}
          >
            <option value="vibrate" className="bg-black">VIBRATION_HAPTIC</option>
            <option value="oscillate" className="bg-black">OSCILLATION_ROTARY</option>
            <option value="rotate" className="bg-black">STEREOSCOPIC_ROTATION</option>
          </select>
        </InputGroup>

        <InputGroup label="Intensity_Cap (%)">
          <input 
            type="number"
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
            value={params.max_intensity}
            onChange={(e) => setParams({ ...params, max_intensity: parseInt(e.target.value) })}
          />
        </InputGroup>

        <InputGroup label="Client_Transport_Key (X25519)">
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
        <Shield size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
