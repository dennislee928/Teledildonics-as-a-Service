"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerEmptyState, ExplorerField, ExplorerSegmented } from "@/components/ApiExplorer";
import { Database } from "lucide-react";

export default function SessionsExplorer() {
  const client = useTaas();
  const [method, setMethod] = useState<"LIST" | "CREATE">("LIST");
  const [createParams, setCreateParams] = useState({
    device_id: "device_demo",
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
      title="Session explorer"
      endpoint={method === "LIST" ? "GET /v1/workspaces/{id}/overview" : "POST /v1/sessions"}
      description="Provision and audit remote control sessions. Create a session or inspect the current workspace session list from the same screen."
      onExecute={onExecute}
      actionLabel={method === "LIST" ? "Fetch sessions" : "Create session"}
    >
      <div className="space-y-5">
        <ExplorerSegmented
          value={method}
          onChange={setMethod}
          options={[
            { value: "LIST", label: "List" },
            { value: "CREATE", label: "Create" },
          ]}
        />

        {method === "CREATE" && (
          <div className="space-y-4">
            <ExplorerField label="Device ID">
              <input
                className="control-input"
                value={createParams.device_id}
                onChange={(e) => setCreateParams({ ...createParams, device_id: e.target.value })}
              />
            </ExplorerField>

            <ExplorerField label="Rule set ID">
              <input
                className="control-input"
                value={createParams.rule_set_id}
                onChange={(e) => setCreateParams({ ...createParams, rule_set_id: e.target.value })}
              />
            </ExplorerField>

            <div className="grid gap-4 md:grid-cols-2">
              <ExplorerField label="Max intensity">
                <input
                  type="number"
                  className="control-input"
                  value={createParams.max_intensity}
                  onChange={(e) => setCreateParams({ ...createParams, max_intensity: parseInt(e.target.value) })}
                />
              </ExplorerField>
              <ExplorerField label="Max duration (ms)">
                <input
                  type="number"
                  className="control-input"
                  value={createParams.max_duration_ms}
                  onChange={(e) => setCreateParams({ ...createParams, max_duration_ms: parseInt(e.target.value) })}
                />
              </ExplorerField>
            </div>
          </div>
        )}

        {method === "LIST" && (
          <ExplorerEmptyState
            icon={<Database size={20} />}
            title="Workspace session list"
            body="Fetch the overview route and inspect the current session array directly from the live API response."
          />
        )}
      </div>
    </ApiExplorer>
  );
}
