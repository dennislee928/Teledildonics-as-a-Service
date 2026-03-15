package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/taas-hq/taas/internal/domain"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(dsn string) (*PostgresStore, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &PostgresStore{db: db}, nil
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

func (s *PostgresStore) HealthCheck(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

func (s *PostgresStore) Migrate() error {
	statements := []string{
		`create table if not exists workspaces (
			id text primary key,
			region text not null,
			created_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists creators (
			id text primary key,
			workspace_id text not null,
			created_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists bridges (
			id text primary key,
			workspace_id text not null,
			creator_id text not null,
			created_at timestamptz not null,
			last_seen_at timestamptz not null,
			wrapped_session_key bytea not null,
			payload jsonb not null
		)`,
		`create table if not exists devices (
			id text primary key,
			creator_id text not null,
			bridge_id text not null,
			updated_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists rulesets (
			id text primary key,
			workspace_id text not null,
			creator_id text not null,
			updated_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists sessions (
			id text primary key,
			workspace_id text not null,
			creator_id text not null,
			updated_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists endpoints (
			id text primary key,
			workspace_id text not null,
			creator_id text not null,
			active boolean not null,
			rotated_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists grants (
			session_id text primary key,
			workspace_id text not null,
			creator_id text not null,
			bridge_id text not null,
			expires_at timestamptz not null,
			revoked_at timestamptz null,
			payload jsonb not null
		)`,
		`create table if not exists usage_entries (
			id text primary key,
			workspace_id text not null,
			session_id text not null,
			occurred_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists audit_events (
			id text primary key,
			workspace_id text not null,
			creator_id text not null,
			session_id text null,
			occurred_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists telemetry_events (
			id bigserial primary key,
			session_id text not null,
			executed_at timestamptz not null,
			payload jsonb not null
		)`,
		`create table if not exists workspace_api_keys (
			id text primary key,
			workspace_id text not null,
			key_hash text unique not null,
			key_prefix text not null,
			created_at timestamptz not null,
			last_used_at timestamptz null,
			revoked_at timestamptz null,
			payload jsonb not null
		)`,
	}

	for _, statement := range statements {
		if _, err := s.db.ExecContext(context.Background(), statement); err != nil {
			return err
		}
	}
	return nil
}

func (s *PostgresStore) UpsertWorkspace(entry domain.Workspace) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into workspaces (id, region, created_at, payload)
		values ($1, $2, $3, $4)
		on conflict (id) do update
		set region = excluded.region,
		    created_at = excluded.created_at,
		    payload = excluded.payload
	`, entry.ID, entry.Region, entry.CreatedAt, payload)
	return err
}

func (s *PostgresStore) GetWorkspace(id string) (domain.Workspace, error) {
	return queryOneJSON[domain.Workspace](s.db, `select payload from workspaces where id = $1`, id)
}

func (s *PostgresStore) UpsertCreator(entry domain.Creator) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into creators (id, workspace_id, created_at, payload)
		values ($1, $2, $3, $4)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    created_at = excluded.created_at,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.CreatedAt, payload)
	return err
}

func (s *PostgresStore) GetCreator(id string) (domain.Creator, error) {
	return queryOneJSON[domain.Creator](s.db, `select payload from creators where id = $1`, id)
}

func (s *PostgresStore) UpsertBridge(entry domain.DeviceBridge) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into bridges (
			id, workspace_id, creator_id, created_at, last_seen_at, wrapped_session_key, payload
		)
		values ($1, $2, $3, $4, $5, $6, $7)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    creator_id = excluded.creator_id,
		    created_at = excluded.created_at,
		    last_seen_at = excluded.last_seen_at,
		    wrapped_session_key = excluded.wrapped_session_key,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.CreatorID, entry.CreatedAt, entry.LastSeenAt, entry.WrappedSessionKey, payload)
	return err
}

func (s *PostgresStore) GetBridge(id string) (domain.DeviceBridge, error) {
	var payload []byte
	var wrapped []byte
	err := s.db.QueryRowContext(context.Background(), `
		select payload, wrapped_session_key from bridges where id = $1
	`, id).Scan(&payload, &wrapped)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.DeviceBridge{}, ErrNotFound
	}
	if err != nil {
		return domain.DeviceBridge{}, err
	}
	var entry domain.DeviceBridge
	if err := json.Unmarshal(payload, &entry); err != nil {
		return domain.DeviceBridge{}, err
	}
	entry.WrappedSessionKey = wrapped
	return entry, nil
}

func (s *PostgresStore) ListBridges(workspaceID, creatorID string) []domain.DeviceBridge {
	rows, err := s.db.QueryContext(context.Background(), `
		select payload, wrapped_session_key
		from bridges
		where workspace_id = $1 and creator_id = $2
		order by created_at desc
	`, workspaceID, creatorID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var entries []domain.DeviceBridge
	for rows.Next() {
		var payload []byte
		var wrapped []byte
		if err := rows.Scan(&payload, &wrapped); err != nil {
			return nil
		}
		var entry domain.DeviceBridge
		if err := json.Unmarshal(payload, &entry); err != nil {
			return nil
		}
		entry.WrappedSessionKey = wrapped
		entries = append(entries, entry)
	}
	return entries
}

func (s *PostgresStore) UpsertDevice(entry domain.Device) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into devices (id, creator_id, bridge_id, updated_at, payload)
		values ($1, $2, $3, $4, $5)
		on conflict (id) do update
		set creator_id = excluded.creator_id,
		    bridge_id = excluded.bridge_id,
		    updated_at = excluded.updated_at,
		    payload = excluded.payload
	`, entry.ID, entry.CreatorID, entry.BridgeID, entry.UpdatedAt, payload)
	return err
}

