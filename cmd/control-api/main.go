package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/taas-hq/taas/internal/api"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	addr := os.Getenv("CONTROL_API_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	staticRoot := os.Getenv("STATIC_ROOT")
	if staticRoot == "" {
		staticRoot = "."
	}

	repositoryBackend := os.Getenv("STORE_REPOSITORY_BACKEND")
	if repositoryBackend == "" {
		repositoryBackend = "memory"
	}
	runtimeBackend := os.Getenv("STORE_RUNTIME_BACKEND")
	if runtimeBackend == "" {
		runtimeBackend = "memory"
	}

	memoryStore := store.NewMemoryStore()
	var repository store.Repository = memoryStore
	var runtimeStore store.RuntimeStore = memoryStore
	var postgresStore *store.PostgresStore

	if repositoryBackend == "postgres" {
		dsn := os.Getenv("POSTGRES_DSN")
		if dsn == "" {
			logger.Error("postgres repository backend requires POSTGRES_DSN")
			os.Exit(1)
		}
		var err error
		postgresStore, err = store.NewPostgresStore(dsn)
		if err != nil {
			logger.Error("failed to open postgres repository", slog.Any("error", err))
			os.Exit(1)
		}
		defer func() {
			_ = postgresStore.Close()
		}()
		if err := postgresStore.Migrate(); err != nil {
			logger.Error("failed to migrate postgres repository", slog.Any("error", err))
			os.Exit(1)
		}
		repository = postgresStore
	}

	if runtimeBackend == "redis" {
		redisURL := os.Getenv("REDIS_URL")
		if redisURL == "" {
			logger.Error("redis runtime backend requires REDIS_URL")
			os.Exit(1)
		}
		redisRuntimeStore, err := store.NewRedisRuntimeStore(redisURL)
		if err != nil {
			logger.Error("failed to open redis runtime store", slog.Any("error", err))
			os.Exit(1)
		}
		runtimeStore = redisRuntimeStore
	}

	inMemoryRelay := relay.NewInMemoryRelay()
	serviceLayer := service.NewControlService(
		repository,
		runtimeStore,
		relay.NewCloudflareAdapter(relay.CloudflareAdapterConfig{
			AccountID:      os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
			RealtimeAppID:  os.Getenv("CLOUDFLARE_REALTIME_APP_ID"),
			TurnServiceID:  os.Getenv("CLOUDFLARE_TURN_SERVICE_ID"),
			FallbackWSBase: "ws://localhost:8080/bridge/v1/sessions/{session_id}/connect",
		}, repository, inMemoryRelay),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
	if err := serviceLayer.SeedDemoData(); err != nil {
		logger.Error("failed to seed demo data", slog.Any("error", err))
		os.Exit(1)
	}

	server := api.NewServer(serviceLayer, repository, staticRoot)
	logger.Info("control api listening",
		slog.String("addr", addr),
		slog.String("repository_backend", repositoryBackend),
		slog.String("runtime_backend", runtimeBackend),
	)
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		logger.Error("control api stopped", slog.Any("error", err))
		os.Exit(1)
	}
}
