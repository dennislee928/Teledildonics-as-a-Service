"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerField, ExplorerNotice } from "@/components/ApiExplorer";
import { Sliders } from "lucide-react";

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
      title="Rule set designer"
      endpoint="POST /v1/rulesets"
      description="Define the mapping between incoming currency and physical haptic response. These values directly shape control intensity, duration, cooldown, and rate limits."
      onExecute={onExecute}
      actionLabel="Create rule set"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <ExplorerField label="Amount step (cents)" icon={<Sliders size={14} className="text-[var(--accent)]" />}>
            <input
              type="number"
              className="control-input"
              value={params.amount_step_cents}
              onChange={(e) => setParams({ ...params, amount_step_cents: parseInt(e.target.value) })}
            />
          </ExplorerField>
          <ExplorerField label="Intensity step (%)">
            <input
              type="number"
              className="control-input"
              value={params.intensity_step}
              onChange={(e) => setParams({ ...params, intensity_step: parseInt(e.target.value) })}
            />
          </ExplorerField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ExplorerField label="Duration step (ms)">
            <input
              type="number"
              className="control-input"
              value={params.duration_per_step_ms}
              onChange={(e) => setParams({ ...params, duration_per_step_ms: parseInt(e.target.value) })}
            />
          </ExplorerField>
          <ExplorerField label="Rate limit (rpm)">
            <input
              type="number"
              className="control-input"
              value={params.rate_limit_per_minute}
              onChange={(e) => setParams({ ...params, rate_limit_per_minute: parseInt(e.target.value) })}
            />
          </ExplorerField>
        </div>

        <ExplorerField label="Pattern ID">
          <input
            className="control-input"
            value={params.pattern_id}
            onChange={(e) => setParams({ ...params, pattern_id: e.target.value })}
          />
        </ExplorerField>

        <div className="surface-muted !rounded-[22px] !p-4">
          <label htmlFor="enabled" className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              className="h-4 w-4 accent-[var(--accent)]"
              checked={params.enabled}
              onChange={(e) => setParams({ ...params, enabled: e.target.checked })}
            />
            <span className="text-sm text-[var(--text-muted)]">Enable the rule set immediately after creation.</span>
          </label>
        </div>

        <ExplorerNotice>
          The omitted safety fields still use their seeded defaults in local demo mode. If you want those surfaced here next, I can expose them.
        </ExplorerNotice>
      </div>
    </ApiExplorer>
  );
}
