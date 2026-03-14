import {
  type InboundEventRequest,
  TaasClient,
  buildHostedControlEvent,
  signInboundEvent
} from "@taas/domain-sdk";

export interface MountWidgetOptions {
  target: HTMLElement;
  client: TaasClient;
  sessionId: string;
  currency?: string;
}

async function submitPreset(
  client: TaasClient,
  sessionId: string,
  amount: number,
  currency: string
): Promise<InboundEventRequest> {
  const signedEvent = await signInboundEvent(
    buildHostedControlEvent(sessionId, amount, currency)
  );
  await client.submitInboundEvent(signedEvent);
  return signedEvent;
}

export function mountControlWidget(options: MountWidgetOptions): void {
  const { target, client, sessionId, currency = "USD" } = options;
  target.innerHTML = "";

  const panel = document.createElement("section");
  panel.className = "taas-embed-widget";
  panel.innerHTML = `
    <div class="taas-embed-card">
      <span class="taas-embed-kicker">Embeddable Widget</span>
      <h2>Pulse the live session</h2>
      <p>Submit signed control events without exposing raw actuator commands.</p>
      <div class="taas-embed-actions">
        <button data-amount="1.99">Quick Pulse</button>
        <button data-amount="4.99">Climax Boost</button>
        <button data-amount="9.99">Long Surge</button>
      </div>
      <pre data-log></pre>
    </div>
  `;

  panel.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", async () => {
      const amount = Number((button as HTMLButtonElement).dataset.amount ?? "0");
      const log = panel.querySelector("[data-log]") as HTMLElement;
      try {
        const signedEvent = await submitPreset(client, sessionId, amount, currency);
        log.textContent = JSON.stringify(signedEvent, null, 2);
      } catch (error) {
        log.textContent = error instanceof Error ? error.message : String(error);
      }
    });
  });

  target.appendChild(panel);
}

