package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

type Server struct {
	service    *service.ControlService
	staticRoot string
}

func NewServer(service *service.ControlService, staticRoot string) *Server {
	return &Server{
		service:    service,
		staticRoot: staticRoot,
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleLandingPage)
	mux.HandleFunc("/healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("/v1/inbound-events", s.handleInboundEvents)
	mux.HandleFunc("/v1/device-bridges/pair", s.handlePairDeviceBridge)
	mux.HandleFunc("/v1/sessions", s.handleSessions)
	mux.HandleFunc("/v1/sessions/", s.handleSessionRoutes)
	mux.HandleFunc("/v1/rulesets", s.handleCreateRuleSet)
	mux.HandleFunc("/v1/rulesets/", s.handleUpdateRuleSet)
	mux.HandleFunc("/v1/workspaces/", s.handleWorkspaceRoutes)
	s.registerStaticApps(mux)
	return withCORS(mux)
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
		var armRequest domain.ArmSessionRequest
		if err := json.NewDecoder(request.Body).Decode(&armRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		session, err := s.service.ArmSession(request.Context(), sessionID, armRequest)
		if err != nil {
			writeError(writer, http.StatusUnprocessableEntity, err)
			return
		}
		writeJSON(writer, http.StatusOK, session)
	case request.Method == http.MethodPost && action == "stop":
		var stopRequest domain.StopSessionRequest
		if err := json.NewDecoder(request.Body).Decode(&stopRequest); err != nil {
			writeError(writer, http.StatusBadRequest, err)
			return
		}
		session, err := s.service.StopSession(request.Context(), sessionID, stopRequest)
		if err != nil {
			writeError(writer, http.StatusUnprocessableEntity, err)
			return
		}
		writeJSON(writer, http.StatusOK, session)
	case request.Method == http.MethodGet && action == "stream":
		s.streamSession(writer, request, sessionID)
	case request.Method == http.MethodPost && action == "telemetry":
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
	default:
		methodNotAllowed(writer)
	}
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
		writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Workspace-Api-Key")
		writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(writer, request)
	})
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
