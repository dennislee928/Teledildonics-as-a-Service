import {
  DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64,
  TaasClient,
  type PairDeviceBridgeResponse,
  type Session,
  type TelemetryEvent
} from "@taas/domain-sdk";

const client = new TaasClient({
  baseUrl: "http://localhost:8080"
});

let currentSession: Session | null = null;
let telemetrySource: EventSource | null = null;
let pairing: PairDeviceBridgeResponse | null = null;

function appendLog(target: HTMLElement, payload: unknown): void {
  target.textContent = `${JSON.stringify(payload, null, 2)}\n\n${target.textContent ?? ""}`.trim();
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    return;
  }

  app.innerHTML = `
    <main>
      <section class="hero">
        <span class="kicker">Creator Console</span>
        <h1>Operate every session with explicit consent.</h1>
        <p>
          This shell arms zero-trust sessions, pairs companion bridges, edits event-driven rules,
          and tails telemetry from the relay. The seeded demo workspace matches the local Go API.
        </p>
        <div class="pill-row">
          <span class="pill">Workspace: ws_demo</span>
          <span class="pill">Creator: cr_demo</span>
          <span class="pill">Default Rule: rule_demo</span>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <span class="kicker">Device Pairing</span>
          <h2>Companion bridge</h2>
          <label>
            X25519 transport key
            <input id="transport-key" value="MCowBQYDK2VuAyEA9lvzUkqR0ywqYB6J4Qe2R3kb8nWRve2V5ZctmkR8F7Q=" />
          </label>
          <label>
            Device name
            <input id="device-name" value="Loveseat Pulse" />
          </label>
          <label>
            Capability
            <select id="capability">
              <option value="vibrate">vibrate</option>
              <option value="oscillate">oscillate</option>
              <option value="rotate">rotate</option>
            </select>
          </label>
          <label>
            Pairing max intensity
            <input id="pairing-max-intensity" type="number" value="88" />
          </label>
          <div class="button-row">
            <button id="pair-button">Pair bridge</button>
          </div>
          <pre id="pairing-log">Awaiting pairing...</pre>
        </article>

        <article class="card">
          <span class="kicker">Rules Engine</span>
          <h2>Revenue mapping</h2>
          <label>
            Amount step (cents)
            <input id="amount-step" type="number" value="200" />
          </label>
          <label>
            Intensity step
            <input id="intensity-step" type="number" value="14" />
          </label>
          <label>
            Max intensity
            <input id="max-intensity" type="number" value="88" />
          </label>
          <label>
            Max duration (ms)
            <input id="max-duration" type="number" value="12000" />
          </label>
          <div class="button-row">
            <button id="save-rule-button">Upsert rule_demo</button>
          </div>
          <pre id="rules-log">Rule set idle...</pre>
        </article>

        <article class="card">
          <span class="kicker">Session Control</span>
          <h2>Arm and revoke</h2>
          <label>
            Device ID
            <input id="session-device-id" value="device_demo" />
          </label>
          <label>
            Rule set ID
            <input id="session-rule-id" value="rule_demo" />
          </label>
          <label>
            Max intensity
            <input id="session-max-intensity" type="number" value="88" />
          </label>
          <label>
            Max duration (ms)
            <input id="session-max-duration" type="number" value="12000" />
          </label>
          <div class="button-row">
            <button id="create-session-button">Create session</button>
            <button id="arm-session-button">Arm session</button>
            <button id="stop-session-button">Panic stop</button>
          </div>
          <pre id="session-log">No active session.</pre>
        </article>

        <article class="card">
          <span class="kicker">Telemetry Stream</span>
          <h2>Signed command health</h2>
          <p>Development endpoint public key:</p>
          <pre>${DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64}</pre>
          <pre id="telemetry-log" class="telemetry-log">Waiting for telemetry...</pre>
        </article>
      </section>
    </main>
  `;

  const pairingLog = document.querySelector<HTMLElement>("#pairing-log")!;
  const rulesLog = document.querySelector<HTMLElement>("#rules-log")!;
  const sessionLog = document.querySelector<HTMLElement>("#session-log")!;
  const telemetryLog = document.querySelector<HTMLElement>("#telemetry-log")!;

  document.querySelector<HTMLButtonElement>("#pair-button")!.addEventListener("click", async () => {
    try {
      pairing = await client.pairDeviceBridge({
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        bridge_id: "bridge_demo",
        transport_public_key: (document.querySelector<HTMLInputElement>("#transport-key")!).value,
        device_name: (document.querySelector<HTMLInputElement>("#device-name")!).value,
        capability: (document.querySelector<HTMLSelectElement>("#capability")!).value as "vibrate" | "oscillate" | "rotate",
        max_intensity: Number((document.querySelector<HTMLInputElement>("#pairing-max-intensity")?.value) ?? "88")
      });
      appendLog(pairingLog, pairing);
    } catch (error) {
      appendLog(pairingLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#save-rule-button")!.addEventListener("click", async () => {
    try {
      const response = await client.updateRuleSet("rule_demo", {
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        amount_step_cents: Number((document.querySelector<HTMLInputElement>("#amount-step")!).value),
        intensity_step: Number((document.querySelector<HTMLInputElement>("#intensity-step")!).value),
        max_intensity: Number((document.querySelector<HTMLInputElement>("#max-intensity")!).value),
        duration_per_step_ms: 2800,
        max_duration_ms: Number((document.querySelector<HTMLInputElement>("#max-duration")!).value),
        cooldown_ms: 750,
        rate_limit_per_minute: 45,
        pattern_id: "pulse-wave",
        enabled: true
      });
      appendLog(rulesLog, response);
    } catch (error) {
      appendLog(rulesLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#create-session-button")!.addEventListener("click", async () => {
    try {
      currentSession = await client.createSession({
        workspace_id: "ws_demo",
        creator_id: "cr_demo",
        device_id: (document.querySelector<HTMLInputElement>("#session-device-id")!).value,
        rule_set_id: (document.querySelector<HTMLInputElement>("#session-rule-id")!).value,
        max_intensity: Number((document.querySelector<HTMLInputElement>("#session-max-intensity")!).value),
        max_duration_ms: Number((document.querySelector<HTMLInputElement>("#session-max-duration")!).value)
      });
      appendLog(sessionLog, currentSession);
      telemetrySource?.close();
      telemetrySource = client.streamSession(currentSession.id, {
        onMessage: (event: TelemetryEvent) => appendLog(telemetryLog, event),
        onError: (error) => appendLog(telemetryLog, { streamError: String(error.type) })
      });
    } catch (error) {
      appendLog(sessionLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#arm-session-button")!.addEventListener("click", async () => {
    if (!currentSession) {
      appendLog(sessionLog, { error: "Create a session first." });
      return;
    }
    try {
      currentSession = await client.armSession(currentSession.id, {
        bridge_id: pairing?.bridge.id ?? "bridge_demo",
        expires_in_ms: 15 * 60 * 1000
      });
      appendLog(sessionLog, currentSession);
    } catch (error) {
      appendLog(sessionLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#stop-session-button")!.addEventListener("click", async () => {
    if (!currentSession) {
      appendLog(sessionLog, { error: "Create a session first." });
      return;
    }
    try {
      currentSession = await client.stopSession(currentSession.id, {
        reason: "creator panic stop"
      });
      appendLog(sessionLog, currentSession);
    } catch (error) {
      appendLog(sessionLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

render();
