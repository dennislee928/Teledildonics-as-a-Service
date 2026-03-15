"use client";

import { useEffect, useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Session, signInboundEvent } from "@taas/domain-sdk";
import { Terminal, Send, CheckCircle2, XCircle, Zap, ShieldAlert } from "lucide-react";
import { 
  NothingCard, 
  NothingButton, 
  DotMatrixText, 
  DottedDivider,
  TerminalBlink,
  SegmentedDisplay,
  PillBadge
} from "@dennislee928/nothingx-react-components";

export default function SimulatorPage() {
  const client = useTaas();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [amount, setAmount] = useState("05.00");

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
    const finalAmount = parseFloat(amount);

    try {
      const event = await signInboundEvent({
        event_type: "tip.received",
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        source_id: sessionId,
        amount: finalAmount,
        currency: "USD",
        occurred_at: new Date().toISOString(),
        idempotency_key: `sim-${Date.now()}`,
        metadata: { simulator: true }
      });

      await client.handleInboundEvent(event);
      setResult({ success: true, message: `INBOUND_EVENT_ACCEPTED: $${finalAmount} for node ${sessionId}` });
    } catch (err: any) {
      setResult({ success: false, message: `SIMULATION_FAILED: ${err.message}` });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-4 opacity-50">
          <Terminal size={16} />
          <span className="text-[10px] font-mono tracking-widest uppercase">Kernel_Debug_Console</span>
        </div>
        <h2 className="text-6xl font-black tracking-tighter uppercase">Simulator</h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <NothingCard dark style={{ border: '1px solid #222', padding: 40, background: '#050505' }}>
            <form className="space-y-10" onSubmit={handleSimulate}>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Select_Target_Session</label>
                <div className="grid gap-3">
                  {sessions.map(s => (
                    <label key={s.id} className="relative cursor-pointer group">
                      <input type="radio" name="sessionId" value={s.id} className="peer sr-only" required />
                      <div className="p-4 rounded-2xl border border-white/5 bg-white/2 peer-checked:border-red-500/50 peer-checked:bg-red-500/5 transition-all flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Zap size={16} className="text-muted-foreground peer-checked:text-red-500" />
                          <span className="font-mono text-sm uppercase">{s.id}</span>
                        </div>
                        <PillBadge color="#333">{s.deviceId}</PillBadge>
                      </div>
                    </label>
                  ))}
                  {sessions.length === 0 && !loading && (
                    <div className="p-8 rounded-2xl border border-dashed border-red-500/20 text-center space-y-3">
                      <ShieldAlert size={24} className="mx-auto text-red-500/50" />
                      <p className="text-[10px] font-mono text-red-500/50 uppercase tracking-widest">No_Armed_Nodes_Found</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block text-center">Inbound_Credit_Amount</label>
                
                <div className="flex justify-center mb-8">
                   <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/10">
                      <SegmentedDisplay value={amount} color="#ff0000" size={40} />
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  {["01.00", "05.00", "10.00", "50.00"].map(val => (
                    <button 
                      key={val}
                      type="button"
                      onClick={() => setAmount(val)}
                      className={`py-3 rounded-xl border text-[10px] font-black tracking-widest transition-all uppercase ${
                        amount === val ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'
                      }`}
                    >
                      ${parseFloat(val)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <NothingButton onClick={() => {}} disabled={sessions.length === 0} variant="primary">
                  INJECT_EVENT_STREAM
                </NothingButton>
              </div>
            </form>
          </NothingCard>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <NothingCard dark style={{ border: '1px solid #222', padding: 24, background: '#0a0a0a' }}>
            <h3 className="text-[10px] font-black tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
              <TerminalBlink color="#ff0000" /> SYSTEM_OUTPUT
            </h3>
            
            <div className="min-h-[200px] font-mono text-[10px] leading-relaxed">
              {result ? (
                <div className={`space-y-4 animate-in fade-in duration-300 ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                  <p className="font-black underline">[{result.success ? 'SUCCESS' : 'FAILED'}]</p>
                  <p className="opacity-80">{result.message}</p>
                  <DottedDivider style={{ opacity: 0.2 }} />
                  <p className="text-white/20 uppercase tracking-tighter">Event_Hash: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                </div>
              ) : (
                <p className="text-white/20 italic uppercase tracking-widest text-center mt-20">Awaiting_Command_Execution...</p>
              )}
            </div>
          </NothingCard>

          <div className="p-6 border border-white/5 rounded-3xl bg-white/2">
            <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500/80 mb-3">Protocol_Note</h4>
            <p className="text-[10px] text-muted-foreground leading-normal font-mono uppercase tracking-tighter opacity-60">
              The simulator bypasses real payment gateways and directly communicates with the Control Plane's secure ingestion port. 
              Payloads are signed with the DEV_PRIVATE_KEY.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
