package api

import (
	"bytes"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

const devPrivateKeyDER = "MC4CAQAwBQYDK2VwBCIEIGvi8nZj54obWkUuDjOz2yRSkG5qKzj7F9yG5cV3qXQ3"

func TestHostedControlFlowOverHTTP(t *testing.T) {
	server := newTestServerWithStaticRoot(t, repoRoot(t))
	staticRequest := httptest.NewRequest("GET", "/demo/hosted-control/", nil)
	staticRecorder := httptest.NewRecorder()
	server.Handler().ServeHTTP(staticRecorder, staticRequest)
	if staticRecorder.Code != 200 {
		t.Fatalf("expected hosted control 200, got %d", staticRecorder.Code)
	}
	if !strings.Contains(staticRecorder.Body.String(), "TaaS Hosted Control") {
		t.Fatalf("expected hosted control page shell")
	}

	event, err := newSignedInboundEvent(domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    "ws_demo",
		CreatorID:      "cr_demo",
		SourceID:       "session_demo",
		Amount:         4.99,
		Currency:       "USD",
		OccurredAt:     time.Now().UTC(),
		IdempotencyKey: "evt-http-integration",
		Metadata: map[string]any{
			"channel": "hosted-control",
		},
	})
	if err != nil {
		t.Fatalf("sign event: %v", err)
	}

	requestBody, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}

	request := httptest.NewRequest("POST", "/v1/inbound-events", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Workspace-Api-Key", service.DevWorkspaceAPIKey)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != 202 {
		t.Fatalf("expected 202, got %d", response.Code)
	}

	var payload struct {
		Accepted bool                    `json:"accepted"`
		Command  domain.ControlCommand   `json:"command"`
		Usage    domain.UsageLedgerEntry `json:"usage"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !payload.Accepted {
		t.Fatalf("expected event to be accepted")
	}
	if payload.Command.SessionID != "session_demo" {
		t.Fatalf("expected command session_demo, got %s", payload.Command.SessionID)
	}
	if payload.Command.Action != domain.ActionApply {
		t.Fatalf("expected apply action, got %s", payload.Command.Action)
	}
	if payload.Usage.SessionID != "session_demo" {
		t.Fatalf("expected usage session_demo, got %s", payload.Usage.SessionID)
	}
}

func TestBridgeTransportFlow(t *testing.T) {
	server := newBridgeTransportServer(t, repoRoot(t))

	grant, err := server.repo.GetGrantBySession("session_demo")
	if err != nil {
		t.Fatalf("get grant: %v", err)
	}
	bridgeRelay, ok := server.service.Relay().(relay.BridgeSessionRelay)
	if !ok {
		t.Fatalf("expected bridge session relay support")
	}
	commands, cancel, err := bridgeRelay.SubscribeBridgeSession("session_demo", grant.BridgeID)
	if err != nil {
		t.Fatalf("subscribe bridge session: %v", err)
	}
	defer cancel()

	event, err := newSignedInboundEvent(domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    "ws_demo",
		CreatorID:      "cr_demo",
		SourceID:       "session_demo",
		Amount:         4.99,
		Currency:       "USD",
		OccurredAt:     time.Now().UTC(),
		IdempotencyKey: "evt-bridge-transport",
		Metadata: map[string]any{
			"channel": "hosted-control",
		},
	})
	if err != nil {
		t.Fatalf("sign event: %v", err)
	}
	requestBody, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	request := httptest.NewRequest(http.MethodPost, "/v1/inbound-events", bytes.NewReader(requestBody))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Workspace-Api-Key", service.DevWorkspaceAPIKey)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", response.Code)
	}

	var command domain.ControlCommand
	select {
	case command = <-commands:
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for bridge command")
	}
	if command.SessionID != "session_demo" {
		t.Fatalf("expected session_demo command, got %s", command.SessionID)
	}
	signingPublicKey, err := secure.NewEngine([]byte("taas-server-signing")).ServerSigningPublicKeySPKI()
	if err != nil {
		t.Fatalf("server signing key: %v", err)
	}
	if err := secure.VerifyCommandSignature(command, signingPublicKey); err != nil {
		t.Fatalf("verify command signature: %v", err)
	}
	decrypted, err := secure.DecryptCommandPayload(command, grant.SessionKey)
	if err != nil {
		t.Fatalf("decrypt command payload: %v", err)
	}
	if decrypted.Action != domain.ActionApply {
		t.Fatalf("expected apply payload, got %s", decrypted.Action)
	}

	bridgeToken := secure.DeriveBridgeToken("session_demo", grant.BridgeID, grant.SessionKey)
	telemetryBody, err := json.Marshal(domain.IngestTelemetryRequest{
		Sequence:    command.Sequence,
		Status:      domain.TelemetryAck,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "command-accepted",
		LatencyMS:   31,
	})
	if err != nil {
		t.Fatalf("marshal telemetry: %v", err)
	}
	telemetryRequest := httptest.NewRequest(http.MethodPost, "/bridge/v1/sessions/session_demo/telemetry", bytes.NewReader(telemetryBody))
	telemetryRequest.Header.Set("Content-Type", "application/json")
	telemetryRequest.Header.Set("X-Bridge-Token", bridgeToken)
	telemetryResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(telemetryResponse, telemetryRequest)
	if telemetryResponse.Code != http.StatusAccepted {
		t.Fatalf("expected telemetry 202, got %d", telemetryResponse.Code)
	}

	overviewRequest := httptest.NewRequest(http.MethodGet, "/v1/workspaces/ws_demo/overview?creator_id=cr_demo", nil)
	overviewRequest.Header.Set("X-Workspace-Api-Key", service.DevWorkspaceAPIKey)
	overviewResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(overviewResponse, overviewRequest)
	if overviewResponse.Code != http.StatusOK {
		t.Fatalf("expected overview 200, got %d", overviewResponse.Code)
	}
	var overview domain.WorkspaceOverview
	if err := json.NewDecoder(overviewResponse.Body).Decode(&overview); err != nil {
		t.Fatalf("decode overview: %v", err)
	}
	if len(overview.RecentTelemetry) == 0 {
		t.Fatalf("expected recent telemetry entries")
	}
	if overview.RecentTelemetry[0].Status != domain.TelemetryAck {
		t.Fatalf("expected latest telemetry ack, got %s", overview.RecentTelemetry[0].Status)
	}
}

func newTestServerWithStaticRoot(t *testing.T, staticRoot string) *Server {
	t.Helper()
	server := newTestServer(t)
	return NewServer(server.service, server.repo, staticRoot)
}

func newBridgeTransportServer(t *testing.T, staticRoot string) *Server {
	t.Helper()
	repository := store.NewMemoryStore()
	telemetryRelay := relay.NewInMemoryRelay()
	serviceLayer := service.NewControlService(
		repository,
		repository,
		relay.NewCloudflareAdapter(relay.CloudflareAdapterConfig{
			FallbackWSBase: "ws://localhost:8080/bridge/v1/sessions/{session_id}/connect",
		}, repository, telemetryRelay),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
	if err := serviceLayer.SeedDemoData(); err != nil {
		t.Fatalf("seed demo data: %v", err)
	}
	return NewServer(serviceLayer, repository, staticRoot)
}

func repoRoot(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatalf("resolve caller path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(filename), "..", ".."))
}

func newSignedInboundEvent(event domain.InboundEvent) (domain.InboundEvent, error) {
	engine := secure.NewEngine([]byte("taas-server-signing"))
	privateDER, err := base64.StdEncoding.DecodeString(devPrivateKeyDER)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	privateKey, err := parsePKCS8Ed25519(privateDER)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	payload, err := engine.CanonicalizeInboundEvent(event)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	event.Signature = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, payload))
	return event, nil
}

func parsePKCS8Ed25519(der []byte) (ed25519.PrivateKey, error) {
	key, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, err
	}
	signer, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("parsed key is not Ed25519")
	}
	return signer, nil
}
