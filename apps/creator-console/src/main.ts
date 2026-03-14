import {
  DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64,
  DEV_WORKSPACE_API_KEY,
  TaasClient,
  type PairDeviceBridgeResponse,
  type Session,
  type TelemetryEvent,
  type WorkspaceOverview
} from "@taas/domain-sdk";

const WORKSPACE_ID = "ws_demo";
const CREATOR_ID = "cr_demo";
const DEFAULT_RULESET_ID = "rule_demo";

function resolveApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:8080";
  }
  if (window.location.hostname === "localhost" && window.location.port !== "8080") {
    return "http://localhost:8080";
  }
  return window.location.origin;
}

const client = new TaasClient({
  baseUrl: resolveApiBaseUrl(),
  apiKey: DEV_WORKSPACE_API_KEY
});

let currentSession: Session | null = null;
let telemetrySource: EventSource | null = null;
let pairing: PairDeviceBridgeResponse | null = null;

function appendLog(target: HTMLElement, payload: unknown): void {
  target.textContent = `${JSON.stringify(payload, null, 2)}\n\n${target.textContent ?? ""}`.trim();
}

function replaceLog(target: HTMLElement, payload: unknown): void {
  target.textContent = JSON.stringify(payload, null, 2);
}

function renderOverviewSummary(overview: WorkspaceOverview): string {
  const armedSessions = overview.sessions.filter((session) => session.status === "armed").length;
  const connectedDevices = overview.devices.filter((device) => device.connected).length;
  const latestAudit = overview.recent_audit[0]?.kind ?? "none";
  const latestTelemetry = overview.recent_telemetry[0]?.status ?? "none";

  return `
    <div class="summary-grid">
      <div class="summary-tile">
        <strong>${overview.sessions.length}</strong>
        <span>sessions</span>
      </div>
      <div class="summary-tile">
        <strong>${armedSessions}</strong>
        <span>armed now</span>
      </div>
      <div class="summary-tile">
        <strong>${connectedDevices}/${overview.devices.length}</strong>
        <span>devices online</span>
      </div>
      <div class="summary-tile">
        <strong>${overview.metrics.ack_p95_ms.toFixed(1)} ms</strong>
        <span>ack p95</span>
      </div>
    </div>
    <div class="pill-row overview-pills">
      <span class="pill">Latest audit: ${latestAudit}</span>
      <span class="pill">Latest telemetry: ${latestTelemetry}</span>
      <span class="pill">Webhook failures: ${overview.metrics.webhook_failures}</span>
      <span class="pill">Rule rejections: ${overview.metrics.rule_rejections}</span>
    </div>
  `;
}