func (s *PostgresStore) GetDevice(id string) (domain.Device, error) {
	return queryOneJSON[domain.Device](s.db, `select payload from devices where id = $1`, id)
}

func (s *PostgresStore) ListDevices(creatorID string) []domain.Device {
	return queryManyJSON[domain.Device](s.db, `
		select payload from devices where creator_id = $1 order by updated_at desc
	`, creatorID)
}

func (s *PostgresStore) UpsertRuleSet(entry domain.RuleSet) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into rulesets (id, workspace_id, creator_id, updated_at, payload)
		values ($1, $2, $3, $4, $5)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    creator_id = excluded.creator_id,
		    updated_at = excluded.updated_at,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.CreatorID, entry.UpdatedAt, payload)
	return err
}

func (s *PostgresStore) GetRuleSet(id string) (domain.RuleSet, error) {
	return queryOneJSON[domain.RuleSet](s.db, `select payload from rulesets where id = $1`, id)
}

func (s *PostgresStore) ListRuleSets(workspaceID, creatorID string) []domain.RuleSet {
	return queryManyJSON[domain.RuleSet](s.db, `
		select payload from rulesets
		where workspace_id = $1 and creator_id = $2
		order by updated_at desc
	`, workspaceID, creatorID)
}

func (s *PostgresStore) CreateSession(entry domain.Session) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into sessions (id, workspace_id, creator_id, updated_at, payload)
		values ($1, $2, $3, $4, $5)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    creator_id = excluded.creator_id,
		    updated_at = excluded.updated_at,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.CreatorID, entry.UpdatedAt, payload)
	return err
}

func (s *PostgresStore) UpdateSession(entry domain.Session) error {
	return s.CreateSession(entry)
}

func (s *PostgresStore) GetSession(id string) (domain.Session, error) {
	return queryOneJSON[domain.Session](s.db, `select payload from sessions where id = $1`, id)
}

func (s *PostgresStore) ListSessions(workspaceID, creatorID string) []domain.Session {
	return queryManyJSON[domain.Session](s.db, `
		select payload from sessions
		where workspace_id = $1 and creator_id = $2
		order by updated_at desc
	`, workspaceID, creatorID)
}

func (s *PostgresStore) ListArmedSessions() []domain.Session {
	return queryManyJSON[domain.Session](s.db, `
		select payload from sessions
		where payload->>'status' = 'armed'
		order by updated_at desc
	`)
}

func (s *PostgresStore) UpsertEndpoint(entry domain.InboundEndpoint) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into endpoints (id, workspace_id, creator_id, active, rotated_at, payload)
		values ($1, $2, $3, $4, $5, $6)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    creator_id = excluded.creator_id,
		    active = excluded.active,
		    rotated_at = excluded.rotated_at,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.CreatorID, entry.Active, entry.RotatedAt, payload)
	return err
}

func (s *PostgresStore) GetEndpointByCreator(workspaceID, creatorID string) (domain.InboundEndpoint, error) {
	return queryOneJSON[domain.InboundEndpoint](s.db, `
		select payload
		from endpoints
		where workspace_id = $1 and creator_id = $2 and active = true
		order by rotated_at desc
		limit 1
	`, workspaceID, creatorID)
}

func (s *PostgresStore) PutGrant(entry domain.ControlGrant) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into grants (session_id, workspace_id, creator_id, bridge_id, expires_at, revoked_at, payload)
		values ($1, $2, $3, $4, $5, $6, $7)
		on conflict (session_id) do update
		set workspace_id = excluded.workspace_id,
		    creator_id = excluded.creator_id,
		    bridge_id = excluded.bridge_id,
		    expires_at = excluded.expires_at,
		    revoked_at = excluded.revoked_at,
		    payload = excluded.payload
	`, entry.SessionID, entry.WorkspaceID, entry.CreatorID, entry.BridgeID, entry.ExpiresAt, entry.RevokedAt, payload)
	return err
}

func (s *PostgresStore) GetGrantBySession(sessionID string) (domain.ControlGrant, error) {
	return queryOneJSON[domain.ControlGrant](s.db, `select payload from grants where session_id = $1`, sessionID)
}

func (s *PostgresStore) RevokeGrant(sessionID string, revokedAt time.Time) error {
	entry, err := s.GetGrantBySession(sessionID)
	if err != nil {
		return err
	}
	entry.RevokedAt = &revokedAt
	return s.PutGrant(entry)
}

func (s *PostgresStore) AddUsage(entry domain.UsageLedgerEntry) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into usage_entries (id, workspace_id, session_id, occurred_at, payload)
		values ($1, $2, $3, $4, $5)
	`, entry.ID, entry.WorkspaceID, entry.SessionID, entry.OccurredAt, payload)
	return err
}

