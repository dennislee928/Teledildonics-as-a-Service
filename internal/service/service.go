package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"sync/atomic"
	"time"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/relay"
	"github.com/taas-hq/taas/internal/secure"
	"github.com/taas-hq/taas/internal/store"
)

const (
	demoWorkspaceID = "ws_demo"
	demoCreatorID   = "cr_demo"
	demoBridgeID    = "bridge_demo"
	demoDeviceID    = "device_demo"
	demoRuleSetID   = "rule_demo"
)

const DevEndpointPublicKeySPKI = "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A="

type Metrics struct {
	mu                sync.Mutex
	ackLatenciesMS    []float64
	webhookFailures   int64
	ruleRejections    int64
	panicStops        int64
	perRegionFailures map[string]int64
}

func NewMetrics() *Metrics {
	return &Metrics{
		perRegionFailures: make(map[string]int64),
	}
}

func (m *Metrics) ObserveAckLatency(ms float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ackLatenciesMS = append(m.ackLatenciesMS, ms)
}

func (m *Metrics) IncWebhookFailure() {
	atomic.AddInt64(&m.webhookFailures, 1)
}

func (m *Metrics) IncRuleRejection() {
	atomic.AddInt64(&m.ruleRejections, 1)
}

func (m *Metrics) IncPanicStop() {
	atomic.AddInt64(&m.panicStops, 1)
}

type ControlService struct {
	store   *store.MemoryStore
	relay   relay.Relay
	secure  *secure.Engine
	metrics *Metrics
	now     func() time.Time
	idSeq   atomic.Int64
}

func NewControlService(store *store.MemoryStore, relay relay.Relay, secure *secure.Engine, metrics *Metrics) *ControlService {
	return &ControlService{
		store:   store,
		relay:   relay,
		secure:  secure,
		metrics: metrics,
		now: func() time.Time {
			return time.Now().UTC()
		},
	}
}

func (s *ControlService) SeedDemoData() error {
	now := s.now()
	sessionKey, err := s.secure.GenerateSessionKey()
	if err != nil {
		return err
	}
	s.store.Seed(
		domain.Workspace{
			ID:        demoWorkspaceID,
			Name:      "TaaS Demo Workspace",
			Region:    "global-dev",
			CreatedAt: now,
		},
		domain.Creator{
			ID:          demoCreatorID,
			WorkspaceID: demoWorkspaceID,
			DisplayName: "Creator Zero",
			CreatedAt:   now,
		},
		domain.DeviceBridge{
			ID:                   demoBridgeID,
			WorkspaceID:          demoWorkspaceID,
			CreatorID:            demoCreatorID,
			Transport:            domain.TransportCloudflareRealtime,
			Status:               "online",
			FallbackWebSocketURL: "wss://localhost:8080/ws/fallback",
			PublicKey:            DevEndpointPublicKeySPKI,
			TransportPublicKey:   "",
			CreatedAt:            now,
			LastSeenAt:           now,
			WrappedSessionKey:    sessionKey,
		},
		domain.Device{
			ID:           demoDeviceID,
			BridgeID:     demoBridgeID,
			CreatorID:    demoCreatorID,
			Name:         "Loveseat Pulse",
			Capability:   domain.CapabilityVibrate,
			MaxIntensity: 88,
			Connected:    true,
			UpdatedAt:    now,
		},
		domain.RuleSet{
			ID:                 demoRuleSetID,
			WorkspaceID:        demoWorkspaceID,
			CreatorID:          demoCreatorID,
			AmountStepCents:    200,
			IntensityStep:      14,
			MaxIntensity:       88,
			DurationPerStepMS:  2800,
			MaxDurationMS:      12000,
			CooldownMS:         750,
			RateLimitPerMinute: 45,
			PatternID:          "pulse-wave",
			Enabled:            true,
			UpdatedAt:          now,
		},
		domain.InboundEndpoint{
			ID:             "endpoint_demo",
			WorkspaceID:    demoWorkspaceID,
			CreatorID:      demoCreatorID,
			PublicKeySPKI:  DevEndpointPublicKeySPKI,
			Active:         true,
			CreatedAt:      now,
			RotatedAt:      now,
			AllowedSources: []string{"hosted-control", "session_demo"},
		},
	)
	return nil
}

func (s *ControlService) nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, s.idSeq.Add(1))
}

