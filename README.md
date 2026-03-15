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

2. Copy the local environment template:

```bash
cp .env.example .env
```

3. Run the Go API in memory mode:

```bash
scripts/run-control-api.sh memory
```

4. If you want stateful local development, start the Postgres and Redis adapters instead:

```bash
scripts/run-control-api.sh stateful
```

5. Build the web packages and apps:

```bash
npm run build
```

6. Run tests:

```bash
go test ./...
npm test
cargo test -p companion-core
```

To include the stateful backend integration tests, point the suite at running Postgres and Redis instances first:

```bash
export TAAS_TEST_POSTGRES_DSN=postgres://taas:taas@localhost:5432/taas?sslmode=disable
export TAAS_TEST_REDIS_URL=redis://localhost:6379
go test ./...
```

## Workspace API Keys

All `/v1/*` routes now require a workspace-scoped API key in the `X-Workspace-Api-Key` header.

- Local seeded workspace: `ws_demo`
- Local seeded creator: `cr_demo`
- Local development API key: `taas_demo_workspace_key`

Example:

```bash
curl -H 'X-Workspace-Api-Key: taas_demo_workspace_key' \
  'http://127.0.0.1:8080/v1/workspaces/ws_demo/overview?creator_id=cr_demo'
```

Bridge-facing transport routes live under `/bridge/v1/*` instead. They use a session grant token derived from the session key and current bridge grant, not a workspace API key. See [`docs/relay-transport.md`](./docs/relay-transport.md) for the transport contract and the current demo-vs-production caveats.

You can switch persistence layers with:

- `STORE_REPOSITORY_BACKEND=memory|postgres`
- `STORE_RUNTIME_BACKEND=memory|redis`

## Deploying a Single Public Demo

The repository now includes a root `Dockerfile` that builds the Go control API and the two browser demos into one container. When the API starts with `STATIC_ROOT` pointing at the copied app directory, it serves:

- `/demo/hosted-control/`
- `/demo/creator-console/`
- `/healthz`
- `/readyz`
- `/metrics`

See [`docs/free-platform-deployment.md`](./docs/free-platform-deployment.md) for platform-specific notes across Koyeb, Hugging Face Spaces, Serv00, Back4App, Alwaysdata, and Deta Space.
For hands-on deployment steps, use:

- [`docs/runbooks/koyeb-deploy.md`](./docs/runbooks/koyeb-deploy.md)
- [`docs/runbooks/huggingface-spaces-deploy.md`](./docs/runbooks/huggingface-spaces-deploy.md)

Shared deploy defaults:

- copy [`.env.deploy.example`](./.env.deploy.example) to `.env.deploy`
- adjust [`koyeb.yaml`](./koyeb.yaml) if you want repo-local Koyeb manifest defaults
- use [`.github/workflows/deploy-koyeb.yml`](./.github/workflows/deploy-koyeb.yml) to auto-deploy the Koyeb demo from `main`
- use [`.github/workflows/deploy-hf-space.yml`](./.github/workflows/deploy-hf-space.yml) to auto-deploy the demo Space from `main`

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
- The relay abstraction now queues signed commands per session and exposes a bridge-facing fallback websocket contract at `/bridge/v1/sessions/{session_id}/connect`, while telemetry returns through `/bridge/v1/sessions/{session_id}/telemetry`.
- The current fallback transport is still demo-grade because the queue is process-local memory; production wiring still needs persistent relay state and a real Cloudflare/WebRTC transport.
