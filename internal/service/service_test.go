package service

import (
	"context"
	"crypto/ed25519"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"testing"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/store"
)

const devPrivateKeyDER = "MC4CAQAwBQYDK2VwBCIEIGvi8nZj54obWkUuDjOz2yRSkG5qKzj7F9yG5cV3qXQ3"

func TestHandleInboundEventProducesSignedEncryptedCommand(t *testing.T) {
	service, clock := newTestService(t)
	session, err := service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.ArmSession(context.Background(), session.ID, domain.ArmSessionRequest{
		BridgeID:    demoBridgeID,
		ExpiresInMS: 60_000,
	}); err != nil {
		t.Fatalf("arm session: %v", err)
	}

	event, err := newSignedInboundEvent(service.secure, domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		SourceID:       session.ID,
		Amount:         4.99,
		Currency:       "USD",
		OccurredAt:     clock().Add(2 * time.Second),
		IdempotencyKey: "evt-1",
		Metadata: map[string]any{
			"channel": "hosted-control",
		},
	})
	if err != nil {
		t.Fatalf("sign event: %v", err)
	}
	command, usage, err := service.HandleInboundEvent(context.Background(), event)
	if err != nil {
		t.Fatalf("handle event: %v", err)
	}
	if command.Intensity != 42 {
		t.Fatalf("expected mapped intensity 42, got %d", command.Intensity)
	}
	if usage.Metric != "api_calls" {
		t.Fatalf("expected usage metric api_calls, got %s", usage.Metric)
	}
	if err := secure.VerifyCommandSignature(command, mustServerPublicKey(t, service.secure)); err != nil {
		t.Fatalf("verify signature: %v", err)
	}
	grant, err := service.repo.GetGrantBySession(session.ID)
	if err != nil {
		t.Fatalf("load grant: %v", err)
	}
	payload, err := secure.DecryptCommandPayload(command, grant.SessionKey)
	if err != nil {
		t.Fatalf("decrypt command: %v", err)
	}
	if payload.DurationMS != 8400 {
		t.Fatalf("expected duration 8400, got %d", payload.DurationMS)
	}
}

func TestHandleInboundEventRejectsReplayAndCooldown(t *testing.T) {
	service, clock := newTestService(t)
	session, err := service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.ArmSession(context.Background(), session.ID, domain.ArmSessionRequest{
		BridgeID:    demoBridgeID,
		ExpiresInMS: 60_000,
	}); err != nil {
		t.Fatalf("arm session: %v", err)
	}

	event, err := newSignedInboundEvent(service.secure, domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		SourceID:       session.ID,
		Amount:         2.99,
		Currency:       "USD",
		OccurredAt:     clock().Add(2 * time.Second),
		IdempotencyKey: "evt-2",
		Metadata:       map[string]any{"channel": "hosted-control"},
	})
	if err != nil {
		t.Fatalf("sign event: %v", err)
	}
	if _, _, err := service.HandleInboundEvent(context.Background(), event); err != nil {
		t.Fatalf("first event: %v", err)
	}
	if _, _, err := service.HandleInboundEvent(context.Background(), event); err == nil {
		t.Fatalf("expected duplicate idempotency key error")
	}

	cooldownEvent, err := newSignedInboundEvent(service.secure, domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		SourceID:       session.ID,
		Amount:         1.99,
		Currency:       "USD",
		OccurredAt:     clock().Add(2500 * time.Millisecond),
		IdempotencyKey: "evt-3",
		Metadata:       map[string]any{"channel": "hosted-control"},
	})
	if err != nil {
		t.Fatalf("sign cooldown event: %v", err)
	}
	if _, _, err := service.HandleInboundEvent(context.Background(), cooldownEvent); err == nil {
		t.Fatalf("expected cooldown error")
	}
}

func TestHandleInboundEventRejectsInvalidSignature(t *testing.T) {
	service, clock := newTestService(t)
	session, err := service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.ArmSession(context.Background(), session.ID, domain.ArmSessionRequest{
		BridgeID:    demoBridgeID,
		ExpiresInMS: 60_000,
	}); err != nil {
		t.Fatalf("arm session: %v", err)
	}
	event := domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		SourceID:       session.ID,
		Amount:         4.99,
		Currency:       "USD",
		OccurredAt:     clock().Add(3 * time.Second),
		IdempotencyKey: "evt-bad",
		Metadata:       map[string]any{"channel": "hosted-control"},
		Signature:      "bad-signature",
	}
	if _, _, err := service.HandleInboundEvent(context.Background(), event); err == nil {
		t.Fatalf("expected invalid signature error")
	}
}

