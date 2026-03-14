# TaaS Execution Backlog

## Current State
- Monorepo shape is in place: Go control API, TypeScript SDKs and demos, Rust companion core, and Tauri shell.
- The repo currently passes `go test ./...`, `npm test`, and `cargo test -p companion-core`.
- The backend is the most complete layer. The relay and companion paths are still mock-backed. A few demo and contract gaps block a credible end-to-end baseline.

## Success Criteria
- Public demo works from a fresh checkout without manual data surgery.
- Browser, API, and companion contracts line up on auth, signed commands, and telemetry flow.
- Demo-only shortcuts are explicit and isolated from production-shaped paths.
- Stateful backends and deploy targets are covered by automated validation, not just local smoke tests.

## Phase 1: Demo And API Contract Fixes
Status: `in progress`

- [x] Convert this document from a strategy memo into an execution backlog.
- [x] Make session SSE usable from browsers while keeping workspace auth enforced.
- [x] Enforce inbound source allowlisting in the rules engine.
- [x] Seed a working demo session so `/demo/hosted-control/` has a valid default target.
- [x] Add tests for the new auth and rules-engine behavior.
- [ ] Add a follow-up integration test that exercises hosted-control against a real running API process.

Exit criteria:
- Hosted-control can submit against the seeded demo session without creating IDs manually.
- Session stream auth works from the browser SDK.
- Disallowed inbound sources are rejected before command dispatch.

## Phase 2: Companion Trust Boundary
Status: `pending`

- [ ] Verify Ed25519 command signatures inside `companion-core` before decrypt/apply.
- [ ] Ensure `stop-all` and all terminal runtime states emit telemetry consistently.
- [ ] Replace hard-coded Tauri bootstrap state with real pairing and session bootstrap inputs.
- [ ] Add companion tests for invalid signatures, expired payloads, and stop-all delivery.

Exit criteria:
- The companion runtime refuses unsigned or tampered commands.
- Panic stop and background-loss paths always publish telemetry.

## Phase 3: Real Relay Transport
Status: `pending`

- [ ] Replace the mock Cloudflare adapter pass-through with a real transport implementation or an authenticated fallback WebSocket.
- [ ] Define bridge-scoped auth for telemetry ingestion instead of reusing workspace API keys.
- [ ] Add a transport smoke test for `inbound event -> encrypted command -> telemetry ack`.
- [ ] Document demo-mode transport shortcuts versus production transport requirements.

Exit criteria:
- Relay behavior is no longer purely in-memory for the primary execution path.
- Telemetry can come back through an authenticated bridge-facing path.

## Phase 4: Persistence And Operational Hardening
Status: `pending`

- [ ] Add integration coverage for Postgres repository behavior.
- [ ] Add integration coverage for Redis runtime behavior.
- [ ] Expose a stable metrics and health surface for deployment targets.
- [ ] Add migration and seed behavior checks for repeated startup on persistent backends.

Exit criteria:
- Repeated startup against Postgres and Redis is safe.
- Metrics and health are sufficient for hosted demo operations.

## Phase 5: CI And Release Hygiene
Status: `pending`

- [ ] Add GitHub Actions for Go, Node, and Rust test suites.
- [ ] Add a workflow that builds the demo container image on pull requests.
- [ ] Fail CI on workspace contract regressions between API and SDK types.
- [ ] Publish a short developer runbook for local demo validation.

Exit criteria:
- Every PR gets automated build and test coverage across all three stacks.

## Known Risks To Track
- Demo seeding can drift from real consent and pairing flows if it is not clearly isolated as demo-only behavior.
- Browser SSE auth via query parameter is acceptable for demo use but should be replaced by a short-lived stream token or cookie-backed session for harder production paths.
- The relay and companion are still not wired together end-to-end, so current green tests do not prove live command execution on a real device path.
