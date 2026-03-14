package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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
