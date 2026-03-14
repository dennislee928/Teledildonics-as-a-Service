# TaaS Monorepo

Teledildonics-as-a-Service (TaaS) is a production-oriented baseline for secure, low-latency remote control sessions. This repository ships a greenfield monorepo with:

- `cmd/control-api`: Go control plane with session lifecycle, rules engine, signed inbound events, streaming telemetry, and a relay abstraction.
- `packages/domain-sdk`: shared browser/server SDK contracts for the public API.
- `packages/embed-sdk`: embeddable widget SDK for fan-facing control surfaces.
- `apps/creator-console`: creator operations shell for pairing devices, managing rules, arming sessions, and watching telemetry.
- `apps/hosted-control`: hosted control page demo that signs and submits events.
- `crates/companion-core`: Rust runtime for companion apps, including device and relay traits plus safety state transitions.
- `apps/companion/src-tauri`: Tauri v2 shell that wraps the shared companion core.

## Development

1. Install JavaScript dependencies:

```bash
npm install
```

2. Start backing services if you want external state stores later:

```bash
docker compose up -d
```

3. Run the Go API:

```bash
go run ./cmd/control-api
```

4. Build the web packages and apps:

```bash
npm run build
```

5. Run tests:

```bash
go test ./...
npm test
cargo test -p companion-core
```

## Demo IDs

The Go API seeds a deterministic demo workspace and creator:

- Workspace: `ws_demo`
- Creator: `cr_demo`
- Device bridge: `bridge_demo`
- Device: `device_demo`
- Rule set: `rule_demo`
- Inbound endpoint: `endpoint_demo`

The browser apps use a development Ed25519 keypair that matches the seeded endpoint public key. Do not reuse that keypair outside local development.

## Architecture Notes

- Control commands are encrypted with AES-256-GCM and signed with Ed25519.
- Pairing uses an X25519 transport key from the companion to wrap the session key returned by `POST /v1/device-bridges/pair`.
- Session state is zero-trust by default: disarm, token expiry, runtime background loss, or explicit panic stop all collapse into `stop-all`.
- The relay abstraction defaults to an in-memory local transport for development and a Cloudflare/Pion shaped adapter for production wiring.

