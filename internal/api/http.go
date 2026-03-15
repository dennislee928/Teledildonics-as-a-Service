package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"golang.org/x/net/websocket"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

type Server struct {
	service    *service.ControlService
	repo       store.Repository
	runtime    store.RuntimeStore
	staticRoot string
}

func NewServer(service *service.ControlService, repo store.Repository, staticRoot string) *Server {
	return &Server{
		service:    service,
		repo:       repo,
		runtime:    service.RuntimeStore(),
		staticRoot: staticRoot,
	}
}

type authContextKey struct{}
type bridgeAuthContextKey struct{}

type workspacePrincipal struct {
	WorkspaceID string
	KeyID       string
	Label       string
}

type bridgePrincipal struct {
	SessionID   string
	BridgeID    string
	WorkspaceID string
	CreatorID   string
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleLandingPage)
	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/readyz", s.handleReadyz)
	mux.HandleFunc("/metrics", s.handleMetrics)
	mux.HandleFunc("/v1/inbound-events", s.handleInboundEvents)
	mux.HandleFunc("/v1/device-bridges/pair", s.handlePairDeviceBridge)
	mux.HandleFunc("/v1/sessions", s.handleSessions)
	mux.HandleFunc("/v1/sessions/", s.handleSessionRoutes)
	mux.HandleFunc("/bridge/v1/sessions/", s.handleBridgeSessionRoutes)
	mux.HandleFunc("/v1/rulesets", s.handleCreateRuleSet)
	mux.HandleFunc("/v1/rulesets/", s.handleUpdateRuleSet)
	mux.HandleFunc("/v1/workspaces/", s.handleWorkspaceRoutes)
	s.registerStaticApps(mux)
	return withCORS(s.withBridgeSessionAuth(s.withWorkspaceAPIKeyAuth(mux)))
}

func (s *Server) handleReadyz(writer http.ResponseWriter, request *http.Request) {
	ctx, cancel := context.WithTimeout(request.Context(), 2*time.Second)
	defer cancel()

	type checkState struct {
		Status string `json:"status"`
		Error  string `json:"error,omitempty"`
	}
	checks := map[string]checkState{
		"repository": {Status: "ok"},
		"runtime":    {Status: "ok"},
	}
	status := http.StatusOK

	if checker, ok := s.repo.(store.HealthChecker); ok {
		if err := checker.HealthCheck(ctx); err != nil {
			checks["repository"] = checkState{Status: "error", Error: err.Error()}
			status = http.StatusServiceUnavailable
		}
	}
	if checker, ok := s.runtime.(store.HealthChecker); ok {
		if err := checker.HealthCheck(ctx); err != nil {
			checks["runtime"] = checkState{Status: "error", Error: err.Error()}
			status = http.StatusServiceUnavailable
		}
	}

	overall := "ok"
	if status != http.StatusOK {
		overall = "degraded"
	}
	writeJSON(writer, status, map[string]any{
		"status": overall,
		"checks": checks,
	})
}

func (s *Server) handleMetrics(writer http.ResponseWriter, _ *http.Request) {
	snapshot := s.service.MetricsSnapshot()
	armedSessions := len(s.repo.ListArmedSessions())

	writer.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	fmt.Fprintf(writer, "taas_ack_count %d\n", snapshot.AckCount)
	fmt.Fprintf(writer, "taas_ack_p50_ms %g\n", snapshot.AckP50MS)
	fmt.Fprintf(writer, "taas_ack_p95_ms %g\n", snapshot.AckP95MS)
	fmt.Fprintf(writer, "taas_webhook_failures_total %d\n", snapshot.WebhookFailures)
	fmt.Fprintf(writer, "taas_rule_rejections_total %d\n", snapshot.RuleRejections)
	fmt.Fprintf(writer, "taas_panic_stops_total %d\n", snapshot.PanicStops)
	fmt.Fprintf(writer, "taas_sessions_armed %d\n", armedSessions)
	regions := make([]string, 0, len(snapshot.PerRegionFailures))
	for region := range snapshot.PerRegionFailures {
		regions = append(regions, region)
	}
	sort.Strings(regions)
	for _, region := range regions {
		failures := snapshot.PerRegionFailures[region]
		fmt.Fprintf(writer, "taas_region_failures_total{region=%q} %d\n", region, failures)
	}
}