func (s *PostgresStore) ListUsage(workspaceID string, limit int) []domain.UsageLedgerEntry {
	if limit <= 0 {
		limit = 50
	}
	return queryManyJSON[domain.UsageLedgerEntry](s.db, `
		select payload from usage_entries
		where workspace_id = $1
		order by occurred_at desc
		limit $2
	`, workspaceID, limit)
}

func (s *PostgresStore) AddAudit(entry domain.AuditEvent) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into audit_events (id, workspace_id, creator_id, session_id, occurred_at, payload)
		values ($1, $2, $3, $4, $5, $6)
	`, entry.ID, entry.WorkspaceID, entry.CreatorID, nullableString(entry.SessionID), entry.OccurredAt, payload)
	return err
}

func (s *PostgresStore) ListAudit(workspaceID, creatorID string, limit int) []domain.AuditEvent {
	if limit <= 0 {
		limit = 50
	}
	return queryManyJSON[domain.AuditEvent](s.db, `
		select payload from audit_events
		where workspace_id = $1 and ($2 = '' or creator_id = $2)
		order by occurred_at desc
		limit $3
	`, workspaceID, creatorID, limit)
}

func (s *PostgresStore) AddTelemetry(entry domain.TelemetryEvent) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into telemetry_events (session_id, executed_at, payload)
		values ($1, $2, $3)
	`, entry.SessionID, entry.ExecutedAt, payload)
	return err
}

func (s *PostgresStore) ListTelemetry(sessionIDs []string, limit int) []domain.TelemetryEvent {
	if limit <= 0 {
		limit = 50
	}
	if len(sessionIDs) == 0 {
		return queryManyJSON[domain.TelemetryEvent](s.db, `
			select payload from telemetry_events
			order by executed_at desc
			limit $1
		`, limit)
	}
	return queryManyJSON[domain.TelemetryEvent](s.db, `
		select payload from telemetry_events
		where session_id = any($1)
		order by executed_at desc
		limit $2
	`, sessionIDs, limit)
}

func (s *PostgresStore) PutWorkspaceAPIKey(entry domain.WorkspaceAPIKey) error {
	payload, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(context.Background(), `
		insert into workspace_api_keys (
			id, workspace_id, key_hash, key_prefix, created_at, last_used_at, revoked_at, payload
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8)
		on conflict (id) do update
		set workspace_id = excluded.workspace_id,
		    key_hash = excluded.key_hash,
		    key_prefix = excluded.key_prefix,
		    created_at = excluded.created_at,
		    last_used_at = excluded.last_used_at,
		    revoked_at = excluded.revoked_at,
		    payload = excluded.payload
	`, entry.ID, entry.WorkspaceID, entry.KeyHash, entry.KeyPrefix, entry.CreatedAt, entry.LastUsedAt, entry.RevokedAt, payload)
	return err
}

func (s *PostgresStore) AuthenticateWorkspaceAPIKey(rawKey string, usedAt time.Time) (domain.WorkspaceAPIKey, error) {
	keyHash := HashWorkspaceAPIKey(rawKey)
	var payload []byte
	var storedHash string
	err := s.db.QueryRowContext(context.Background(), `
		select payload, key_hash
		from workspace_api_keys
		where key_hash = $1 and revoked_at is null
	`, keyHash).Scan(&payload, &storedHash)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.WorkspaceAPIKey{}, ErrUnauthorized
	}
	if err != nil {
		return domain.WorkspaceAPIKey{}, err
	}
	var entry domain.WorkspaceAPIKey
	if err := json.Unmarshal(payload, &entry); err != nil {
		return domain.WorkspaceAPIKey{}, err
	}
	entry.KeyHash = storedHash
	entry.LastUsedAt = &usedAt
	if err := s.PutWorkspaceAPIKey(entry); err != nil {
		return domain.WorkspaceAPIKey{}, err
	}
	return entry, nil
}

func queryOneJSON[T any](db *sql.DB, query string, args ...any) (T, error) {
	var payload []byte
	err := db.QueryRowContext(context.Background(), query, args...).Scan(&payload)
	if errors.Is(err, sql.ErrNoRows) {
		var zero T
		return zero, ErrNotFound
	}
	if err != nil {
		var zero T
		return zero, err
	}
	var entry T
	if err := json.Unmarshal(payload, &entry); err != nil {
		var zero T
		return zero, err
	}
	return entry, nil
}

func queryManyJSON[T any](db *sql.DB, query string, args ...any) []T {
	rows, err := db.QueryContext(context.Background(), query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	var entries []T
	for rows.Next() {
		var payload []byte
		if err := rows.Scan(&payload); err != nil {
			return nil
		}
		var entry T
		if err := json.Unmarshal(payload, &entry); err != nil {
			return nil
		}
		entries = append(entries, entry)
	}
	return entries
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}
