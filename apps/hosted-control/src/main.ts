import {
  TaasClient,
  buildHostedControlEvent,
  signInboundEvent,
  type InboundEventRequest
} from "@taas/domain-sdk";
import { mountControlWidget } from "@taas/embed-sdk";

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
  baseUrl: resolveApiBaseUrl()
});

let latestEvent: InboundEventRequest | null = null;

function updateLog(target: HTMLElement, payload: unknown): void {
  target.textContent = JSON.stringify(payload, null, 2);
}

function render(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    return;
  }

  app.innerHTML = `
    <main>
      <section class="hero">
        <span class="kicker">Hosted Control Page</span>
        <h1>Submit signed fan events, not raw actuator commands.</h1>
        <p>
          This page demonstrates the provider-neutral event envelope and the embeddable widget.
          The Go API maps these events through the server-side rules engine into encrypted commands.
        </p>
      </section>

      <section class="layout">
        <article class="card control-grid">
          <span class="kicker">Direct Event Submission</span>
          <h2>Send a signed event</h2>
          <label>
            Session ID
            <input id="session-id" value="session_demo" />
          </label>
          <label>
            Amount
            <input id="amount" type="number" min="0.5" step="0.01" value="4.99" />
          </label>
          <div class="preset-row">
            <button id="send-event">Send signed tip</button>
            <button id="quick-pulse" class="secondary">Quick pulse</button>
            <button id="long-surge" class="secondary">Long surge</button>
          </div>
          <pre id="event-log">No event submitted yet.</pre>
        </article>

        <article class="card widget-host">
          <span class="kicker">Embeddable JS SDK</span>
          <h2>Widget preview</h2>
          <div id="widget-slot"></div>
        </article>
      </section>
    </main>
  `;

  const log = document.querySelector<HTMLElement>("#event-log")!;
  const sessionInput = document.querySelector<HTMLInputElement>("#session-id")!;
  const amountInput = document.querySelector<HTMLInputElement>("#amount")!;

  async function submit(amount: number): Promise<void> {
    const sessionId = sessionInput.value;
    const unsignedEvent = buildHostedControlEvent(sessionId, amount);
    latestEvent = await signInboundEvent(unsignedEvent);
    const response = await client.submitInboundEvent(latestEvent);
    updateLog(log, {
      submittedEvent: latestEvent,
      mappedCommand: response.command,
      usage: response.usage
    });
  }

  document.querySelector<HTMLButtonElement>("#send-event")!.addEventListener("click", async () => {
    try {
      await submit(Number(amountInput.value));
    } catch (error) {
      updateLog(log, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#quick-pulse")!.addEventListener("click", async () => {
    try {
      await submit(1.99);
    } catch (error) {
      updateLog(log, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  document.querySelector<HTMLButtonElement>("#long-surge")!.addEventListener("click", async () => {
    try {
      await submit(9.99);
    } catch (error) {
      updateLog(log, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  mountControlWidget({
    target: document.querySelector<HTMLElement>("#widget-slot")!,
    client,
    sessionId: sessionInput.value
  });
}

render();
