"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { Zap, Sliders, Hash } from "lucide-react";

export default function RulesExplorer() {
  const client = useTaas();
  const [params, setParams] = useState({
    amount_step_cents: 100,
    intensity_step: 10,
    max_intensity: 100,
    duration_per_step_ms: 1000,
    max_duration_ms: 5000,
    cooldown_ms: 500,
    rate_limit_per_minute: 12,
    pattern_id: "pulse-v1",
    enabled: true
  });

  const onExecute = () => {
    return client.createRuleSet({
      workspace_id: "ws_demo",
      creator_id: "cr_demo",
      ...params
    });
  };

  return (
    <ApiExplorer 
      title="Logic_Architect" 
      endpoint="POST /v1/rulesets"
      description="Define the mathematical mapping between incoming currency and physical haptic response. Rulesets enforce safety limits and cost-per-intensity logic."
      onExecute={onExecute}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Credit_Step (cents)">
            <input 
              type="number"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
              value={params.amount_step_cents}
              onChange={(e) => setParams({ ...params, amount_step_cents: parseInt(e.target.value) })}
            />
          </InputGroup>
          <InputGroup label="Intensity_Step (%)">
            <input 
              type="number"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
              value={params.intensity_step}
              onChange={(e) => setParams({ ...params, intensity_step: parseInt(e.target.value) })}
            />
          </InputGroup>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputGroup label="Duration_Step (ms)">
            <input 
              type="number"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
              value={params.duration_per_step_ms}
              onChange={(e) => setParams({ ...params, duration_per_step_ms: parseInt(e.target.value) })}
            />
          </InputGroup>
          <InputGroup label="Rate_Limit (rpm)">
            <input 
              type="number"
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors"
              value={params.rate_limit_per_minute}
              onChange={(e) => setParams({ ...params, rate_limit_per_minute: parseInt(e.target.value) })}
            />
          </InputGroup>
        </div>

        <InputGroup label="Haptic_Pattern_ID">
          <input 
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs font-mono outline-none focus:border-red-500/50 transition-colors uppercase tracking-widest"
            value={params.pattern_id}
            onChange={(e) => setParams({ ...params, pattern_id: e.target.value })}
          />
        </InputGroup>

        <div className="flex items-center gap-4 p-4 border border-white/5 rounded-xl bg-white/[0.02]">
           <input 
             type="checkbox" 
             id="enabled"
             className="w-4 h-4 accent-red-500" 
             checked={params.enabled}
             onChange={(e) => setParams({ ...params, enabled: e.target.checked })}
           />
           <label htmlFor="enabled" className="text-[10px] font-black tracking-widest text-muted-foreground uppercase cursor-pointer">
             Activate_Rule_Immediately
           </label>
        </div>
      </div>
    </ApiExplorer>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sliders size={10} className="text-red-500/50" />
        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      </div>
      {children}
    </div>
  );
}
