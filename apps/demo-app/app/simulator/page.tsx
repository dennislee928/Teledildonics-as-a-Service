"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Session, signInboundEvent } from "@taas/domain-sdk";
import { Terminal, Send, CheckCircle2, XCircle } from "lucide-react";

export default function SimulatorPage() {
  const client = useTaas();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    client.getWorkspaceOverview("ws_demo", "cr_demo")
      .then(data => setSessions(data.sessions.filter(s => s.status === 'armed')))
      .finally(() => setLoading(false));
  }, [client]);

  const handleSimulate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const sessionId = formData.get("sessionId") as string;
    const amount = parseFloat(formData.get("amount") as string);

    try {
      const event = await signInboundEvent({
        event_type: "tip.received",
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        source_id: sessionId,
        amount: amount,
        currency: "USD",
        occurred_at: new Date().toISOString(),
        idempotency_key: `sim-${Date.now()}`,
        metadata: { simulator: true }
      });

      await client.handleInboundEvent(event);
      setResult({ success: true, message: `Successfully simulated $${amount} tip for session ${sessionId}` });
    } catch (err: any) {
      setResult({ success: false, message: err.message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Event Simulator</h2>
        <p className="text-muted-foreground">Trigger mock inbound events to test your device rules.</p>
      </div>

      <div className="border rounded-xl p-8 bg-card shadow-sm">
        <form className="space-y-6" onSubmit={handleSimulate}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Armed Session</label>
            <select name="sessionId" className="w-full border rounded-md p-3 bg-background" required disabled={loading || sessions.length === 0}>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.id} (Device: {s.deviceId})</option>
              ))}
              {!loading && sessions.length === 0 && (
                <option disabled>No armed sessions available</option>
              )}
            </select>
            {sessions.length === 0 && !loading && (
              <p className="text-xs text-amber-600 font-medium">You must arm a session first!</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tip Amount ($)</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 5, 10, 20].map(val => (
                <button 
                  key={val}
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('amount-input') as HTMLInputElement;
                    if (input) input.value = val.toString();
                  }}
                  className="py-2 border rounded-md hover:bg-accent transition-colors text-sm"
                >
                  ${val}
                </button>
              ))}
            </div>
            <input 
              id="amount-input"
              name="amount" 
              type="number" 
              step="0.01" 
              defaultValue="5.00" 
              className="w-full border rounded-md p-3 bg-background mt-2" 
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={sessions.length === 0}
            className="w-full bg-accent text-accent-foreground py-3 rounded-md hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 font-bold"
          >
            <Send size={18} /> Send Inbound Event
          </button>
        </form>

        {result && (
          <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
            result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}>
            {result.success ? <CheckCircle2 className="mt-0.5" size={18} /> : <XCircle className="mt-0.5" size={18} />}
            <span className="text-sm">{result.message}</span>
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-xl p-6 border border-dashed">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Terminal size={16} /> How it works
        </h4>
        <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
          <li>The simulator generates a standards-compliant <code>InboundEvent</code>.</li>
          <li>It signs the payload using the development Ed25519 private key.</li>
          <li>The Control Plane verifies the signature against the seeded public key.</li>
          <li>Rules are evaluated, and if successful, a command is dispatched to the companion.</li>
        </ul>
      </div>
    </div>
  );
}
