package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
)

func (s *Server) handleOpenAPISpec(writer http.ResponseWriter, _ *http.Request) {
	spec, err := os.ReadFile(filepath.Join(s.staticRoot, "docs", "openapi.json"))
	if err != nil {
		writeError(writer, http.StatusInternalServerError, fmt.Errorf("read openapi spec: %w", err))
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write(spec)
}

func (s *Server) handleSwaggerDocs(writer http.ResponseWriter, request *http.Request) {
	if request.URL.Path == "/docs" {
		http.Redirect(writer, request, "/docs/", http.StatusPermanentRedirect)
		return
	}
	writer.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprint(writer, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TaaS API Reference</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      :root { color-scheme: dark; font-family: "Avenir Next", "Segoe UI", sans-serif; }
      body { margin: 0; background: linear-gradient(180deg, #0b1016, #141d28); color: #f3f6fb; }
      header { padding: 24px 28px 8px; border-bottom: 1px solid rgba(255,255,255,.08); }
      h1 { margin: 0 0 8px; font-size: 2rem; }
      p { margin: 0; color: #c9d3e1; }
      .links { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
      .links a { color: #89d6be; text-decoration: none; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <header>
      <h1>TaaS API Reference</h1>
      <p>Workspace routes use <code>X-Workspace-Api-Key</code>. Bridge routes use <code>X-Bridge-Token</code>.</p>
      <div class="links">
        <a href="/openapi.json">Raw OpenAPI JSON</a>
        <a href="/healthz">Health</a>
        <a href="/readyz">Readiness</a>
        <a href="/metrics">Metrics</a>
      </div>
    </header>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        docExpansion: "list",
        presets: [SwaggerUIBundle.presets.apis],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>`)
}
