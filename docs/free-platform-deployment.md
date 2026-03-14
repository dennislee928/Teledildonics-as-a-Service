# Free Platform Deployment Plan for TaaS

This document maps free hosting and automation resources to the current TaaS repository and proposes a practical rollout path for public demos, compatibility testing, and supporting jobs.

Verified against provider documentation on **March 14, 2026**. Free-tier limits change often, so treat all quotas as time-sensitive.

Detailed step-by-step runbooks:

- [`docs/runbooks/koyeb-deploy.md`](./runbooks/koyeb-deploy.md)
- [`docs/runbooks/huggingface-spaces-deploy.md`](./runbooks/huggingface-spaces-deploy.md)

---

## 1. What this repo needs

The current repository has four deployable surfaces:

- `cmd/control-api`: the Go control plane and public HTTP API
- `/demo/hosted-control/`: fan-facing browser demo
- `/demo/creator-console/`: creator-facing browser demo
- `apps/companion/src-tauri`: companion shell for creator devices, which is **not** something we host on a VPS/PaaS

For the current codebase, the most important deployment constraint is simple:

- the public demo works best when the Go API and the two static browser demos are served from the **same origin**
- the current relay and state layers are still **in-memory**, so free hosts are fine for demos but not for real creator traffic
- the future always-on realtime relay is a worse fit for sleepy or heavily serverless free tiers

---

## 2. Primary free-platform fit

| Platform | Best role for TaaS | Verified current baseline | Recommendation |
|----------|--------------------|---------------------------|----------------|
| Koyeb | Primary public demo host | 1 free web service, 512 MB RAM, 0.1 vCPU, 2 GB SSD; current pricing FAQ also says account validation requires a payment method | Best first public host |
| Hugging Face Spaces | Public browser demo mirror | Docker Spaces supported; free CPU Basic gives 2 vCPU, 16 GB RAM, 50 GB non-persistent disk; Docker Spaces default to port `7860` unless `app_port` is set | Best secondary demo host |
| Serv00 | Low-resource compatibility and ops lab | 3 GB SSD, 512 MB RAM, SSH, TCP/UDP ports, FreeBSD shell; inactive accounts are deleted after 3 months without panel or SSH login | Best harsh-environment test bed |
| Back4App Containers | Backup Docker preview target | Free container tier currently shows 0.25 CPU, 256 MB RAM, 100 GB transfer, GitHub deploys, custom Docker containers | Acceptable secondary preview host |
| Alwaysdata | Tiny control-plane sandbox | Public Cloud pricing page currently shows Free = 256 MB RAM and 1 GB disk; the docs also note special restrictions on free cloud usage | Useful only for very small experiments |
| Deta Space | JS/Python micro-apps only | Runtime model is micro-cloud / serverless-oriented and is still a poor fit for this Go long-running control plane | Do not use as the primary TaaS host |

### Important corrections to the older draft

- `Koyeb`: the older “no credit card” assumption is no longer safe. As of the current pricing FAQ, the free service still exists, but account validation now explicitly mentions payment-method verification.
- `Hugging Face Spaces`: the official docs clearly confirm Docker support and free `CPU Basic` hardware, but the disk is **non-persistent by default**.
- `Back4App`: current pricing shows `256 MB` RAM and `0.25 CPU`, not `250 MB` and `0.1 vCPU`.
- `Alwaysdata`: the currently documented public-cloud free plan is closer to `256 MB RAM / 1 GB disk` than the older `512 MB / 100 MB` shorthand.

---

## 3. TaaS-specific deployment mapping

### 3.1 Public control plane and demo URLs

Use `Koyeb` first.

- Deploy the repository root `Dockerfile`.
- Let one service host:
  - `/`
  - `/healthz`
  - `/demo/hosted-control/`
  - `/demo/creator-console/`
  - `/v1/*`
- Runtime env:
  - `PORT=8080`
  - `STATIC_ROOT=/srv/taas`

