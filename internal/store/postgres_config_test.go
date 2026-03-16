package store

import (
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestParsePostgresConfigUsesSimpleProtocolForSupabaseTransactionPooler(t *testing.T) {
	config, err := parsePostgresConfig("postgresql://postgres.demo:supersecret@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require")
	if err != nil {
		t.Fatalf("parse postgres config: %v", err)
	}

	if config.DefaultQueryExecMode != pgx.QueryExecModeSimpleProtocol {
		t.Fatalf("expected simple protocol for Supabase transaction pooler, got %v", config.DefaultQueryExecMode)
	}
	if config.StatementCacheCapacity != 0 {
		t.Fatalf("expected statement cache disabled, got %d", config.StatementCacheCapacity)
	}
	if config.DescriptionCacheCapacity != 0 {
		t.Fatalf("expected description cache disabled, got %d", config.DescriptionCacheCapacity)
	}
	if got := config.RuntimeParams["application_name"]; got != "taas-control-api" {
		t.Fatalf("expected application_name taas-control-api, got %q", got)
	}
}

func TestParsePostgresConfigKeepsDefaultModeForDirectPostgres(t *testing.T) {
	config, err := parsePostgresConfig("postgres://taas:taas@localhost:5432/taas?sslmode=disable")
	if err != nil {
		t.Fatalf("parse postgres config: %v", err)
	}

	if config.DefaultQueryExecMode == pgx.QueryExecModeSimpleProtocol {
		t.Fatalf("did not expect simple protocol for direct Postgres connections")
	}
}
