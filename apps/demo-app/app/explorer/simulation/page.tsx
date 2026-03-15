"use client";

import React, { useState, useEffect } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerField, ExplorerNotice } from "@/components/ApiExplorer";
import { signInboundEvent, Session } from "@taas/domain-sdk";
import { Terminal as TerminalIcon, Zap } from "lucide-react";

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
      title="Inbound event simulator"
      endpoint="POST /v1/inbound-events"
      description="Mock inbound monetization events and let the rules engine translate them into control commands against an armed session."
      onExecute={onExecute}
      actionLabel="Send simulated event"
    >
      <div className="space-y-5">
        <ExplorerField label="Target session" icon={<Zap size={14} className="text-[var(--accent)]" />}>
          <select
            className="control-select"
            value={params.sessionId}
            onChange={(e) => setParams({ ...params, sessionId: e.target.value })}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.id} ({s.deviceId})</option>
            ))}
            {sessions.length === 0 && <option disabled>No armed sessions</option>}
          </select>
        </ExplorerField>

        <ExplorerField label="Tip amount">
          <div className="surface-muted !rounded-[22px] !p-4">
            <div className="mono-copy text-4xl text-[var(--text)] sm:text-5xl">${params.amount}</div>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Pick a preset or type a custom amount.</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {["01.00", "05.00", "10.00", "50.00"].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setParams({ ...params, amount: val })}
                  className={`rounded-full border px-4 py-3 text-sm transition-all ${
                    params.amount === val
                      ? "border-[color:var(--border-strong)] bg-[var(--accent-soft)] text-[var(--text)]"
                      : "border-[var(--border)] bg-white/[0.03] text-[var(--text-muted)] hover:bg-white/[0.05]"
                  }`}
                >
                  ${parseFloat(val)}
                </button>
            ))}
          </div>

          <input
            className="control-input"
            value={params.amount}
            onChange={(e) => setParams({ ...params, amount: e.target.value })}
          />
        </ExplorerField>

        <ExplorerNotice>
          <span className="flex items-start gap-2">
            <TerminalIcon size={14} className="mt-1 shrink-0 text-[var(--accent)]" />
            All simulated events are signed with the seeded development key before they hit `/v1/inbound-events`.
          </span>
        </ExplorerNotice>
      </div>
    </ApiExplorer>
  );
}
