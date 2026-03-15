"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { BarChart3, TrendingUp, DollarSign } from "lucide-react";

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
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Insights</h2>
        <p className="text-muted-foreground">Analyze your engagement "Hot Zones" to optimize pricing.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Hot Zones Chart */}
        <div className="lg:col-span-2 border rounded-xl p-8 bg-card shadow-sm">
          <h3 className="font-semibold mb-6 flex items-center gap-2">
            <BarChart3 size={18} /> Tip Amount Frequency
          </h3>
          <div className="space-y-6">
            {sortedZones.map((zone, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium flex items-center gap-1">
                    <DollarSign size={14} className="text-muted-foreground" />
                    {zone.amount.toFixed(2)} Tip
                  </span>
                  <span className="text-muted-foreground">{zone.count} times</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-accent h-full transition-all duration-1000 ease-out"
                    style={{ width: `${(zone.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {sortedZones.length === 0 && !loading && (
              <div className="text-center py-20 text-muted-foreground text-sm italic border-2 border-dashed rounded-xl">
                No usage data available yet. Simulate some tips to see insights!
              </div>
            )}
            {loading && <div className="text-center py-20 animate-pulse">Analyzing usage data...</div>}
          </div>
        </div>

        {/* Key Takeaways */}
        <div className="lg:col-span-1 space-y-4">
          <div className="border rounded-xl p-6 bg-accent/5 border-accent/20">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-accent">
              <TrendingUp size={18} /> Optimization Tip
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your most frequent tip amount is <strong>${sortedZones[0]?.amount.toFixed(2) || "0.00"}</strong>. 
              Consider adding more granular intensity steps around this value to increase user satisfaction.
            </p>
          </div>
          
          <div className="border rounded-xl p-6 bg-card">
            <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Metrics Glossary</h4>
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold block mb-1">Hot Zone</span>
                <span className="text-muted-foreground leading-normal">A tip amount that historically triggers the most device interaction.</span>
              </div>
              <div>
                <span className="font-bold block mb-1">Utilization</span>
                <span className="text-muted-foreground leading-normal">The percentage of time a session is in the "armed" state while receiving commands.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
