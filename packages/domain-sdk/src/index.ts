export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Workspace {
  id: string;
  name: string;
  region: string;
  createdAt: string;
}

export interface Creator {
  id: string;
  workspaceId: string;
  displayName: string;
  createdAt: string;
}

export interface DeviceBridge {
  id: string;
  workspaceId: string;
  creatorId: string;
  transport: "cloudflare-realtime" | "websocket-fallback";
  status: "paired" | "online" | "offline";
  fallbackWebsocketUrl: string;
  publicKey: string;
  transportPublicKey: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface Device {
  id: string;
  bridgeId: string;
  creatorId: string;
  name: string;
  capability: "vibrate" | "oscillate" | "rotate";
  maxIntensity: number;
  connected: boolean;
  updatedAt: string;
}

export interface RuleSet {
  id: string;
  workspaceId: string;
  creatorId: string;
  amountStepCents: number;
  intensityStep: number;
  maxIntensity: number;
  durationPerStepMs: number;
  maxDurationMs: number;
  cooldownMs: number;
  rateLimitPerMinute: number;
  patternId: string;
  enabled: boolean;
  updatedAt: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  creatorId: string;
  deviceId: string;
  ruleSetId: string;
  status: "pending" | "armed" | "stopped";
  maxIntensity: number;
  maxDurationMs: number;
  sequence: number;
  armedAt?: string;
  stopReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboundEventRequest {
  event_type: string;
  workspace_id: string;
  creator_id: string;
  source_id: string;
  amount: number;
  currency: string;
  occurred_at: string;
  idempotency_key: string;
  signature: string;
  metadata: Record<string, JsonValue>;
}

export interface PairDeviceBridgeRequest {
  workspace_id: string;
  creator_id: string;
  bridge_id?: string;
  bridge_name?: string;
  transport_public_key: string;
  device_name: string;
  capability: Device["capability"];
  max_intensity: number;
}

export interface PairDeviceBridgeResponse {
  bridge: DeviceBridge;
  device: Device;
  session_key_bundle: {
    server_transport_public_key: string;
    nonce: string;
    ciphertext: string;
  };
  server_signing_public_key: string;
}

export interface CreateSessionRequest {
  workspace_id: string;
  creator_id: string;
  device_id: string;
  rule_set_id: string;
  max_intensity: number;
  max_duration_ms: number;
}

export interface ArmSessionRequest {
  bridge_id: string;
  expires_in_ms: number;
}

export interface StopSessionRequest {
  reason: string;
}

export interface UpsertRuleSetRequest {
  workspace_id: string;
  creator_id: string;
  amount_step_cents: number;
  intensity_step: number;
  max_intensity: number;
  duration_per_step_ms: number;
  max_duration_ms: number;
  cooldown_ms: number;
  rate_limit_per_minute: number;
  pattern_id: string;
  enabled: boolean;
}

export interface ControlCommand {
  session_id: string;
  sequence: number;
  device_id: string;
  action: "apply" | "stop-all";
  intensity: number;
  duration_ms: number;
  pattern_id: string;
  nonce: string;
  issued_at: string;
  expires_at: string;
  ciphertext: string;
  signature: string;
}

export interface TelemetryEvent {
  session_id: string;
  sequence: number;
  status: "ack" | "executing" | "stopped" | "error";
  executed_at: string;
  device_state: string;
  latency_ms: number;
  error_code?: string;
  stop_reason?: string;
}

export interface IngestTelemetryRequest {
  sequence: number;
  status: TelemetryEvent["status"];
  executed_at?: string;
  device_state: string;
  latency_ms: number;
  error_code?: string;
  stop_reason?: string;
}

export interface UsageLedgerEntry {
  id: string;
  workspace_id: string;
  session_id: string;
  metric: string;
  units: number;
  occurred_at: string;
  metadata: Record<string, JsonValue>;
}

export interface AuditEvent {
  id: string;
  workspace_id: string;
  creator_id: string;
  session_id?: string;
  kind: string;
  actor: string;
  details: Record<string, JsonValue>;
  occurred_at: string;
}

export interface MetricsSnapshot {
  ack_count: number;
  ack_p50_ms: number;
  ack_p95_ms: number;
  webhook_failures: number;
  rule_rejections: number;
  panic_stops: number;
  per_region_failures: Record<string, number>;
}

export interface WorkspaceOverview {
  workspace: Workspace;
  creator: Creator;
  bridges: DeviceBridge[];
  devices: Device[];
  rulesets: RuleSet[];
  sessions: Session[];
  recent_usage: UsageLedgerEntry[];
  recent_audit: AuditEvent[];
  recent_telemetry: TelemetryEvent[];
  metrics: MetricsSnapshot;
  generated_at: string;
}

export interface ApiErrorShape {
  error: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const DEV_ENDPOINT_PRIVATE_KEY_DER_BASE64 =
  "MC4CAQAwBQYDK2VwBCIEIGvi8nZj54obWkUuDjOz2yRSkG5qKzj7F9yG5cV3qXQ3";
export const DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64 =
  "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A=";
export const DEV_WORKSPACE_API_KEY = "taas_demo_workspace_key";

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((acc, key) => {
        acc[key] = sortJson((value as Record<string, JsonValue>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(view).toString("base64");
  }
  let binary = "";
  view.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(input: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(input, "base64"));
  }
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toCryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function omitSignature(event: InboundEventRequest): Omit<InboundEventRequest, "signature"> {
  const { signature: _signature, ...rest } = event;
  return rest;
}

export function canonicalizeInboundEvent(event: InboundEventRequest): string {
  return JSON.stringify(sortJson(omitSignature(event) as unknown as JsonValue));
}

async function importPrivateKeyFromDer(base64Der: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    toCryptoBuffer(fromBase64(base64Der)),
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

async function importPublicKeyFromDer(base64Der: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    toCryptoBuffer(fromBase64(base64Der)),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

export async function signInboundEvent(
  unsignedEvent: Omit<InboundEventRequest, "signature">,
  privateKeyBase64 = DEV_ENDPOINT_PRIVATE_KEY_DER_BASE64
): Promise<InboundEventRequest> {
  const key = await importPrivateKeyFromDer(privateKeyBase64);
  const payload = canonicalizeInboundEvent({
    ...unsignedEvent,
    signature: ""
  });
  const signature = await crypto.subtle.sign("Ed25519", key, toCryptoBuffer(textEncoder.encode(payload)));
  return {
    ...unsignedEvent,
    signature: toBase64(signature)
  };
}

export async function verifyDetachedSignature(
  payload: string,
  signatureBase64: string,
  publicKeyBase64 = DEV_ENDPOINT_PUBLIC_KEY_DER_BASE64
): Promise<boolean> {
  const key = await importPublicKeyFromDer(publicKeyBase64);
  return crypto.subtle.verify(
    "Ed25519",
    key,
    toCryptoBuffer(fromBase64(signatureBase64)),
    toCryptoBuffer(textEncoder.encode(payload))
  );
}

export async function verifyCommandSignature(
  command: ControlCommand,
  publicKeyBase64: string
): Promise<boolean> {
  const payload = JSON.stringify({
    session_id: command.session_id,
    sequence: command.sequence,
    device_id: command.device_id,
    action: command.action,
    intensity: command.intensity,
    duration_ms: command.duration_ms,
    pattern_id: command.pattern_id,
    nonce: command.nonce,
    issued_at: command.issued_at,
    expires_at: command.expires_at,
    ciphertext: command.ciphertext
  });
  return verifyDetachedSignature(payload, command.signature, publicKeyBase64);
}

export class TaasClient {
  constructor(
    private readonly options: {
      baseUrl: string;
      apiKey?: string;
    }
  ) {}

  private buildHeaders(): HeadersInit {
    return this.options.apiKey
      ? {
          "Content-Type": "application/json",
          "X-Workspace-Api-Key": this.options.apiKey
        }
      : {
          "Content-Type": "application/json"
        };
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(new URL(path, this.options.baseUrl), init);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({ error: response.statusText }))) as ApiErrorShape;
      throw new Error(body.error ?? response.statusText);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  pairDeviceBridge(request: PairDeviceBridgeRequest): Promise<PairDeviceBridgeResponse> {
    return this.request("/v1/device-bridges/pair", {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  createSession(request: CreateSessionRequest): Promise<Session> {
    return this.request("/v1/sessions", {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  armSession(sessionId: string, request: ArmSessionRequest): Promise<Session> {
    return this.request(`/v1/sessions/${sessionId}/arm`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  stopSession(sessionId: string, request: StopSessionRequest): Promise<Session> {
    return this.request(`/v1/sessions/${sessionId}/stop`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  createRuleSet(request: UpsertRuleSetRequest): Promise<RuleSet> {
    return this.request("/v1/rulesets", {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  updateRuleSet(ruleSetId: string, request: UpsertRuleSetRequest): Promise<RuleSet> {
    return this.request(`/v1/rulesets/${ruleSetId}`, {
      method: "PUT",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  submitInboundEvent(request: InboundEventRequest): Promise<{
    accepted: boolean;
    command: ControlCommand;
    usage: UsageLedgerEntry;
  }> {
    return this.request("/v1/inbound-events", {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  streamSession(
    sessionId: string,
    handlers: {
      onMessage: (event: TelemetryEvent) => void;
      onError?: (error: Event) => void;
    }
  ): EventSource {
    const source = new EventSource(new URL(`/v1/sessions/${sessionId}/stream`, this.options.baseUrl));
    source.addEventListener("telemetry", (event) => {
      const messageEvent = event as MessageEvent<string>;
      handlers.onMessage(JSON.parse(messageEvent.data) as TelemetryEvent);
    });
    source.onerror = (error) => {
      handlers.onError?.(error);
    };
    return source;
  }

  publishSessionTelemetry(sessionId: string, request: IngestTelemetryRequest): Promise<TelemetryEvent> {
    return this.request(`/v1/sessions/${sessionId}/telemetry`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(request)
    });
  }

  getWorkspaceOverview(workspaceId: string, creatorId: string): Promise<WorkspaceOverview> {
    const path = `/v1/workspaces/${workspaceId}/overview?${new URLSearchParams({
      creator_id: creatorId
    }).toString()}`;
    return this.request(path, {
      method: "GET",
      headers: this.buildHeaders()
    });
  }
}

export function buildHostedControlEvent(
  sessionId: string,
  amount: number,
  currency = "USD"
): Omit<InboundEventRequest, "signature"> {
  return {
    event_type: "tip.received",
    workspace_id: "ws_demo",
    creator_id: "cr_demo",
    source_id: sessionId,
    amount,
    currency,
    occurred_at: new Date().toISOString(),
    idempotency_key: `${sessionId}-${Date.now()}-${Math.round(amount * 100)}`,
    metadata: {
      channel: "hosted-control",
      session_id: sessionId
    }
  };
}

export function decodeBase64(input: string): string {
  return textDecoder.decode(fromBase64(input));
}
