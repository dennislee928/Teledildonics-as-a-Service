"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { RuleSet } from "@taas/domain-sdk";
import { Zap, Plus, Settings } from "lucide-react";

export default function RulesPage() {
  const client = useTaas();
  const [rulesets, setRulesets] = useState<RuleSet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = () => {
    setLoading(true);
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(data => setRulesets(data.rulesets))
      .finally(() => setLoading(false));
  };

  useEffect(fetchRules, [client]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">RuleSets</h2>
          <p className="text-muted-foreground">Define how inbound events translate to device intensity.</p>
        </div>
        <button className="bg-accent text-accent-foreground px-4 py-2 rounded-md hover:bg-accent/90 transition-colors flex items-center gap-2 text-sm font-bold">
          <Plus size={18} /> New RuleSet
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {rulesets.map(rule => (
          <div key={rule.id} className="border rounded-xl p-6 bg-card shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  rule.enabled ? 'bg-yellow-100 text-yellow-600' : 'bg-muted text-muted-foreground'
                }`}>
                  <Zap size={18} />
                </div>
                <h3 className="font-bold">{rule.id}</h3>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                rule.enabled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-yellow-700'
              }`}>
                {rule.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Configuration</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/30 p-2 rounded border border-muted/50">
                  <span className="text-muted-foreground block">Step Amount</span>
                  <span className="font-bold">${(rule.amountStepCents / 100).toFixed(2)}</span>
                </div>
                <div className="bg-muted/30 p-2 rounded border border-muted/50">
                  <span className="text-muted-foreground block">Intensity Inc.</span>
                  <span className="font-bold">{rule.intensityStep}%</span>
                </div>
                <div className="bg-muted/30 p-2 rounded border border-muted/50">
                  <span className="text-muted-foreground block">Max Intensity</span>
                  <span className="font-bold">{rule.maxIntensity}%</span>
                </div>
                <div className="bg-muted/30 p-2 rounded border border-muted/50">
                  <span className="text-muted-foreground block">Duration Inc.</span>
                  <span className="font-bold">{rule.durationPerStepMs}ms</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t mt-4">
              <button className="flex-1 py-1.5 border rounded text-xs hover:bg-muted transition-colors flex items-center justify-center gap-1.5">
                <Settings size={14} /> Configure
              </button>
              <button className={`flex-1 py-1.5 rounded text-xs font-bold transition-colors ${
                rule.enabled ? 'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20' : 'bg-green-600 text-white hover:bg-green-700'
              }`}>
                {rule.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        ))}
        {rulesets.length === 0 && !loading && (
          <div className="col-span-2 text-center py-20 border-2 border-dashed rounded-xl text-muted-foreground">
            No RuleSets found.
          </div>
        )}
      </div>
    </div>
  );
}
