"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { BarChart3, TrendingUp, DollarSign, Target, Activity } from "lucide-react";
import { 
  NothingCard, 
  DotMatrixText, 
  DottedDivider,
  PillBadge,
  TerminalBlink
} from "@dennislee928/nothingx-react-components";

export default function InsightsPage() {
  const client = useTaas();
  const [hotZones, setHotZones] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.getHotZones("ws_demo")
      .then(setHotZones)
      .finally(() => setLoading(false));
  }, [client]);

  const sortedZones = Object.entries(hotZones)
    .map(([amount, count]) => ({ amount: parseFloat(amount), count }))
    .sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...sortedZones.map(z => z.count), 1);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div>
        <div className="flex items-center gap-3 mb-2 opacity-50">
          <BarChart3 size={16} />
          <span className="text-[10px] font-mono tracking-widest uppercase">Yield_Analysis</span>
        </div>
        <h2 className="text-5xl font-black tracking-tighter uppercase">Insights</h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Hot Zones Chart */}
        <div className="lg:col-span-8">
          <NothingCard dark style={{ border: '1px solid #222', padding: 40, background: '#050505' }}>
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-sm font-black tracking-[0.2em] flex items-center gap-3">
                <Target size={16} className="text-red-500" /> HOT_ZONE_DISTRIBUTION
              </h3>
              <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground uppercase bg-white/5 px-3 py-1 rounded-full">
                <TerminalBlink color="#ff0000" /> Real_Time_Aggregator
              </div>
            </div>

            <div className="space-y-8">
              {sortedZones.map((zone, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-red-500/30 transition-colors">
                        <DollarSign size={14} className="text-red-500" />
                      </div>
                      <span className="text-xs font-black tracking-tighter uppercase">${zone.amount.toFixed(2)} CREDIT_LEVEL</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">{zone.count} ACTIVATIONS</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1 relative overflow-hidden">
                    <div 
                      className="bg-red-500 h-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${(zone.count / maxCount) * 100}%` }}
                    >
                       <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 animate-[shimmer_2s_infinite]" />
                    </div>
                  </div>
                </div>
              ))}
              
              {sortedZones.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-24 border border-dashed border-white/5 rounded-3xl opacity-20">
                  <Activity size={48} strokeWidth={1} />
                  <p className="text-[10px] font-mono mt-4 tracking-widest uppercase">No_Historical_Data_Found</p>
                </div>
              )}
              
              {loading && (
                <div className="flex flex-col items-center justify-center py-24 opacity-20">
                   <DotMatrixText color="#888" dotSize={2}>CALCULATING_METRICS</DotMatrixText>
                </div>
              )}
            </div>
          </NothingCard>
        </div>

        {/* Key Takeaways */}
        <div className="lg:col-span-4 space-y-6">
          <NothingCard dark style={{ border: '1px solid #ff000033', padding: 24, background: 'radial-gradient(circle at top right, #ff000008, transparent)' }}>
            <h4 className="font-black text-xs tracking-widest text-red-500 mb-4 flex items-center gap-2">
              <TrendingUp size={16} /> REVENUE_OPTIMIZER
            </h4>
            <p className="text-[11px] text-white/60 leading-relaxed font-mono uppercase tracking-tighter">
              Your dominant engagement zone is <strong className="text-white">${sortedZones[0]?.amount.toFixed(2) || "0.00"}</strong>. 
              <DottedDivider style={{ margin: '12px 0', opacity: 0.1 }} />
              RECOMMENDATION: Increase intensity curves for this bucket to maximize creator retention and fan satisfaction.
            </p>
          </NothingCard>
          
          <NothingCard dark style={{ border: '1px solid #222', padding: 24, background: '#0a0a0a' }}>
            <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">Metrics_Glossary</h4>
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Hot_Zone</span>
                <p className="text-[10px] text-white/40 font-mono leading-tight uppercase">High-frequency activation points correlated with user tipping patterns.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Yield_Efficiency</span>
                <p className="text-[10px] text-white/40 font-mono leading-tight uppercase">Ratio of device uptime to session connection time.</p>
              </div>
            </div>
          </NothingCard>
        </div>
      </div>
    </div>
  );
}