func (s *Server) handleLandingPage(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/" {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprint(writer, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaaS Control API</title>
    <style>
      :root { color-scheme: dark; font-family: "Avenir Next", "Segoe UI", sans-serif; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at top, rgba(240,124,62,.24), transparent 28%), linear-gradient(180deg, #0b1016, #141d28); color: #f3f6fb; }
      main { width: min(840px, 92vw); padding: 32px; border-radius: 28px; background: rgba(14,18,25,.82); border: 1px solid rgba(255,255,255,.08); box-shadow: 0 24px 80px rgba(0,0,0,.36); }
      a { color: #89d6be; }
      ul { line-height: 1.8; }
      code { background: rgba(255,255,255,.08); padding: 2px 8px; border-radius: 999px; }
    </style>
  </head>
  <body>
    <main>
      <p>TaaS control plane is online.</p>
      <h1>Secure control, local relay, deployable demos.</h1>
      <ul>
        <li><a href="/healthz">Health check</a></li>
        <li><a href="/readyz">Readiness check</a></li>
        <li><a href="/metrics">Metrics</a></li>
        <li><a href="/demo/hosted-control/">Hosted control demo</a></li>
        <li><a href="/demo/creator-console/">Creator console demo</a></li>
      </ul>
      <p>Seeded IDs: <code>ws_demo</code>, <code>cr_demo</code>, <code>bridge_demo</code>, <code>device_demo</code>, <code>rule_demo</code>.</p>
    </main>
  </body>
</html>`)
}

func (s *Server) registerStaticApps(mux *http.ServeMux) {
	for _, route := range []struct {
		prefix string
		dir    string
	}{
		{prefix: "/demo/creator-console/", dir: filepath.Join(s.staticRoot, "apps", "creator-console")},
		{prefix: "/demo/hosted-control/", dir: filepath.Join(s.staticRoot, "apps", "hosted-control")},
	} {
		if _, err := os.Stat(route.dir); err != nil {
			continue
		}
		fileServer := http.FileServer(http.Dir(route.dir))
		mux.Handle(route.prefix, http.StripPrefix(route.prefix, fileServer))
		mux.HandleFunc(strings.TrimSuffix(route.prefix, "/"), func(writer http.ResponseWriter, request *http.Request) {
			http.Redirect(writer, request, request.URL.Path+"/", http.StatusPermanentRedirect)
		})
	}
}

func (s *Server) handleInboundEvents(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		methodNotAllowed(writer)
		return
	}
	var event domain.InboundEvent
	if err := json.NewDecoder(request.Body).Decode(&event); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	if err := s.requireWorkspaceAccess(request, event.WorkspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}
	command, usage, err := s.service.HandleInboundEvent(request.Context(), event)
	if err != nil {
		status := http.StatusUnprocessableEntity
		if errors.Is(err, store.ErrNotFound) {
			status = http.StatusNotFound
		}
		writeError(writer, status, err)
		return
	}
	writeJSON(writer, http.StatusAccepted, map[string]any{
		"accepted": true,
		"command":  command,
		"usage":    usage,
	})
}

func (s *Server) handlePairDeviceBridge(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		methodNotAllowed(writer)
		return
	}
	var pairRequest domain.PairDeviceBridgeRequest
	if err := json.NewDecoder(request.Body).Decode(&pairRequest); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	if err := s.requireWorkspaceAccess(request, pairRequest.WorkspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}
	response, err := s.service.PairDeviceBridge(request.Context(), pairRequest)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusOK, response)
}

func (s *Server) handleSessions(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		methodNotAllowed(writer)
		return
	}
	var createRequest domain.CreateSessionRequest
	if err := json.NewDecoder(request.Body).Decode(&createRequest); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	if err := s.requireWorkspaceAccess(request, createRequest.WorkspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}
	session, err := s.service.CreateSession(request.Context(), createRequest)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusCreated, session)
}

func (s *Server) handleSessionRoutes(writer http.ResponseWriter, request *http.Request) {
	trimmed := strings.TrimPrefix(request.URL.Path, "/v1/sessions/")
	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		writeError(writer, http.StatusNotFound, errors.New("unknown session route"))
		return
	}
	sessionID := parts[0]
	action := parts[1]
	switch {
	case request.Method == http.MethodPost && action == "arm":
		session, err := s.repo.GetSession(sessionID)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		if err := s.requireWorkspaceAccess(request, session.WorkspaceID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		var armRequest domain.ArmSessionRequest
		if err := json.NewDecoder(request.Body).Decode(&armRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		session, err = s.service.ArmSession(request.Context(), sessionID, armRequest)
		if err != nil {
			writeError(writer, http.StatusUnprocessableEntity, err)
			return
		}
		writeJSON(writer, http.StatusOK, session)
	case request.Method == http.MethodPost && action == "stop":
		session, err := s.repo.GetSession(sessionID)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		if err := s.requireWorkspaceAccess(request, session.WorkspaceID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		var stopRequest domain.StopSessionRequest
		if err := json.NewDecoder(request.Body).Decode(&stopRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		session, err = s.service.StopSession(request.Context(), sessionID, stopRequest)
		if err != nil {
			writeError(writer, http.StatusUnprocessableEntity, err)
			return
		}
		writeJSON(writer, http.StatusOK, session)
	case request.Method == http.MethodGet && action == "stream":
		session, err := s.repo.GetSession(sessionID)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		if err := s.requireWorkspaceAccess(request, session.WorkspaceID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		s.streamSession(writer, request, sessionID)
	case request.Method == http.MethodPost && action == "telemetry":
		session, err := s.repo.GetSession(sessionID)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		if err := s.requireWorkspaceAccess(request, session.WorkspaceID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		var telemetryRequest domain.IngestTelemetryRequest
		if err := json.NewDecoder(request.Body).Decode(&telemetryRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		event, err := s.service.PublishTelemetry(request.Context(), sessionID, telemetryRequest)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		writeJSON(writer, http.StatusAccepted, event)
	default:
		methodNotAllowed(writer)
	}
}

func (s *Server) handleBridgeSessionRoutes(writer http.ResponseWriter, request *http.Request) {
	trimmed := strings.TrimPrefix(request.URL.Path, "/bridge/v1/sessions/")
	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		writeError(writer, http.StatusNotFound, errors.New("unknown bridge session route"))
		return
	}
	sessionID := parts[0]
	action := parts[1]

	switch {
	case request.Method == http.MethodGet && action == "connect":
		if err := s.requireBridgeSessionAccess(request, sessionID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		s.handleBridgeSessionConnect(writer, request, sessionID)
	case request.Method == http.MethodPost && action == "telemetry":
		if err := s.requireBridgeSessionAccess(request, sessionID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
		var telemetryRequest domain.IngestTelemetryRequest
		if err := json.NewDecoder(request.Body).Decode(&telemetryRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		event, err := s.service.PublishTelemetry(request.Context(), sessionID, telemetryRequest)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		writeJSON(writer, http.StatusAccepted, event)
	default:
		methodNotAllowed(writer)
	}
}

func (s *Server) handleCreateRuleSet(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		methodNotAllowed(writer)
		return
	}
	var ruleRequest domain.UpsertRuleSetRequest
	if err := json.NewDecoder(request.Body).Decode(&ruleRequest); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	if err := s.requireWorkspaceAccess(request, ruleRequest.WorkspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}
	ruleSet, err := s.service.UpsertRuleSet(request.Context(), "", ruleRequest)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusCreated, ruleSet)
}

func (s *Server) handleUpdateRuleSet(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPut {
		methodNotAllowed(writer)
		return
	}
	ruleSetID := strings.TrimPrefix(request.URL.Path, "/v1/rulesets/")
	var ruleRequest domain.UpsertRuleSetRequest
	if err := json.NewDecoder(request.Body).Decode(&ruleRequest); err != nil {
		writeError(writer, http.StatusBadRequest, err)
		return
	}
	if err := s.requireWorkspaceAccess(request, ruleRequest.WorkspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}
	existingRuleSet, err := s.repo.GetRuleSet(ruleSetID)
	if err == nil {
		if err := s.requireWorkspaceAccess(request, existingRuleSet.WorkspaceID); err != nil {
			writeError(writer, http.StatusForbidden, err)
			return
		}
	} else if !errors.Is(err, store.ErrNotFound) {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	ruleSet, err := s.service.UpsertRuleSet(request.Context(), ruleSetID, ruleRequest)
	if err != nil {
		writeError(writer, http.StatusUnprocessableEntity, err)
		return
	}
	writeJSON(writer, http.StatusOK, ruleSet)
}

func (s *Server) handleWorkspaceRoutes(writer http.ResponseWriter, request *http.Request) {
	trimmed := strings.TrimPrefix(request.URL.Path, "/v1/workspaces/")
	parts := strings.Split(trimmed, "/")
	if len(parts) < 2 {
		writeError(writer, http.StatusNotFound, errors.New("unknown workspace route"))
		return
	}
	workspaceID := parts[0]
	action := parts[1]

	if err := s.requireWorkspaceAccess(request, workspaceID); err != nil {
		writeError(writer, http.StatusForbidden, err)
		return
	}

	switch {
	case request.Method == http.MethodGet && action == "overview":
		creatorID := request.URL.Query().Get("creator_id")
		if creatorID == "" {
			writeError(writer, http.StatusBadRequest, errors.New("creator_id is required"))
			return
		}
		overview, err := s.service.GetWorkspaceOverview(request.Context(), workspaceID, creatorID)
		if err != nil {
			status := http.StatusUnprocessableEntity
			if errors.Is(err, store.ErrNotFound) {
				status = http.StatusNotFound
			}
			writeError(writer, status, err)
			return
		}
		writeJSON(writer, http.StatusOK, overview)
	case request.Method == http.MethodGet && action == "insights":
		if len(parts) < 3 || parts[2] != "hot-zones" {
			writeError(writer, http.StatusNotFound, errors.New("unknown insight route"))
			return
		}
		s.handleGetHotZones(writer, request, workspaceID)
	default:
		methodNotAllowed(writer)
	}
}

func (s *Server) handleGetHotZones(writer http.ResponseWriter, request *http.Request, workspaceID string) {
	zones, err := s.service.GetHotZones(request.Context(), workspaceID)
	if err != nil {
		writeError(writer, http.StatusInternalServerError, err)
		return
	}
	writeJSON(writer, http.StatusOK, zones)
}

func (s *Server) streamSession(writer http.ResponseWriter, request *http.Request, sessionID string) {
	flusher, ok := writer.(http.Flusher)
	if !ok {
		writeError(writer, http.StatusInternalServerError, errors.New("streaming unsupported"))
		return
	}
	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("Connection", "keep-alive")

	events, cancel := s.service.SubscribeSession(sessionID)
	defer cancel()

	keepAlive := time.NewTicker(15 * time.Second)
	defer keepAlive.Stop()

	for {
		select {
		case <-request.Context().Done():
			return
		case <-keepAlive.C:
			fmt.Fprint(writer, ": keep-alive\n\n")
			flusher.Flush()
		case event, ok := <-events:
			if !ok {
				return
			}
			payload, err := json.Marshal(event)
			if err != nil {
				return
			}
			fmt.Fprintf(writer, "event: telemetry\ndata: %s\n\n", payload)
			flusher.Flush()
		}
	}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Access-Control-Allow-Origin", "*")
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Workspace-Api-Key, X-Bridge-Token")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
}

func (s *Server) withBridgeSessionAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodOptions || !strings.HasPrefix(request.URL.Path, "/bridge/v1/sessions/") {
			next.ServeHTTP(writer, request)
			return
		}

		trimmed := strings.TrimPrefix(request.URL.Path, "/bridge/v1/sessions/")
		parts := strings.Split(trimmed, "/")
		if len(parts) < 2 {
			next.ServeHTTP(writer, request)
			return
		}
		sessionID := parts[0]
		action := parts[1]

		rawToken := request.Header.Get("X-Bridge-Token")
		if rawToken == "" {
			rawToken = request.URL.Query().Get("bridge_token")
		}
		if rawToken == "" {
			writeError(writer, http.StatusUnauthorized, errors.New("x-bridge-token is required"))
			return
		}

		grant, err := s.repo.GetGrantBySession(sessionID)
		if err != nil {
			status := http.StatusUnauthorized
			if !errors.Is(err, store.ErrNotFound) {
				status = http.StatusUnprocessableEntity
			}
			writeError(writer, status, err)
			return
		}
		if action == "connect" {
			if grant.RevokedAt != nil || time.Now().UTC().After(grant.ExpiresAt) {
				writeError(writer, http.StatusUnauthorized, errors.New("bridge grant expired"))
				return
			}
		}
		if !secure.VerifyBridgeToken(rawToken, sessionID, grant.BridgeID, grant.SessionKey) {
			writeError(writer, http.StatusUnauthorized, errors.New("invalid bridge token"))
			return
		}

		principal := bridgePrincipal{
			SessionID:   sessionID,
			BridgeID:    grant.BridgeID,
			WorkspaceID: grant.WorkspaceID,
			CreatorID:   grant.CreatorID,
		}
		ctx := context.WithValue(request.Context(), bridgeAuthContextKey{}, principal)
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}

func (s *Server) withWorkspaceAPIKeyAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodOptions || !strings.HasPrefix(request.URL.Path, "/v1/") {
			next.ServeHTTP(writer, request)
			return
		}

		rawKey := request.Header.Get("X-Workspace-Api-Key")
		if rawKey == "" && request.Method == http.MethodGet && strings.HasSuffix(request.URL.Path, "/stream") {
			rawKey = request.URL.Query().Get("api_key")
		}
		if rawKey == "" {
			writeError(writer, http.StatusUnauthorized, errors.New("x-workspace-api-key is required"))
			return
		}

		authenticatedKey, err := s.repo.AuthenticateWorkspaceAPIKey(rawKey, time.Now().UTC())
		if err != nil {
			status := http.StatusUnauthorized
			if !errors.Is(err, store.ErrUnauthorized) {
				status = http.StatusUnprocessableEntity
			}
			writeError(writer, status, err)
			return
		}

		principal := workspacePrincipal{
			WorkspaceID: authenticatedKey.WorkspaceID,
			KeyID:       authenticatedKey.ID,
			Label:       authenticatedKey.Label,
		}
		ctx := context.WithValue(request.Context(), authContextKey{}, principal)
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}

func (s *Server) requireWorkspaceAccess(request *http.Request, workspaceID string) error {
	principal, ok := request.Context().Value(authContextKey{}).(workspacePrincipal)
	if !ok {
		return errors.New("workspace principal missing from request context")
	}
	if principal.WorkspaceID != workspaceID {
		return errors.New("workspace api key does not grant access to this workspace")
	}
	return nil
}

func (s *Server) requireBridgeSessionAccess(request *http.Request, sessionID string) error {
	principal, ok := request.Context().Value(bridgeAuthContextKey{}).(bridgePrincipal)
	if !ok {
		return errors.New("bridge principal missing from request context")
	}
	if principal.SessionID != sessionID {
		return errors.New("bridge token does not grant access to this session")
	}
	return nil
}

func (s *Server) handleBridgeSessionConnect(writer http.ResponseWriter, request *http.Request, sessionID string) {
	principal, ok := request.Context().Value(bridgeAuthContextKey{}).(bridgePrincipal)
	if !ok {
		writeError(writer, http.StatusUnauthorized, errors.New("bridge principal missing from request context"))
		return
	}
	bridgeRelay, ok := s.service.Relay().(relay.BridgeSessionRelay)
	if !ok {
		writeError(writer, http.StatusNotImplemented, errors.New("bridge websocket relay is unavailable"))
		return
	}

	websocket.Handler(func(conn *websocket.Conn) {
		commands, cancel, err := bridgeRelay.SubscribeBridgeSession(sessionID, principal.BridgeID)
		if err != nil {
			_ = conn.Close()
			return
		}
		defer cancel()
		for {
			command, ok := <-commands
			if !ok {
				return
			}
			_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			if err := websocket.JSON.Send(conn, command); err != nil {
				return
			}
		}
	}).ServeHTTP(writer, request)
}

func methodNotAllowed(writer http.ResponseWriter) {
	writeError(writer, http.StatusMethodNotAllowed, errors.New("method not allowed"))
}

func writeJSON(writer http.ResponseWriter, status int, payload any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(payload)
}

func writeError(writer http.ResponseWriter, status int, err error) {
	writeJSON(writer, status, map[string]string{
		"error": err.Error(),
	})
}

func StreamContext(request *http.Request) context.Context {
	return request.Context()
}
