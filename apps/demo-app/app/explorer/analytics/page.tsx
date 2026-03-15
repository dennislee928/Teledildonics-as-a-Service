"use client";

import React from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer } from "@/components/ApiExplorer";
import { BarChart3, Target, Search } from "lucide-react";

export default function AnalyticsExplorer() {
  const client = useTaas();

  const onExecute = () => {
    return client.getHotZones("ws_demo");
  };

  return (
    <ApiExplorer 
      title="Yield_Insights" 
      endpoint="GET /v1/workspaces/{id}/insights/hot-zones"
      description="Analyze user engagement clusters. This endpoint identifies the tip amounts that trigger the highest haptic density."
      onExecute={onExecute}
    >
      <div className="space-y-8">
        <div className="p-8 border border-white/5 rounded-[32px] bg-white/[0.02] text-center relative overflow-hidden group">
           <div className="absolute inset-0 bg-red-500/[0.02] opacity-0 group-hover:opacity-100 transition-opacity" />
           <BarChart3 size={40} className="mx-auto text-red-500 mb-6 animate-pulse" />
           <h4 className="text-xs font-black tracking-widest uppercase mb-2">Cluster_Aggregation_v1</h4>
           <p className="text-[10px] font-mono text-muted-foreground uppercase leading-relaxed max-w-xs mx-auto">
             Statistical analysis of the usage ledger <br /> filtered by workspace context.
           </p>
        </div>

        <div className="space-y-4">
           <div className="flex items-center justify-between text-[10px] font-black text-white/40 uppercase tracking-widest px-2">
              <span>Query_Scope</span>
              <span>Workspace_ID</span>
           </div>
           <div className="bg-white/5 border border-white/10 rounded-xl p-4 font-mono text-xs text-red-500">
              WS_DEMO_ROOT
           </div>
        </div>

        <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/[0.02] flex items-start gap-3">
           <Search size={14} className="text-red-500 shrink-0 mt-0.5" />
           <p className="text-[9px] font-mono text-red-500/60 uppercase leading-relaxed tracking-tighter">
             Insight: Use the response data to populate the visual yield heatmaps in the creator dashboard.
           </p>
        </div>
      </div>
    </ApiExplorer>
  );
}