func TestPublishTelemetryStopsSessionAndRevokesGrant(t *testing.T) {
	service, _ := newTestService(t)
	session, err := service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.ArmSession(context.Background(), session.ID, domain.ArmSessionRequest{
		BridgeID:    demoBridgeID,
		ExpiresInMS: 60_000,
	}); err != nil {
		t.Fatalf("arm session: %v", err)
	}

	telemetry, err := service.PublishTelemetry(context.Background(), session.ID, domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryStopped,
		ExecutedAt:  time.Date(2026, 3, 14, 3, 0, 5, 0, time.UTC),
		DeviceState: "background-permission-lost",
		LatencyMS:   0,
		StopReason:  "background permission lost",
	})
	if err != nil {
		t.Fatalf("publish telemetry: %v", err)
	}
	if telemetry.StopReason != "background permission lost" {
		t.Fatalf("expected stop reason to be persisted, got %q", telemetry.StopReason)
	}

	updatedSession, err := service.repo.GetSession(session.ID)
	if err != nil {
		t.Fatalf("get session: %v", err)
	}
	if updatedSession.Status != domain.SessionStopped {
		t.Fatalf("expected session to be stopped, got %s", updatedSession.Status)
	}

	grant, err := service.repo.GetGrantBySession(session.ID)
	if err != nil {
		t.Fatalf("get grant: %v", err)
	}
	if grant.RevokedAt == nil {
		t.Fatalf("expected grant to be revoked")
	}
}

func TestWorkspaceOverviewIncludesRecentUsageAuditAndTelemetry(t *testing.T) {
	service, clock := newTestService(t)
	session, err := service.CreateSession(context.Background(), domain.CreateSessionRequest{
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
	})
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if _, err := service.ArmSession(context.Background(), session.ID, domain.ArmSessionRequest{
		BridgeID:    demoBridgeID,
		ExpiresInMS: 60_000,
	}); err != nil {
		t.Fatalf("arm session: %v", err)
	}

	event, err := newSignedInboundEvent(service.secure, domain.InboundEvent{
		EventType:      "tip.received",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		SourceID:       session.ID,
		Amount:         4.99,
		Currency:       "USD",
		OccurredAt:     clock().Add(2 * time.Second),
		IdempotencyKey: "evt-overview",
		Metadata:       map[string]any{"channel": "hosted-control"},
	})
	if err != nil {
		t.Fatalf("sign event: %v", err)
	}
	if _, _, err := service.HandleInboundEvent(context.Background(), event); err != nil {
		t.Fatalf("handle event: %v", err)
	}
	if _, err := service.PublishTelemetry(context.Background(), session.ID, domain.IngestTelemetryRequest{
		Sequence:    1,
		Status:      domain.TelemetryAck,
		ExecutedAt:  clock().Add(3 * time.Second),
		DeviceState: "command-accepted",
		LatencyMS:   31.5,
	}); err != nil {
		t.Fatalf("publish telemetry: %v", err)
	}

	overview, err := service.GetWorkspaceOverview(context.Background(), demoWorkspaceID, demoCreatorID)
	if err != nil {
		t.Fatalf("get overview: %v", err)
	}
	if overview.Workspace.ID != demoWorkspaceID {
		t.Fatalf("expected workspace %s, got %s", demoWorkspaceID, overview.Workspace.ID)
	}
	if overview.Creator.ID != demoCreatorID {
		t.Fatalf("expected creator %s, got %s", demoCreatorID, overview.Creator.ID)
	}
	if len(overview.Sessions) == 0 {
		t.Fatalf("expected overview sessions")
	}
	if len(overview.RecentUsage) == 0 {
		t.Fatalf("expected recent usage entries")
	}
	if len(overview.RecentAudit) == 0 {
		t.Fatalf("expected recent audit entries")
	}
	if len(overview.RecentTelemetry) == 0 {
		t.Fatalf("expected recent telemetry entries")
	}
	if overview.RecentTelemetry[0].Status != domain.TelemetryAck {
		t.Fatalf("expected latest telemetry to be ack, got %s", overview.RecentTelemetry[0].Status)
	}
	if overview.Metrics.AckCount == 0 {
		t.Fatalf("expected ack metrics to be populated")
	}
}

func newTestService(t *testing.T) (*ControlService, func() time.Time) {
	t.Helper()
	clock := time.Date(2026, 3, 14, 3, 0, 0, 0, time.UTC)
	store := store.NewMemoryStore()
	relay := relay.NewInMemoryRelay()
	secureEngine := secure.NewEngine([]byte("taas-server-signing"))
	service := NewControlService(store, store, relay, secureEngine, NewMetrics())
	service.now = func() time.Time {
		return clock
	}
	if err := service.SeedDemoData(); err != nil {
		t.Fatalf("seed demo data: %v", err)
	}
	return service, func() time.Time { return clock }
}

func newSignedInboundEvent(engine *secure.Engine, event domain.InboundEvent) (domain.InboundEvent, error) {
	privateDER, err := base64.StdEncoding.DecodeString(devPrivateKeyDER)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	privateKey, err := parsePKCS8Ed25519(privateDER)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	payload, err := engine.CanonicalizeInboundEvent(event)
	if err != nil {
		return domain.InboundEvent{}, err
	}
	signature := ed25519.Sign(privateKey, payload)
	event.Signature = base64.StdEncoding.EncodeToString(signature)
	return event, nil
}

func parsePKCS8Ed25519(der []byte) (ed25519.PrivateKey, error) {
	key, err := x509.ParsePKCS8PrivateKey(der)
	if err != nil {
		return nil, err
	}
	signer, ok := key.(ed25519.PrivateKey)
	if !ok {
		return nil, errors.New("parsed key is not Ed25519")
	}
	return signer, nil
}

func mustServerPublicKey(t *testing.T, engine *secure.Engine) string {
	t.Helper()
	key, err := engine.ServerSigningPublicKeySPKI()
	if err != nil {
		t.Fatalf("server signing public key: %v", err)
	}
	return key
}