func (s *ControlService) PairDeviceBridge(_ context.Context, request domain.PairDeviceBridgeRequest) (domain.PairDeviceBridgeResponse, error) {
	if request.WorkspaceID == "" || request.CreatorID == "" || request.TransportPublicKey == "" || request.DeviceName == "" {
		return domain.PairDeviceBridgeResponse{}, errors.New("workspace_id, creator_id, transport_public_key, and device_name are required")
	}
	if _, err := s.store.GetWorkspace(request.WorkspaceID); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	if _, err := s.store.GetCreator(request.CreatorID); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	now := s.now()
	sessionKey, err := s.secure.GenerateSessionKey()
	if err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	bundle, err := s.secure.WrapSessionKey(request.TransportPublicKey, sessionKey)
	if err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	signingPublicKey, err := s.secure.ServerSigningPublicKeySPKI()
	if err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	bridgeID := request.BridgeID
	if bridgeID == "" {
		bridgeID = s.nextID("bridge")
	}
	bridge := domain.DeviceBridge{
		ID:                   bridgeID,
		WorkspaceID:          request.WorkspaceID,
		CreatorID:            request.CreatorID,
		Transport:            domain.TransportCloudflareRealtime,
		Status:               "online",
		FallbackWebSocketURL: fmt.Sprintf("wss://control.example.invalid/fallback/%s", bridgeID),
		PublicKey:            signingPublicKey,
		TransportPublicKey:   request.TransportPublicKey,
		CreatedAt:            now,
		LastSeenAt:           now,
		WrappedSessionKey:    sessionKey,
	}
	deviceID := demoDeviceID
	if bridgeID != demoBridgeID {
		deviceID = s.nextID("device")
	}
	device := domain.Device{
		ID:           deviceID,
		BridgeID:     bridge.ID,
		CreatorID:    request.CreatorID,
		Name:         request.DeviceName,
		Capability:   request.Capability,
		MaxIntensity: request.MaxIntensity,
		Connected:    true,
		UpdatedAt:    now,
	}
	s.store.UpsertBridge(bridge)
	s.store.UpsertDevice(device)
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: request.WorkspaceID,
		CreatorID:   request.CreatorID,
		Kind:        "device_bridge.paired",
		Actor:       "creator-console",
		Details: map[string]any{
			"bridge_id": bridge.ID,
			"device_id": device.ID,
		},
		OccurredAt: now,
	})
	return domain.PairDeviceBridgeResponse{
		Bridge:                 bridge,
		Device:                 device,
		SessionKeyBundle:       bundle,
		ServerSigningPublicKey: signingPublicKey,
	}, nil
}

func (s *ControlService) CreateSession(_ context.Context, request domain.CreateSessionRequest) (domain.Session, error) {
	if _, err := s.store.GetWorkspace(request.WorkspaceID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.store.GetCreator(request.CreatorID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.store.GetDevice(request.DeviceID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.store.GetRuleSet(request.RuleSetID); err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	session := domain.Session{
		ID:            s.nextID("session"),
		WorkspaceID:   request.WorkspaceID,
		CreatorID:     request.CreatorID,
		DeviceID:      request.DeviceID,
		RuleSetID:     request.RuleSetID,
		Status:        domain.SessionPending,
		MaxIntensity:  request.MaxIntensity,
		MaxDurationMS: request.MaxDurationMS,
		Sequence:      0,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	s.store.CreateSession(session)
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: session.WorkspaceID,
		CreatorID:   session.CreatorID,
		SessionID:   session.ID,
		Kind:        "session.created",
		Actor:       "creator-console",
		Details: map[string]any{
			"device_id":   session.DeviceID,
			"rule_set_id": session.RuleSetID,
		},
		OccurredAt: now,
	})
	return session, nil
}

func (s *ControlService) ArmSession(_ context.Context, sessionID string, request domain.ArmSessionRequest) (domain.Session, error) {
	session, err := s.store.GetSession(sessionID)
	if err != nil {
		return domain.Session{}, err
	}
	bridge, err := s.store.GetBridge(request.BridgeID)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	armedAt := now
	session.Status = domain.SessionArmed
	session.ArmedAt = &armedAt
	session.StopReason = ""
	session.UpdatedAt = now
	s.store.UpdateSession(session)
	grant := domain.ControlGrant{
		ID:            s.nextID("grant"),
		SessionID:     session.ID,
		BridgeID:      bridge.ID,
		WorkspaceID:   session.WorkspaceID,
		CreatorID:     session.CreatorID,
		SessionKey:    append([]byte(nil), bridge.WrappedSessionKey...),
		ExpiresAt:     now.Add(time.Duration(request.ExpiresInMS) * time.Millisecond),
		MaxIntensity:  session.MaxIntensity,
		MaxDurationMS: session.MaxDurationMS,
		CreatedAt:     now,
		LastRotatedAt: now,
	}
	s.store.PutGrant(grant)
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: session.WorkspaceID,
		CreatorID:   session.CreatorID,
		SessionID:   session.ID,
		Kind:        "session.armed",
		Actor:       "creator-console",
		Details: map[string]any{
			"bridge_id":  bridge.ID,
			"expires_at": grant.ExpiresAt.Format(time.RFC3339Nano),
		},
		OccurredAt: now,
	})
	return session, nil
}

