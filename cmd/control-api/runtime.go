package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/taas-hq/taas/internal/api"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

type closeFunc func()

func run(ctx context.Context, logger *slog.Logger) error {
	cfg := loadConfig()

	repository, runtimeStore, cleanup, err := openStores(cfg, logger)
	if err != nil {
		return err
	}
	defer cleanup()

	serviceLayer := newService(cfg, repository, runtimeStore)
	if err := serviceLayer.SeedDemoData(); err != nil {
		return fmt.Errorf("seed demo data: %w", err)
	}
	serviceLayer.StartHeartbeatWorker(ctx)

	server := api.NewServer(serviceLayer, repository, cfg.staticRoot)
	logger.Info("control api listening",
		slog.String("addr", cfg.addr),
		slog.String("repository_backend", cfg.repositoryBackend),
		slog.String("runtime_backend", cfg.runtimeBackend),
	)
	if err := http.ListenAndServe(cfg.addr, server.Handler()); err != nil {
		return fmt.Errorf("listen and serve: %w", err)
	}
	return nil
}

func openStores(cfg config, logger *slog.Logger) (store.Repository, store.RuntimeStore, closeFunc, error) {
	memoryStore := store.NewMemoryStore()
	var (
		repository   store.Repository   = memoryStore
		runtimeStore store.RuntimeStore = memoryStore
		cleanupFns   []func()
	)

	if cfg.repositoryBackend == "postgres" {
		if cfg.postgresDSN == "" {
			return nil, nil, nil, fmt.Errorf("postgres repository backend requires POSTGRES_DSN")
		}
		postgresStore, err := store.NewPostgresStore(cfg.postgresDSN)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("open postgres repository: %w", err)
		}
		if err := postgresStore.Migrate(); err != nil {
			_ = postgresStore.Close()
			return nil, nil, nil, fmt.Errorf("migrate postgres repository: %w", err)
		}
		repository = postgresStore
		cleanupFns = append(cleanupFns, func() {
			if err := postgresStore.Close(); err != nil {
				logger.Warn("close postgres repository", slog.Any("error", err))
			}
		})
	}

	if cfg.runtimeBackend == "redis" {
		if cfg.redisURL == "" {
			for _, cleanup := range cleanupFns {
				cleanup()
			}
			return nil, nil, nil, fmt.Errorf("redis runtime backend requires REDIS_URL")
		}
		redisRuntimeStore, err := store.NewRedisRuntimeStore(cfg.redisURL)
		if err != nil {
			for _, cleanup := range cleanupFns {
				cleanup()
			}
			return nil, nil, nil, fmt.Errorf("open redis runtime store: %w", err)
		}
		runtimeStore = redisRuntimeStore
		cleanupFns = append(cleanupFns, func() {
			if err := redisRuntimeStore.Close(); err != nil {
				logger.Warn("close redis runtime store", slog.Any("error", err))
			}
		})
	}

	return repository, runtimeStore, func() {
		for i := len(cleanupFns) - 1; i >= 0; i-- {
			cleanupFns[i]()
		}
	}, nil
}

func newService(cfg config, repository store.Repository, runtimeStore store.RuntimeStore) *service.ControlService {
	inMemoryRelay := relay.NewInMemoryRelay()
	return service.NewControlService(
		repository,
		runtimeStore,
		relay.NewCloudflareAdapter(relay.CloudflareAdapterConfig{
			AccountID:      cfg.cloudflareAccountID,
			RealtimeAppID:  cfg.cloudflareRealtimeApp,
			TurnServiceID:  cfg.cloudflareTurnService,
			FallbackWSBase: "ws://localhost:8080/bridge/v1/sessions/{session_id}/connect",
		}, repository, inMemoryRelay),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
}
