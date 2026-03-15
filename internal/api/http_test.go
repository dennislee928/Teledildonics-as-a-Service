package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

func TestAPIRejectsMissingWorkspaceAPIKey(t *testing.T) {
	server := newTestServer(t)
	request := httptest.NewRequest(http.MethodGet, "/v1/workspaces/ws_demo/overview?creator_id=cr_demo", nil)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestAPIAllowsValidWorkspaceAPIKey(t *testing.T) {
	server := newTestServer(t)
	request := httptest.NewRequest(http.MethodGet, "/v1/workspaces/ws_demo/overview?creator_id=cr_demo", nil)
	request.Header.Set("X-Workspace-Api-Key", service.DevWorkspaceAPIKey)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
}

func TestAPIRejectsWorkspaceMismatch(t *testing.T) {
	server := newTestServer(t)
	body, err := json.Marshal(domain.CreateSessionRequest{
		WorkspaceID:   "ws_other",
		CreatorID:     "cr_demo",
		DeviceID:      "device_demo",
		RuleSetID:     "rule_demo",
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/v1/sessions", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Workspace-Api-Key", service.DevWorkspaceAPIKey)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestAPIAllowsSessionStreamWithQueryAPIKey(t *testing.T) {
	server := newTestServer(t)
	session, err := server.service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   "ws_demo",
		CreatorID:     "cr_demo",
		DeviceID:      "device_demo",
		RuleSetID:     "rule_demo",
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	request := httptest.NewRequest(
		http.MethodGet,
		"/v1/sessions/"+session.ID+"/stream?api_key="+service.DevWorkspaceAPIKey,
		nil,
	).WithContext(ctx)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if recorder.Header().Get("Content-Type") != "text/event-stream" {
		t.Fatalf("expected text/event-stream content type, got %q", recorder.Header().Get("Content-Type"))
	}
}

func TestAPIAcceptsBridgeTelemetryWithGrantToken(t *testing.T) {
	server := newTestServer(t)
	grant, err := server.repo.GetGrantBySession("session_demo")
	if err != nil {
		t.Fatalf("get grant: %v", err)
	}
	token := secure.DeriveBridgeToken("session_demo", grant.BridgeID, grant.SessionKey)

	body, err := json.Marshal(domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryAck,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "command-accepted",
		LatencyMS:   28,
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/bridge/v1/sessions/session_demo/telemetry", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Bridge-Token", token)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", recorder.Code)
	}
}

func TestAPIRejectsInvalidBridgeTelemetryToken(t *testing.T) {
	server := newTestServer(t)
	body, err := json.Marshal(domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryAck,
		DeviceState: "command-accepted",
		LatencyMS:   28,
	})
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}

	request := httptest.NewRequest(http.MethodPost, "/bridge/v1/sessions/session_demo/telemetry", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Bridge-Token", "bad-token")
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestAPIReadyzReportsHealthyStores(t *testing.T) {
	server := newTestServer(t)
	request := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"status":"ok"`) {
		t.Fatalf("expected ok readiness body, got %s", recorder.Body.String())
	}
}

func TestAPIMetricsExposeOperationalSnapshot(t *testing.T) {
	server := newTestServer(t)
	if _, err := server.service.PublishTelemetry(context.Background(), "session_demo", domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryAck,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "command-accepted",
		LatencyMS:   31,
	}); err != nil {
		t.Fatalf("publish telemetry: %v", err)
	}

	request := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	recorder := httptest.NewRecorder()

	server.Handler().ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "taas_ack_count") {
		t.Fatalf("expected ack metric in body, got %s", body)
	}
	if !strings.Contains(body, "taas_sessions_armed") {
		t.Fatalf("expected armed session metric in body, got %s", body)
	}
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	repository := store.NewMemoryStore()
	serviceLayer := service.NewControlService(
		repository,
		repository,
		relay.NewInMemoryRelay(),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
	if err := serviceLayer.SeedDemoData(); err != nil {
		t.Fatalf("seed demo data: %v", err)
	}
	return NewServer(serviceLayer, repository, ".")
}
