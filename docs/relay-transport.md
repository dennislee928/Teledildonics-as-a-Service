# Relay Transport Contract

## Current Shape

The control plane now exposes two separate auth surfaces:

- Workspace routes under `/v1/*` use `X-Workspace-Api-Key`.
- Bridge routes under `/bridge/v1/*` use `X-Bridge-Token`.

The bridge token is derived from the active session grant, not reused from the workspace key:

```text
base64url(hmac-sha256(session_key, "bridge-token:v1:" + session_id + ":" + bridge_id))
```

That token currently authenticates:

- `GET /bridge/v1/sessions/{session_id}/connect`
- `POST /bridge/v1/sessions/{session_id}/telemetry`

## Demo-Mode Shortcuts

- Command delivery is queued in process memory inside the relay adapter. If the API process restarts, queued commands are lost.
- The fallback websocket route is session-scoped, not a long-lived multi-session bridge channel.
- Telemetry ingest still trusts possession of the session-derived bridge token and the stored grant record. This is enough for the demo path, but it is not a hardened production credential lifecycle.
- The seeded demo bridge advertises a websocket template URL with `{session_id}` because pairing happens before a specific session is armed.

## Production Requirements

- Back queued command delivery with durable relay state instead of process-local memory.
- Replace the fallback websocket session channel with the intended Cloudflare/WebRTC transport, or keep the websocket path only as an explicit degraded-mode transport.
- Issue short-lived bridge connect credentials rather than relying on a reusable session-derived token for the whole grant lifetime.
- Separate final stop telemetry acceptance from active command delivery credentials so a revoked session can still report its terminal state without widening replay scope.
- Add explicit relay health and queue depth metrics before treating the transport as operationally ready.
