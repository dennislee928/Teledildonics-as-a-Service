package store_test

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/service"
	"github.com/taas-hq/taas/internal/store"
)

func TestPostgresRepositoryMigrateAndSeedDemoDataAreIdempotent(t *testing.T) {
	dsn := postgresIntegrationDSN(t)
	resetPostgresSchema(t, dsn)

	repository, err := store.NewPostgresStore(dsn)
	if err != nil {
		t.Fatalf("open postgres store: %v", err)
	}
	defer func() {
		_ = repository.Close()
		resetPostgresSchema(t, dsn)
	}()

	if err := repository.Migrate(); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if err := repository.Migrate(); err != nil {
		t.Fatalf("second migrate: %v", err)
	}

	control := service.NewControlService(
		repository,
		store.NewMemoryStore(),
		relay.NewInMemoryRelay(),
		secure.NewEngine([]byte("taas-server-signing")),
		service.NewMetrics(),
	)
	if err := control.SeedDemoData(); err != nil {
		t.Fatalf("first seed: %v", err)
	}
	if err := control.SeedDemoData(); err != nil {
		t.Fatalf("second seed: %v", err)
	}

	if _, err := repository.AuthenticateWorkspaceAPIKey(service.DevWorkspaceAPIKey, time.Now().UTC()); err != nil {
		t.Fatalf("authenticate workspace api key: %v", err)
	}
	if got := len(repository.ListBridges("ws_demo", "cr_demo")); got != 1 {
		t.Fatalf("expected 1 bridge, got %d", got)
	}
	if got := len(repository.ListDevices("cr_demo")); got != 1 {
		t.Fatalf("expected 1 device, got %d", got)
	}
	if got := len(repository.ListRuleSets("ws_demo", "cr_demo")); got != 1 {
		t.Fatalf("expected 1 ruleset, got %d", got)
	}
	if got := len(repository.ListSessions("ws_demo", "cr_demo")); got != 1 {
		t.Fatalf("expected 1 session, got %d", got)
	}
	if got := len(repository.ListArmedSessions()); got != 1 {
		t.Fatalf("expected 1 armed session, got %d", got)
	}

	if _, err := control.PublishTelemetry(context.Background(), "session_demo", domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryAck,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "command-accepted",
		LatencyMS:   29,
	}); err != nil {
		t.Fatalf("publish telemetry: %v", err)
	}

	overview, err := control.GetWorkspaceOverview(context.Background(), "ws_demo", "cr_demo")
	if err != nil {
		t.Fatalf("get workspace overview: %v", err)
	}
	if len(overview.RecentTelemetry) == 0 {
		t.Fatalf("expected recent telemetry entries")
	}
	if overview.RecentTelemetry[0].Status != domain.TelemetryAck {
		t.Fatalf("expected latest telemetry ack, got %s", overview.RecentTelemetry[0].Status)
	}
	if len(overview.RecentAudit) == 0 {
		t.Fatalf("expected recent audit entries")
	}
}

func postgresIntegrationDSN(t *testing.T) string {
	t.Helper()
	if dsn := os.Getenv("TAAS_TEST_POSTGRES_DSN"); dsn != "" {
		return dsn
	}
	if dsn := os.Getenv("POSTGRES_DSN"); dsn != "" {
		return dsn
	}
	t.Skip("set TAAS_TEST_POSTGRES_DSN or POSTGRES_DSN to run Postgres integration tests")
	return ""
}

func resetPostgresSchema(t *testing.T, dsn string) {
	t.Helper()
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open postgres db: %v", err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := db.ExecContext(ctx, `drop schema if exists public cascade`); err != nil {
		t.Fatalf("drop public schema: %v", err)
	}
	if _, err := db.ExecContext(ctx, `create schema public`); err != nil {
		t.Fatalf("create public schema: %v", err)
	}
}