Why this is the best fit:

- the current repo already builds into a single container
- the browser demos stay same-origin with the Go API
- Koyeb’s documented Dockerfile build path matches the way this repository is packaged

### 3.2 Public browser showcase for low-friction demos

Use `Hugging Face Spaces` as a mirror, not as the source of truth.

- Create a Docker Space.
- Reuse the same container image logic or the same repo contents.
- Set the Space to Docker SDK and declare `app_port: 8080` in the Space README metadata.
- For the current image, keep:
  - `PORT=8080`
  - `STATIC_ROOT=/srv/taas`
- If you create a dedicated Space repo, set README metadata with:
  - `sdk: docker`
  - `app_port: 8080`

Why this is the right role:

- it is excellent for a clickable browser demo
- it is a worse fit for reliable webhook intake or real-time creator sessions because free Spaces are optimized for demos, not always-on control traffic

### 3.3 Compatibility and constrained-host testing

Use `Serv00`.

- Build frontend assets locally with `npm run build`.
- Build the Go binary locally with `CGO_ENABLED=0 go build -o control-api ./cmd/control-api`.
- Upload:
  - the compiled `control-api` binary
  - `apps/creator-console`
  - `apps/hosted-control`
- Run with:
  - `STATIC_ROOT=<uploaded root>`
  - `CONTROL_API_ADDR=:8080` or another allowed port

Best use cases:

- test low-memory behavior
- test old-school shell workflows
- validate the project still works without container conveniences

### 3.4 Backup Docker preview host

Use `Back4App Containers` only as a secondary preview.

- Deploy the root `Dockerfile`.
- Keep traffic low and treat it as disposable.
- Use it for:
  - backup demo URL
  - smoke test environment
  - stakeholder preview outside your primary host

### 3.5 Tiny control-plane experiments

Use `Alwaysdata` only if you want to test “smallest possible hosted API”.

- Deploy only the Go API and static demo assets.
- Do not treat it as the full TaaS production shape.
- Keep logs and artifacts minimal.

---

## 4. Other useful free resources by service role

These are not my first choice for the main TaaS demo host, but some are very good for supporting components.

### 4.1 Event intake, schedules, and glue code

| Platform | Best TaaS use | Why |
|----------|---------------|-----|
| Windmill | Scheduled keepalive jobs, webhook replay, internal ops tooling | Official docs show first-class schedules, webhooks, scripts in Go/TS/Python, and trigger-based automation |
| Pipedream | Webhook fan-in, notification flows, payment-event glue | Official docs show HTTP/webhook triggers and scheduler triggers, plus code steps in Node/Python/Go/Bash |
| Val Town | Tiny transforms or notification webhooks | Good for very small TypeScript helper endpoints, not for the control plane itself |

### 4.2 Edge verification and crypto experiments

| Platform | Best TaaS use | Why |
|----------|---------------|-----|
| Deno Deploy | Event verification, token minting, cron-style edge helpers | Official site highlights JS/TS app hosting, cron jobs, GitHub deploys, and edge-style runtimes |
| Fermyon Cloud | Wasm-based signature verification or policy gates | Official site positions it as a free starter host for Wasm apps with very fast cold starts |

### 4.3 Multi-component app platforms

| Platform | Best TaaS use | Why |
|----------|---------------|-----|
| Choreo | Exploring a split control plane with multiple components and visual topology | Official pricing shows 5 free components, but official limitations also show one public port per web app and a 15-minute maximum WebSocket connection duration, so it is a poor fit for the actual realtime relay |
| Leapcell | Bursty webhook ingestion or auxiliary APIs | Official docs describe both serverless and persistent services; better for bursty HTTP than for the long-lived relay path |
| Genezio | Only if you later rewrite the public API into TypeScript-heavy serverless endpoints | Their current positioning is strongest for serverless JS/TS backends and generated SDKs, not this Go-first control plane |
| Adaptable.io | Candidate only if you want a repo-driven app plus bundled data store | Worth revisiting later, but I did not find enough current official quota detail to recommend it as a primary path today |

