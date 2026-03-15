"use client";

import React from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerEmptyState, ExplorerNotice } from "@/components/ApiExplorer";
import { BarChart3, Search } from "lucide-react";

export default function AnalyticsExplorer() {
  const client = useTaas();

  const onExecute = () => {
    return client.getHotZones("ws_demo");
  };

  return (
    <ApiExplorer
      title="Hot-zone analytics"
      endpoint="GET /v1/workspaces/{id}/insights/hot-zones"
      description="Analyze the workspace usage ledger and return the amount buckets that appear most often in event-driven control flows."
      onExecute={onExecute}
      actionLabel="Fetch hot zones"
    >
      <div className="space-y-4">
        <ExplorerEmptyState
          icon={<BarChart3 size={20} />}
          title="Workspace-scoped aggregation"
          body="This request returns a JSON object keyed by amount bucket, which is a much better fit for dashboards and charts than the old raw map shape."
        />
        <ExplorerNotice>
          Scope is fixed to the seeded workspace `ws_demo`. Execute the request and reuse the response directly in creator-side heatmaps.
        </ExplorerNotice>
        <ExplorerNotice tone="warning">
          <span className="flex items-start gap-2">
            <Search size={14} className="mt-1 shrink-0 text-[var(--accent)]" />
            Use the response as counts, not percentages. The API returns frequency by amount bucket.
          </span>
        </ExplorerNotice>
      </div>
    </ApiExplorer>
  );
}
