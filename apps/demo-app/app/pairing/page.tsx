"use client";

import { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { Unplug, Zap, CheckCircle2, Copy } from "lucide-react";

export default function PairingPage() {
  const client = useTaas();
  const [pairingData, setPairingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePair = async () => {
    setLoading(true);
    try {
      // Mocking the transport public key (X25519)
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
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Pairing Demo</h2>
        <p className="text-muted-foreground">Pair your Companion App with the TaaS Control Plane.</p>
      </div>

      <div className="border rounded-xl p-8 bg-card shadow-sm text-center">
        {!pairingData ? (
          <div className="space-y-6">
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
              <Unplug size={40} />
            </div>
            <p className="text-sm text-muted-foreground">
              In production, the Companion App generates an X25519 keypair and sends the public key to this endpoint.
            </p>
            <button 
              onClick={handlePair}
              disabled={loading}
              className="bg-accent text-accent-foreground px-8 py-3 rounded-md hover:bg-accent/90 transition-colors font-bold disabled:opacity-50"
            >
              {loading ? "Pairing..." : "Simulate Pairing Flow"}
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-left">
            <div className="flex items-center gap-3 text-green-600 mb-6">
              <CheckCircle2 size={24} />
              <span className="font-bold text-xl">Pairing Bundle Generated</span>
            </div>
            
            <DataBox label="Server Transport Public Key" value={pairingData.server_transport_public_key} />
            <DataBox label="Wrapped Session Key (Ciphertext)" value={pairingData.ciphertext} />
            <DataBox label="Nonce" value={pairingData.nonce} />
            <DataBox label="Server Signing Public Key" value={pairingData.server_signing_public_key} />

            <button 
              onClick={() => setPairingData(null)}
              className="w-full border border-muted py-2 rounded-md hover:bg-muted/50 transition-colors text-sm"
            >
              Reset Demo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center px-1">
        <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{label}</label>
        <button 
          onClick={() => navigator.clipboard.writeText(value)}
          className="text-[10px] text-accent hover:underline flex items-center gap-1"
        >
          <Copy size={10} /> Copy
        </button>
      </div>
      <div className="bg-muted/50 p-3 rounded-md font-mono text-xs break-all border overflow-auto max-h-20">
        {value}
      </div>
    </div>
  );
}
