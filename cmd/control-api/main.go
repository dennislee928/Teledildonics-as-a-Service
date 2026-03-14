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

	memoryStore := store.NewMemoryStore()
	inMemoryRelay := relay.NewInMemoryRelay()
	serviceLayer := service.NewControlService(
		memoryStore,
		relay.NewCloudflareAdapter(relay.CloudflareAdapterConfig{
			AccountID:      os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
			RealtimeAppID:  os.Getenv("CLOUDFLARE_REALTIME_APP_ID"),
			TurnServiceID:  os.Getenv("CLOUDFLARE_TURN_SERVICE_ID"),
			FallbackWSBase: "ws://localhost:8080/ws/fallback",
		}, inMemoryRelay),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
	if err := serviceLayer.SeedDemoData(); err != nil {
		logger.Error("failed to seed demo data", slog.Any("error", err))
		os.Exit(1)
	}

	server := api.NewServer(serviceLayer)
	logger.Info("control api listening", slog.String("addr", addr))
	if err := http.ListenAndServe(addr, server.Handler()); err != nil {
		logger.Error("control api stopped", slog.Any("error", err))
		os.Exit(1)
	}
}