### 4.4 Full control / future growth

| Platform | Best TaaS use | Why |
|----------|---------------|-----|
| KubeSail | Later-stage self-managed deployment with Kubernetes control | Good only after the free demo phase, when you want long-lived multi-service control and full YAML ownership |

---

## 5. Recommended rollout plan

### Phase 1: Public demo now

Use `Koyeb`.

- Deploy the root `Dockerfile`
- Verify:
  - `/healthz`
  - `/demo/hosted-control/`
  - `/demo/creator-console/`
- Treat this as the public MVP demo URL

### Phase 2: Browser-only mirror

Use `Hugging Face Spaces`.

- Create a Docker Space
- Point it at the same code or a demo branch
- Set `app_port` to `8080`
- Use this for “click and try” demos, not for webhook reliability

### Phase 3: Constrained-environment proof

Use `Serv00`.

- Upload the built binary and static assets
- Run the Go API manually
- Record memory and runtime behavior for credibility with technical users or investors

### Phase 4: Automation sidecars

Use `Windmill` or `Pipedream`.

- replay test events into `/v1/inbound-events`
- schedule keepalive or health pings
- fan out deploy notifications or smoke tests

### Phase 5: Edge security experiments

Use `Deno Deploy` or `Fermyon Cloud`.

- experiment with detached-signature verification
- test token pre-validation close to users
- keep this separate from the core Go control plane until the architecture hardens

---

## 6. What not to do on free tiers

- Do not run the future realtime relay as if a free sleepy platform were production-ready.
- Do not depend on free-host local disk for long-lived state.
- Do not assume Koyeb signup is still card-free.
- Do not make Hugging Face Spaces your only inbound webhook endpoint.
- Do not host the Tauri companion on these services; distribute it as a client app instead.

---

## 7. Source links

Primary platforms:

- Koyeb pricing FAQ: https://www.koyeb.com/docs/faqs/pricing
- Koyeb build from Git / Dockerfile: https://www.koyeb.com/docs/build-and-deploy/build-from-git
- Hugging Face Spaces overview: https://huggingface.co/docs/hub/en/spaces-overview
- Hugging Face Docker Spaces: https://huggingface.co/docs/hub/main/en/spaces-sdks-docker
- Hugging Face Spaces config reference: https://huggingface.co/docs/hub/en/spaces-config-reference
- Back4App Containers pricing: https://www.back4app.com/pricing/container-as-a-service
- alwaysdata public cloud pricing: https://help.alwaysdata.com/en/accounts/billing/public-cloud-prices/
- Serv00 homepage: https://www.serv00.com/
- Serv00 inactivity policy forum post: https://forum.serv00.com/d/1-serv00com-a-revolution-among-free-hostings

Secondary platforms:

- Choreo pricing: https://wso2.com/choreo/pricing
- Choreo limitations: https://wso2.com/choreo/docs/references/choreo-limitations/
- Leapcell docs: https://docs.leapcell.io/
- Leapcell service overview: https://docs.leapcell.io/service/
- Genezio deployment platform: https://genezio.com/deployment-platform/
- Windmill scheduling: https://www.windmill.dev/docs/core_concepts/scheduling
- Windmill triggers: https://www.windmill.dev/docs/getting_started/triggers
- Pipedream triggers: https://pipedream.com/docs/sources
- Pipedream workflows: https://pipedream.com/docs/workflows
- Deno Deploy: https://deno.com/deploy
- Fermyon Cloud: https://www.fermyon.com/cloud

---

This plan is designed for the current TaaS repository state, where persistence and relay are still demo-grade. When the control plane outgrows free hosting, the next move should be managed Postgres/Redis plus a proper long-lived realtime deployment, not more free-tier juggling.
