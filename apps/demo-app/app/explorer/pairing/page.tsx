"use client";

import React, { useState } from "react";
import { useTaas } from "@/components/TaasProvider";
import { ApiExplorer, ExplorerField, ExplorerNotice } from "@/components/ApiExplorer";
import { Monitor } from "lucide-react";

export default function PairingExplorer() {
  const client = useTaas();
  const [params, setParams] = useState({
    bridge_name: "DESKTOP_NODE_01",
    device_name: "GENERIC_HAPTIC_V1",
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
      title="Bridge pairing"
      endpoint="POST /v1/device-bridges/pair"
      description="Register a new device bridge and hardware node. Pairing returns the wrapped session key bundle and server signing key."
      onExecute={onExecute}
      actionLabel="Pair device bridge"
    >
      <div className="space-y-4">
        <ExplorerField label="Bridge alias" icon={<Monitor size={14} className="text-[var(--accent)]" />}>
          <input
            className="control-input"
            value={params.bridge_name}
            onChange={(e) => setParams({ ...params, bridge_name: e.target.value })}
          />
        </ExplorerField>

        <ExplorerField label="Device label">
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
            <option value="vibrate">Vibrate</option>
            <option value="oscillate">Oscillate</option>
            <option value="rotate">Rotate</option>
          </select>
        </ExplorerField>

        <ExplorerField label="Transport public key">
          <textarea
            className="control-textarea"
            value={params.transport_public_key}
            onChange={(e) => setParams({ ...params, transport_public_key: e.target.value })}
          />
        </ExplorerField>

        <ExplorerNotice>
          The response includes `session_key_bundle` and `server_signing_public_key`. Keep those visible; they are the point of this flow.
        </ExplorerNotice>
      </div>
    </ApiExplorer>
  );
}