func (s *ControlService) StopSession(ctx context.Context, sessionID string, request domain.StopSessionRequest) (domain.Session, error) {
	session, err := s.store.GetSession(sessionID)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	session.Status = domain.SessionStopped
	session.StopReason = request.Reason
	session.UpdatedAt = now
	s.store.UpdateSession(session)
	_ = s.store.RevokeGrant(session.ID, now)
	s.metrics.IncPanicStop()
	command := domain.ControlCommand{
		SessionID:  session.ID,
		Sequence:   session.Sequence + 1,
		DeviceID:   session.DeviceID,
		Action:     domain.ActionStopAll,
		Intensity:  0,
		DurationMS: 0,
		PatternID:  "",
		Nonce:      "",
		IssuedAt:   now,
		ExpiresAt:  now,
		Ciphertext: "",
	}
	command.Signature, err = s.secure.SignStopCommand(command)
	if err != nil {
		return domain.Session{}, err
	}
	session.Sequence = command.Sequence
	s.store.UpdateSession(session)
	if err := s.relay.StopAll(ctx, command, request.Reason); err != nil {
		return domain.Session{}, err
	}
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: session.WorkspaceID,
		CreatorID:   session.CreatorID,
		SessionID:   session.ID,
		Kind:        "session.stopped",
		Actor:       "creator-console",
		Details: map[string]any{
			"reason": request.Reason,
		},
		OccurredAt: now,
	})
	return session, nil
}

func (s *ControlService) UpsertRuleSet(_ context.Context, id string, request domain.UpsertRuleSetRequest) (domain.RuleSet, error) {
	if id == "" {
		id = s.nextID("rule")
	}
	now := s.now()
	ruleSet := domain.RuleSet{
		ID:                 id,
		WorkspaceID:        request.WorkspaceID,
		CreatorID:          request.CreatorID,
		AmountStepCents:    request.AmountStepCents,
		IntensityStep:      request.IntensityStep,
		MaxIntensity:       request.MaxIntensity,
		DurationPerStepMS:  request.DurationPerStepMS,
		MaxDurationMS:      request.MaxDurationMS,
		CooldownMS:         request.CooldownMS,
		RateLimitPerMinute: request.RateLimitPerMinute,
		PatternID:          request.PatternID,
		Enabled:            request.Enabled,
		UpdatedAt:          now,
	}
	s.store.UpsertRuleSet(ruleSet)
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: request.WorkspaceID,
		CreatorID:   request.CreatorID,
		Kind:        "ruleset.upserted",
		Actor:       "creator-console",
		Details: map[string]any{
			"rule_set_id": ruleSet.ID,
		},
		OccurredAt: now,
	})
	return ruleSet, nil
}

