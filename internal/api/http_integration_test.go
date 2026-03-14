package api

import (
	"bytes"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
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

func newTestServerWithStaticRoot(t *testing.T, staticRoot string) *Server {
	t.Helper()
	server := newTestServer(t)
	return NewServer(server.service, server.repo, staticRoot)
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
