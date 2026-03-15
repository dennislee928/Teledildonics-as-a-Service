"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerField, ExplorerNotice, ExplorerSegmented } from "@/components/ApiExplorer";
import { ShieldAlert } from "lucide-react";

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
      title="Session control"
      endpoint={method === "ARM" ? "POST /v1/sessions/{id}/arm" : "POST /v1/sessions/{id}/stop"}
      description="Manage the live state of a session. Arming binds a bridge grant to the session, while stop triggers an immediate control collapse."
      onExecute={onExecute}
      actionLabel={method === "ARM" ? "Arm session" : "Stop session"}
    >
      <div className="space-y-5">
        <ExplorerSegmented
          value={method}
          onChange={setMethod}
          options={[
            { value: "ARM", label: "Arm" },
            { value: "STOP", label: "Stop" },
          ]}
        />

        <ExplorerField label="Target session" icon={<ShieldAlert size={14} className="text-[var(--accent)]" />}>
          <input
            className="control-input"
            value={params.sessionId}
            onChange={(e) => setParams({ ...params, sessionId: e.target.value })}
          />
        </ExplorerField>

        {method === "ARM" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ExplorerField label="Bridge ID">
              <input
                className="control-input"
                value={params.bridge_id}
                onChange={(e) => setParams({ ...params, bridge_id: e.target.value })}
              />
            </ExplorerField>
            <ExplorerField label="Grant duration (ms)">
              <input
                type="number"
                className="control-input"
                value={params.expires_in_ms}
                onChange={(e) => setParams({ ...params, expires_in_ms: parseInt(e.target.value) })}
              />
            </ExplorerField>
          </div>
        ) : (
          <div className="space-y-4">
            <ExplorerField label="Stop reason">
              <textarea
                className="control-textarea"
                value={params.reason}
                onChange={(e) => setParams({ ...params, reason: e.target.value })}
              />
            </ExplorerField>
            <ExplorerNotice tone="warning">
              Stop is a hard terminal transition. The runtime revokes the grant and emits a global `stop-all` command.
            </ExplorerNotice>
          </div>
        )}
      </div>
    </ApiExplorer>
  );
}
