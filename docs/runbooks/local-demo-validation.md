# Local Demo Validation

This runbook verifies the local control API, browser demos, OpenAPI docs, and cross-stack test suites from a fresh checkout.

## Prerequisites

- Node.js 24+
- Go 1.25+
- Rust stable
- Docker, if you want to run the stateful backend checks locally

## Baseline Validation

1. Install JavaScript dependencies:

```bash
npm ci
```

2. Start the control API with in-memory backends:

```bash
scripts/run-control-api.sh memory
```

3. In a second shell, build the browser packages and demos:

```bash
npm run build
```

4. Confirm the API surface is live:

```bash
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/readyz
curl http://127.0.0.1:8080/metrics
curl http://127.0.0.1:8080/openapi.json
open http://127.0.0.1:8080/docs/
```

5. Smoke-test the seeded workspace:

```bash
curl -H 'X-Workspace-Api-Key: taas_demo_workspace_key' \
  'http://127.0.0.1:8080/v1/workspaces/ws_demo/overview?creator_id=cr_demo'

curl -H 'X-Workspace-Api-Key: taas_demo_workspace_key' \
  'http://127.0.0.1:8080/v1/workspaces/ws_demo/insights/hot-zones?creator_id=cr_demo'
```

6. Run the automated contract and unit suites:

```bash
npm run contract-check
env GOCACHE=/tmp/taas-go-build go test ./...
npm test
cargo test -p companion-core
```

## Stateful Validation

Start Postgres and Redis locally, then launch the control API in stateful mode:

```bash
scripts/run-control-api.sh stateful
```

Run the env-gated backend coverage:

```bash
export TAAS_TEST_POSTGRES_DSN='postgres://taas:taas@127.0.0.1:5432/taas?sslmode=disable'
export TAAS_TEST_REDIS_URL='redis://127.0.0.1:6379'
env GOCACHE=/tmp/taas-go-build go test ./internal/store ./internal/api ./internal/service
```

## Expected Endpoints

- API landing page: `http://127.0.0.1:8080/`
- Swagger UI: `http://127.0.0.1:8080/docs/`
- Raw OpenAPI spec: `http://127.0.0.1:8080/openapi.json`
- Hosted control demo: `http://127.0.0.1:8080/demo/hosted-control/`
- Creator console demo: `http://127.0.0.1:8080/demo/creator-console/`
