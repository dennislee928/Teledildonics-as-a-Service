"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerField, ExplorerNotice } from "@/components/ApiExplorer";
import { Shield } from "lucide-react";

export default function HandshakePage() {
  const client = useTaas();
  const [params, setParams] = useState({
    device_name: "X-Series Pro",
    capability: "vibrate",
    max_intensity: 100,
    transport_public_key: "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A="
  });

  const onExecute = () => {
    return client.pairDeviceBridge({
      workspace_id: "ws_demo",
      creator_id: "cr_demo",
      ...params,
      capability: params.capability as any
    });
  };

  return (
    <ApiExplorer
      title="Secure handshake"
      endpoint="POST /v1/device-bridges/pair"
      description="Inspect the bridge pairing handshake and confirm the transport exchange values returned by the server."
      onExecute={onExecute}
      actionLabel="Run handshake"
    >
      <div className="space-y-4">
        <ExplorerField label="Device name" icon={<Shield size={14} className="text-[var(--accent)]" />}>
          <input
            className="control-input"
            value={params.device_name}
            onChange={(e) => setParams({ ...params, device_name: e.target.value })}
          />
        </ExplorerField>

        <ExplorerField label="Capability">
          <select
            className="control-select"
            value={params.capability}
            onChange={(e) => setParams({ ...params, capability: e.target.value })}
          >
            <option value="vibrate">Vibration</option>
            <option value="oscillate">Oscillation</option>
            <option value="rotate">Rotation</option>
          </select>
        </ExplorerField>

        <ExplorerField label="Max intensity (%)">
          <input
            type="number"
            className="control-input"
            value={params.max_intensity}
            onChange={(e) => setParams({ ...params, max_intensity: parseInt(e.target.value) })}
          />
        </ExplorerField>

        <ExplorerField label="Client transport public key">
          <textarea
            className="control-textarea"
            value={params.transport_public_key}
            onChange={(e) => setParams({ ...params, transport_public_key: e.target.value })}
          />
        </ExplorerField>

        <ExplorerNotice>
          This route shares the same server pairing endpoint as bridge onboarding, but the visual emphasis here is on the returned cryptographic bundle.
        </ExplorerNotice>
      </div>
    </ApiExplorer>
  );
}
