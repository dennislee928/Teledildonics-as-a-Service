"use client";

import { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Unplug, Zap, CheckCircle2, Copy, ShieldAlert, Cpu } from "lucide-react";
import { 
  NothingCard, 
  NothingButton, 
  DotMatrixText, 
  DottedDivider,
  TerminalBlink,
  GlitchText
} from "@dennislee928/nothingx-react-components";

export default function PairingPage() {
  const client = useTaas();
  const [pairingData, setPairingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePair = async () => {
    setLoading(true);
    try {
      const mockKey = "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A=";
      const res = await client.pairDeviceBridge({
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        transport_public_key: mockKey,
        device_name: "Demo Device",
        capability: "vibrate",
        max_intensity: 100,
      });
      setPairingData(res);
    } catch (err: any) {
      alert("Pairing failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-4 px-4 py-1 rounded-full bg-red-500/10 border border-red-500/20">
          <ShieldAlert size={14} className="text-red-500" />
          <span className="text-[9px] font-black tracking-[0.3em] text-red-500 uppercase">Cryptographic_Handshake_Required</span>
        </div>
        <h2 className="text-6xl font-black tracking-tighter mb-4">DEVICE_PAIR</h2>
        <p className="text-muted-foreground text-xs font-mono tracking-widest uppercase opacity-60">Secure_Bridge_Establishment_v2</p>
      </div>

      <NothingCard dark style={{ border: '1px solid #222', padding: 48, background: '#050505', borderRadius: 40 }}>
        {!pairingData ? (
          <div className="flex flex-col items-center gap-10 text-center">
            <div className="relative">
              <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                <Unplug size={48} className="text-red-500" />
              </div>
              <div className="absolute inset-0 w-full h-full border-2 border-red-500/20 border-dashed rounded-full animate-[spin_10s_linear_infinite]" />
            </div>
            
            <div className="space-y-4 max-w-md">
              <div className="text-lg">
                <GlitchText active>AWAITING_X25519_EXCHANGE</GlitchText>
              </div>
              <p className="text-xs text-muted-foreground font-mono leading-relaxed uppercase tracking-tighter opacity-50">
                The Companion App must present a valid transport public key to negotiate a shared secret. 
                All subsequent commands will be sealed with this ephemeral session key.
              </p>
            </div>

            <div className="w-full h-px bg-white/5 relative">
               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#050505] px-4 text-[10px] font-mono text-muted-foreground">HANDSHAKE_READY</div>
            </div>

            <NothingButton onClick={handlePair} disabled={loading} variant="primary">
              {loading ? "NEGOTIATING..." : "START_PAIRING_SEQUENCE"}
            </NothingButton>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="flex items-center gap-4 text-green-500">
              <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-xl tracking-tight uppercase">Session_Key_Sealed</h3>
                <p className="text-[10px] font-mono text-green-500/60 uppercase">Handshake_Success // Status: 200_OK</p>
              </div>
            </div>
            
            <div className="grid gap-6">
              <DataBox label="Transport_Key" value={pairingData.server_transport_public_key} />
              <DataBox label="Ciphertext_Bundle" value={pairingData.ciphertext} />
              <DataBox label="IV_Nonce" value={pairingData.nonce} />
              <DataBox label="Signing_Authority" value={pairingData.server_signing_public_key} />
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
               <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                  <Cpu size={12} className="text-red-500" />
                  <span>COMPANION_CORE_CONNECTED</span>
               </div>
               <button 
                onClick={() => setPairingData(null)}
                className="text-[10px] font-black tracking-widest text-muted-foreground hover:text-red-500 transition-colors uppercase"
              >
                Reset_Sequence
              </button>
            </div>
          </div>
        )}
      </NothingCard>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center px-1">
        <label className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</label>
        <button 
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-[9px] font-black text-red-500 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest"
        >
          <Copy size={10} /> Copy
        </button>
      </div>
      <div className="bg-white/5 p-4 rounded-2xl font-mono text-[10px] break-all border border-white/5 group-hover:border-red-500/30 transition-all overflow-auto max-h-24 scrollbar-hide">
        {value}
      </div>
    </div>
  );
}