func (s *ControlService) HandleInboundEvent(ctx context.Context, event domain.InboundEvent) (domain.ControlCommand, domain.UsageLedgerEntry, error) {
	endpoint, err := s.store.GetEndpointByCreator(event.WorkspaceID, event.CreatorID)
	if err != nil {
		s.metrics.IncWebhookFailure()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if err := s.secure.VerifyInboundSignature(event, endpoint.PublicKeySPKI); err != nil {
		s.metrics.IncWebhookFailure()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if err := s.store.ReserveIdempotency(event.WorkspaceID, event.IdempotencyKey, event.OccurredAt); err != nil {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	session, err := s.store.GetSession(event.SourceID)
	if err != nil {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if session.Status != domain.SessionArmed {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("session is not armed")
	}
	ruleSet, err := s.store.GetRuleSet(session.RuleSetID)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if !ruleSet.Enabled {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("ruleset is disabled")
	}
	grant, err := s.store.GetGrantBySession(session.ID)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if grant.RevokedAt != nil || s.now().After(grant.ExpiresAt) {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("control grant expired")
	}
	if lastEventAt, ok := s.store.LastSessionEvent(session.ID); ok && s.now().Sub(lastEventAt) < time.Duration(ruleSet.CooldownMS)*time.Millisecond {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("ruleset cooldown is active")
	}
	if count := s.store.AppendSessionEvent(session.ID, s.now(), time.Minute); count > ruleSet.RateLimitPerMinute {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("ruleset rate limit exceeded")
	}

	stepCount := int(math.Ceil((event.Amount * 100) / float64(ruleSet.AmountStepCents)))
	if stepCount < 1 {
		stepCount = 1
	}
	intensity := minInt(session.MaxIntensity, grant.MaxIntensity, ruleSet.MaxIntensity, stepCount*ruleSet.IntensityStep)
	durationMS := minInt(session.MaxDurationMS, grant.MaxDurationMS, ruleSet.MaxDurationMS, stepCount*ruleSet.DurationPerStepMS)
	now := s.now()
	commandPayload := domain.CommandPayload{
		SessionID:  session.ID,
		DeviceID:   session.DeviceID,
		Action:     domain.ActionApply,
		Intensity:  intensity,
		DurationMS: durationMS,
		PatternID:  ruleSet.PatternID,
		IssuedAt:   now,
		ExpiresAt:  minTime(now.Add(time.Duration(durationMS)*time.Millisecond), grant.ExpiresAt),
	}
	encrypted, err := s.secure.EncryptCommand(commandPayload, grant.SessionKey)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	session.Sequence++
	session.UpdatedAt = now
	s.store.UpdateSession(session)
	command := domain.ControlCommand{
		SessionID:  session.ID,
		Sequence:   session.Sequence,
		DeviceID:   session.DeviceID,
		Action:     domain.ActionApply,
		Intensity:  intensity,
		DurationMS: durationMS,
		PatternID:  ruleSet.PatternID,
		Nonce:      encrypted.Nonce,
		IssuedAt:   commandPayload.IssuedAt,
		ExpiresAt:  commandPayload.ExpiresAt,
		Ciphertext: encrypted.Ciphertext,
	}
	command.Signature, err = s.secure.SignControlCommand(command)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if err := s.relay.Dispatch(ctx, command); err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	s.metrics.ObserveAckLatency(25)
	usage := domain.UsageLedgerEntry{
		ID:          s.nextID("usage"),
		WorkspaceID: session.WorkspaceID,
		SessionID:   session.ID,
		Metric:      "api_calls",
		Units:       1,
		OccurredAt:  now,
		Metadata: map[string]any{
			"event_type":   event.EventType,
			"amount":       event.Amount,
			"currency":     event.Currency,
			"intensity":    intensity,
			"duration_ms":  durationMS,
			"idempotency":  event.IdempotencyKey,
			"sequence":     session.Sequence,
			"control_mode": "event-driven",
		},
	}
	s.store.AddUsage(usage)
	s.store.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: session.WorkspaceID,
		CreatorID:   session.CreatorID,
		SessionID:   session.ID,
		Kind:        "control.command_dispatched",
		Actor:       "rules-engine",
		Details: map[string]any{
			"amount":      event.Amount,
			"intensity":   intensity,
			"duration_ms": durationMS,
		},
		OccurredAt: now,
	})
	return command, usage, nil
}

func (s *ControlService) SubscribeSession(sessionID string) (<-chan domain.TelemetryEvent, func()) {
	return s.relay.Subscribe(sessionID)
}

func minTime(values ...time.Time) time.Time {
	result := values[0]
	for _, value := range values[1:] {
		if value.Before(result) {
			result = value
		}
	}
	return result
}

func minInt(values ...int) int {
	result := values[0]
	for _, value := range values[1:] {
		if value < result {
			result = value
		}
	}
	return result
}