function attachSessionStream(
  sessionId: string,
  telemetryLog: HTMLElement,
  refreshOverview: () => Promise<void>
): void {
  telemetrySource?.close();
  telemetrySource = client.streamSession(sessionId, {
    onMessage: (event: TelemetryEvent) => {
      appendLog(telemetryLog, event);
      void refreshOverview();
    },
    onError: (error) => appendLog(telemetryLog, { streamError: String(error.type) })
  });
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
          This shell now reads a live workspace overview, arms zero-trust sessions, pairs companion
          bridges, edits event-driven rules, and accepts companion telemetry back into the control plane.
        </p>
        <div class="pill-row">
          <span class="pill">Workspace: ${WORKSPACE_ID}</span>
          <span class="pill">Creator: ${CREATOR_ID}</span>
          <span class="pill">Default Rule: ${DEFAULT_RULESET_ID}</span>
        </div>
      </section>

      <section class="grid">
        <article class="card card-wide">
          <div class="card-head">
            <div>
              <span class="kicker">Workspace Overview</span>
              <h2>Read model and recent activity</h2>
            </div>
            <button id="refresh-overview-button">Refresh overview</button>
          </div>
          <div id="overview-summary" class="overview-summary">
            <p class="subtle">Loading current workspace state...</p>
          </div>
          <pre id="overview-log">Overview pending...</pre>
        </article>

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
            <input id="session-rule-id" value="${DEFAULT_RULESET_ID}" />
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
          <div class="button-row">
            <button id="simulate-ack-button">Simulate companion ack</button>
            <button id="simulate-stop-button">Simulate disconnect stop</button>
          </div>
          <pre id="telemetry-log" class="telemetry-log">Waiting for telemetry...</pre>
        </article>
      </section>
    </main>
  `;

  const overviewSummary = document.querySelector<HTMLElement>("#overview-summary")!;
  const overviewLog = document.querySelector<HTMLElement>("#overview-log")!;
  const pairingLog = document.querySelector<HTMLElement>("#pairing-log")!;
  const rulesLog = document.querySelector<HTMLElement>("#rules-log")!;
  const sessionLog = document.querySelector<HTMLElement>("#session-log")!;
  const telemetryLog = document.querySelector<HTMLElement>("#telemetry-log")!;

  async function refreshOverview(): Promise<void> {
    try {
      const overview = await client.getWorkspaceOverview(WORKSPACE_ID, CREATOR_ID);
      overviewSummary.innerHTML = renderOverviewSummary(overview);
      replaceLog(overviewLog, overview);
      if (currentSession) {
        currentSession = overview.sessions.find((session) => session.id === currentSession?.id) ?? currentSession;
      }
    } catch (error) {
      replaceLog(overviewLog, { error: error instanceof Error ? error.message : String(error) });
      overviewSummary.innerHTML = `<p class="subtle">Unable to load overview right now.</p>`;
    }
  }

  document.querySelector<HTMLButtonElement>("#refresh-overview-button")!.addEventListener("click", () => {
    void refreshOverview();
  });

  document.querySelector<HTMLButtonElement>("#pair-button")!.addEventListener("click", async () => {
    try {
      pairing = await client.pairDeviceBridge({
        workspace_id: WORKSPACE_ID,
        creator_id: CREATOR_ID,
        bridge_id: "bridge_demo",
        transport_public_key: (document.querySelector<HTMLInputElement>("#transport-key")!).value,
        device_name: (document.querySelector<HTMLInputElement>("#device-name")!).value,
        capability: (document.querySelector<HTMLSelectElement>("#capability")!).value as "vibrate" | "oscillate" | "rotate",
        max_intensity: Number((document.querySelector<HTMLInputElement>("#pairing-max-intensity")?.value) ?? "88")
      });
      appendLog(pairingLog, pairing);
      await refreshOverview();
    } catch (error) {
      appendLog(pairingLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#save-rule-button")!.addEventListener("click", async () => {
    try {
      const response = await client.updateRuleSet(DEFAULT_RULESET_ID, {
        workspace_id: WORKSPACE_ID,
        creator_id: CREATOR_ID,
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
      await refreshOverview();
    } catch (error) {
      appendLog(rulesLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#create-session-button")!.addEventListener("click", async () => {
    try {
      currentSession = await client.createSession({
        workspace_id: WORKSPACE_ID,
        creator_id: CREATOR_ID,
        device_id: (document.querySelector<HTMLInputElement>("#session-device-id")!).value,
        rule_set_id: (document.querySelector<HTMLInputElement>("#session-rule-id")!).value,
        max_intensity: Number((document.querySelector<HTMLInputElement>("#session-max-intensity")!).value),
        max_duration_ms: Number((document.querySelector<HTMLInputElement>("#session-max-duration")!).value)
      });
      appendLog(sessionLog, currentSession);
      attachSessionStream(currentSession.id, telemetryLog, refreshOverview);
      await refreshOverview();
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
      await refreshOverview();
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
      await refreshOverview();
    } catch (error) {
      appendLog(sessionLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#simulate-ack-button")!.addEventListener("click", async () => {
    if (!currentSession) {
      appendLog(telemetryLog, { error: "Create and arm a session first." });
      return;
    }
    try {
      const event = await client.publishSessionTelemetry(currentSession.id, {
        sequence: currentSession.sequence,
        status: "ack",
        executed_at: new Date().toISOString(),
        device_state: "command-accepted",
        latency_ms: 32
      });
      appendLog(telemetryLog, { companionTelemetry: event });
      await refreshOverview();
    } catch (error) {
      appendLog(telemetryLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#simulate-stop-button")!.addEventListener("click", async () => {
    if (!currentSession) {
      appendLog(telemetryLog, { error: "Create and arm a session first." });
      return;
    }
    try {
      const event = await client.publishSessionTelemetry(currentSession.id, {
        sequence: currentSession.sequence,
        status: "stopped",
        executed_at: new Date().toISOString(),
        device_state: "background-permission-lost",
        latency_ms: 0,
        stop_reason: "background permission lost"
      });
      appendLog(telemetryLog, { companionTelemetry: event });
      await refreshOverview();
    } catch (error) {
      appendLog(telemetryLog, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  void refreshOverview();
}

render();
