package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
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
	demoSessionID   = "session_demo"
)

const DevEndpointPublicKeySPKI = "MCowBQYDK2VwAyEActLEH8a4hP3A+lSi7xev4ifQuTsuEij9axOUqWioz5A="
const DevWorkspaceAPIKey = "taas_demo_workspace_key"

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

func (m *Metrics) Snapshot() domain.MetricsSnapshot {
	m.mu.Lock()
	latencies := append([]float64(nil), m.ackLatenciesMS...)
	perRegion := make(map[string]int64, len(m.perRegionFailures))
	for key, value := range m.perRegionFailures {
		perRegion[key] = value
	}
	m.mu.Unlock()

	sort.Float64s(latencies)
	return domain.MetricsSnapshot{
		AckCount:          len(latencies),
		AckP50MS:          percentile(latencies, 0.50),
		AckP95MS:          percentile(latencies, 0.95),
		WebhookFailures:   atomic.LoadInt64(&m.webhookFailures),
		RuleRejections:    atomic.LoadInt64(&m.ruleRejections),
		PanicStops:        atomic.LoadInt64(&m.panicStops),
		PerRegionFailures: perRegion,
	}
}

type ControlService struct {
	repo    store.Repository
	runtime store.RuntimeStore
	relay   relay.Relay
	secure  *secure.Engine
	metrics *Metrics
	now     func() time.Time
	idSeq   atomic.Int64
}

func NewControlService(repo store.Repository, runtime store.RuntimeStore, relay relay.Relay, secure *secure.Engine, metrics *Metrics) *ControlService {
	return &ControlService{
		repo:    repo,
		runtime: runtime,
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
	if err := s.repo.UpsertWorkspace(domain.Workspace{
		ID:        demoWorkspaceID,
		Name:      "TaaS Demo Workspace",
		Region:    "global-dev",
		CreatedAt: now,
	}); err != nil {
		return err
	}
	if err := s.repo.UpsertCreator(domain.Creator{
		ID:          demoCreatorID,
		WorkspaceID: demoWorkspaceID,
		DisplayName: "Creator Zero",
		CreatedAt:   now,
	}); err != nil {
		return err
	}
	if err := s.repo.UpsertBridge(domain.DeviceBridge{
		ID:                   demoBridgeID,
		WorkspaceID:          demoWorkspaceID,
		CreatorID:            demoCreatorID,
		Transport:            domain.TransportCloudflareRealtime,
		Status:               "online",
		FallbackWebSocketURL: "ws://localhost:8080/bridge/v1/sessions/{session_id}/connect",
		PublicKey:            DevEndpointPublicKeySPKI,
		TransportPublicKey:   "",
		CreatedAt:            now,
		LastSeenAt:           now,
		WrappedSessionKey:    sessionKey,
	}); err != nil {
		return err
	}
	if err := s.repo.UpsertDevice(domain.Device{
		ID:           demoDeviceID,
		BridgeID:     demoBridgeID,
		CreatorID:    demoCreatorID,
		Name:         "Loveseat Pulse",
		Capability:   domain.CapabilityVibrate,
		MaxIntensity: 88,
		Connected:    true,
		UpdatedAt:    now,
	}); err != nil {
		return err
	}
	if err := s.repo.UpsertRuleSet(domain.RuleSet{
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
	}); err != nil {
		return err
	}
	if err := s.repo.UpsertEndpoint(domain.InboundEndpoint{
		ID:             "endpoint_demo",
		WorkspaceID:    demoWorkspaceID,
		CreatorID:      demoCreatorID,
		PublicKeySPKI:  DevEndpointPublicKeySPKI,
		Active:         true,
		CreatedAt:      now,
		RotatedAt:      now,
		AllowedSources: []string{"hosted-control", "session_demo"},
	}); err != nil {
		return err
	}
	if err := s.repo.PutWorkspaceAPIKey(domain.WorkspaceAPIKey{
		ID:          "key_demo",
		WorkspaceID: demoWorkspaceID,
		Label:       "demo local development key",
		KeyPrefix:   "taas_demo",
		KeyHash:     store.HashWorkspaceAPIKey(DevWorkspaceAPIKey),
		CreatedAt:   now,
	}); err != nil {
		return err
	}
	armedAt := now
	demoSession := domain.Session{
		ID:            demoSessionID,
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		DeviceID:      demoDeviceID,
		RuleSetID:     demoRuleSetID,
		Status:        domain.SessionArmed,
		MaxIntensity:  88,
		MaxDurationMS: 12000,
		Sequence:      0,
		ArmedAt:       &armedAt,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	existingSession, err := s.repo.GetSession(demoSessionID)
	switch {
	case err == nil:
		demoSession.CreatedAt = existingSession.CreatedAt
		if err := s.repo.UpdateSession(demoSession); err != nil {
			return err
		}
	case errors.Is(err, store.ErrNotFound):
		if err := s.repo.CreateSession(demoSession); err != nil {
			return err
		}
	default:
		return err
	}
	if err := s.repo.PutGrant(domain.ControlGrant{
		ID:            "grant_demo",
		SessionID:     demoSessionID,
		BridgeID:      demoBridgeID,
		WorkspaceID:   demoWorkspaceID,
		CreatorID:     demoCreatorID,
		SessionKey:    append([]byte(nil), sessionKey...),
		ExpiresAt:     now.Add(24 * time.Hour),
		MaxIntensity:  demoSession.MaxIntensity,
		MaxDurationMS: demoSession.MaxDurationMS,
		CreatedAt:     now,
		LastRotatedAt: now,
	}); err != nil {
		return err
	}
	return nil
}

func (s *ControlService) nextID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, s.idSeq.Add(1))
}

func (s *ControlService) PairDeviceBridge(_ context.Context, request domain.PairDeviceBridgeRequest) (domain.PairDeviceBridgeResponse, error) {
	if request.WorkspaceID == "" || request.CreatorID == "" || request.TransportPublicKey == "" || request.DeviceName == "" {
		return domain.PairDeviceBridgeResponse{}, errors.New("workspace_id, creator_id, transport_public_key, and device_name are required")
	}
	if _, err := s.repo.GetWorkspace(request.WorkspaceID); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	if _, err := s.repo.GetCreator(request.CreatorID); err != nil {
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
		FallbackWebSocketURL: "wss://control.example.invalid/bridge/v1/sessions/{session_id}/connect",
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
	if err := s.repo.UpsertBridge(bridge); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	if err := s.repo.UpsertDevice(device); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
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
	}); err != nil {
		return domain.PairDeviceBridgeResponse{}, err
	}
	return domain.PairDeviceBridgeResponse{
		Bridge:                 bridge,
		Device:                 device,
		SessionKeyBundle:       bundle,
		ServerSigningPublicKey: signingPublicKey,
	}, nil
}

func (s *ControlService) CreateSession(_ context.Context, request domain.CreateSessionRequest) (domain.Session, error) {
	if _, err := s.repo.GetWorkspace(request.WorkspaceID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.repo.GetCreator(request.CreatorID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.repo.GetDevice(request.DeviceID); err != nil {
		return domain.Session{}, err
	}
	if _, err := s.repo.GetRuleSet(request.RuleSetID); err != nil {
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
	if err := s.repo.CreateSession(session); err != nil {
		return domain.Session{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
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
	}); err != nil {
		return domain.Session{}, err
	}
	return session, nil
}

func (s *ControlService) ArmSession(_ context.Context, sessionID string, request domain.ArmSessionRequest) (domain.Session, error) {
	session, err := s.repo.GetSession(sessionID)
	if err != nil {
		return domain.Session{}, err
	}
	bridge, err := s.repo.GetBridge(request.BridgeID)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	armedAt := now
	session.Status = domain.SessionArmed
	session.ArmedAt = &armedAt
	session.StopReason = ""
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(session); err != nil {
		return domain.Session{}, err
	}
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
	if err := s.repo.PutGrant(grant); err != nil {
		return domain.Session{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
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
	}); err != nil {
		return domain.Session{}, err
	}
	return session, nil
}

func (s *ControlService) StopSession(ctx context.Context, sessionID string, request domain.StopSessionRequest) (domain.Session, error) {
	session, err := s.repo.GetSession(sessionID)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	session.Status = domain.SessionStopped
	session.StopReason = request.Reason
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(session); err != nil {
		return domain.Session{}, err
	}
	_ = s.repo.RevokeGrant(session.ID, now)
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
	if err := s.repo.UpdateSession(session); err != nil {
		return domain.Session{}, err
	}
	if err := s.relay.StopAll(ctx, command, request.Reason); err != nil {
		return domain.Session{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
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
	}); err != nil {
		return domain.Session{}, err
	}
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
	if err := s.repo.UpsertRuleSet(ruleSet); err != nil {
		return domain.RuleSet{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: request.WorkspaceID,
		CreatorID:   request.CreatorID,
		Kind:        "ruleset.upserted",
		Actor:       "creator-console",
		Details: map[string]any{
			"rule_set_id": ruleSet.ID,
		},
		OccurredAt: now,
	}); err != nil {
		return domain.RuleSet{}, err
	}
	return ruleSet, nil
}

func (s *ControlService) HandleInboundEvent(ctx context.Context, event domain.InboundEvent) (domain.ControlCommand, domain.UsageLedgerEntry, error) {
	endpoint, err := s.repo.GetEndpointByCreator(event.WorkspaceID, event.CreatorID)
	if err != nil {
		s.metrics.IncWebhookFailure()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if err := s.secure.VerifyInboundSignature(event, endpoint.PublicKeySPKI); err != nil {
		s.metrics.IncWebhookFailure()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if !isAllowedInboundSource(endpoint, event) {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("event source is not allowed")
	}
	if err := s.runtime.ReserveIdempotency(event.WorkspaceID, event.IdempotencyKey, event.OccurredAt); err != nil {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	session, err := s.repo.GetSession(event.SourceID)
	if err != nil {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if session.Status != domain.SessionArmed {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("session is not armed")
	}
	ruleSet, err := s.repo.GetRuleSet(session.RuleSetID)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if !ruleSet.Enabled {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("ruleset is disabled")
	}
	grant, err := s.repo.GetGrantBySession(session.ID)
	if err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if grant.RevokedAt != nil || s.now().After(grant.ExpiresAt) {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("control grant expired")
	}
	if lastEventAt, ok := s.runtime.LastSessionEvent(session.ID); ok && s.now().Sub(lastEventAt) < time.Duration(ruleSet.CooldownMS)*time.Millisecond {
		s.metrics.IncRuleRejection()
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, errors.New("ruleset cooldown is active")
	}
	if count := s.runtime.AppendSessionEvent(session.ID, s.now(), time.Minute); count > ruleSet.RateLimitPerMinute {
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
	if err := s.repo.UpdateSession(session); err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
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
	if err := s.repo.AddUsage(usage); err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
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
	}); err != nil {
		return domain.ControlCommand{}, domain.UsageLedgerEntry{}, err
	}
	return command, usage, nil
}

func (s *ControlService) PublishTelemetry(ctx context.Context, sessionID string, request domain.IngestTelemetryRequest) (domain.TelemetryEvent, error) {
	session, err := s.repo.GetSession(sessionID)
	if err != nil {
		return domain.TelemetryEvent{}, err
	}
	if request.Status == "" {
		return domain.TelemetryEvent{}, errors.New("telemetry status is required")
	}
	now := s.now()
	executedAt := request.ExecutedAt
	if executedAt.IsZero() {
		executedAt = now
	}
	sequence := request.Sequence
	if sequence == 0 {
		sequence = session.Sequence
	}
	deviceState := request.DeviceState
	if deviceState == "" {
		deviceState = string(request.Status)
	}
	event := domain.TelemetryEvent{
		SessionID:   sessionID,
		Sequence:    sequence,
		Status:      request.Status,
		ExecutedAt:  executedAt,
		DeviceState: deviceState,
		LatencyMS:   request.LatencyMS,
		ErrorCode:   request.ErrorCode,
		StopReason:  request.StopReason,
	}

	if request.Status == domain.TelemetryAck || request.Status == domain.TelemetryExecuting {
		if request.LatencyMS > 0 {
			s.metrics.ObserveAckLatency(request.LatencyMS)
		}
	}

	if request.Status == domain.TelemetryStopped || request.StopReason != "" {
		session.Status = domain.SessionStopped
		session.StopReason = request.StopReason
		session.UpdatedAt = now
		if err := s.repo.UpdateSession(session); err != nil {
			return domain.TelemetryEvent{}, err
		}
		_ = s.repo.RevokeGrant(session.ID, now)
	}

	if err := s.repo.AddTelemetry(event); err != nil {
		return domain.TelemetryEvent{}, err
	}
	if err := s.repo.AddAudit(domain.AuditEvent{
		ID:          s.nextID("audit"),
		WorkspaceID: session.WorkspaceID,
		CreatorID:   session.CreatorID,
		SessionID:   session.ID,
		Kind:        "telemetry.received",
		Actor:       "companion-runtime",
		Details: map[string]any{
			"status":       event.Status,
			"sequence":     event.Sequence,
			"device_state": event.DeviceState,
			"latency_ms":   event.LatencyMS,
			"error_code":   event.ErrorCode,
			"stop_reason":  event.StopReason,
		},
		OccurredAt: now,
	}); err != nil {
		return domain.TelemetryEvent{}, err
	}
	if err := s.relay.PublishTelemetry(ctx, event); err != nil {
		return domain.TelemetryEvent{}, err
	}
	return event, nil
}

func (s *ControlService) GetWorkspaceOverview(_ context.Context, workspaceID, creatorID string) (domain.WorkspaceOverview, error) {
	workspace, err := s.repo.GetWorkspace(workspaceID)
	if err != nil {
		return domain.WorkspaceOverview{}, err
	}
	creator, err := s.repo.GetCreator(creatorID)
	if err != nil {
		return domain.WorkspaceOverview{}, err
	}
	if creator.WorkspaceID != workspaceID {
		return domain.WorkspaceOverview{}, errors.New("creator does not belong to workspace")
	}

	sessions := s.repo.ListSessions(workspaceID, creatorID)
	sessionIDs := make([]string, 0, len(sessions))
	for _, session := range sessions {
		sessionIDs = append(sessionIDs, session.ID)
	}

	return domain.WorkspaceOverview{
		Workspace:       workspace,
		Creator:         creator,
		Bridges:         s.repo.ListBridges(workspaceID, creatorID),
		Devices:         s.repo.ListDevices(creatorID),
		RuleSets:        s.repo.ListRuleSets(workspaceID, creatorID),
		Sessions:        sessions,
		RecentUsage:     s.repo.ListUsage(workspaceID, 10),
		RecentAudit:     s.repo.ListAudit(workspaceID, creatorID, 12),
		RecentTelemetry: s.repo.ListTelemetry(sessionIDs, 12),
		Metrics:         s.metrics.Snapshot(),
		GeneratedAt:     s.now(),
	}, nil
}

func (s *ControlService) SubscribeSession(sessionID string) (<-chan domain.TelemetryEvent, func()) {
	return s.relay.Subscribe(sessionID)
}

func (s *ControlService) Relay() relay.Relay {
	return s.relay
}

func (s *ControlService) RuntimeStore() store.RuntimeStore {
	return s.runtime
}

func (s *ControlService) MetricsSnapshot() domain.MetricsSnapshot {
	return s.metrics.Snapshot()
}

func (s *ControlService) StartHeartbeatWorker(ctx context.Context) {
	ticker := time.NewTicker(250 * time.Millisecond)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.dispatchHeartbeats(ctx)
			}
		}
	}()
}

func (s *ControlService) dispatchHeartbeats(ctx context.Context) {
	sessions := s.repo.ListArmedSessions()
	now := s.now()
	for _, session := range sessions {
		grant, err := s.repo.GetGrantBySession(session.ID)
		if err != nil {
			continue
		}
		if grant.RevokedAt != nil || now.After(grant.ExpiresAt) {
			continue
		}

		// Sequence is not strictly required for heartbeats to increment in the DB
		// but we send it for tracking.
		hb := domain.ControlCommand{
			SessionID:  session.ID,
			Sequence:   atomic.AddInt64(&session.Sequence, 1),
			DeviceID:   session.DeviceID,
			Action:     domain.ActionHeartbeat,
			IssuedAt:   now,
			ExpiresAt:  now.Add(1 * time.Second),
			Ciphertext: "", // Heartbeats are not encrypted payloads in this version, just signed
		}

		sig, err := s.secure.SignControlCommand(hb)
		if err != nil {
			continue
		}
		hb.Signature = sig

		_ = s.relay.Dispatch(ctx, hb)
	}
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

func percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	if len(values) == 1 {
		return values[0]
	}
	index := int(math.Ceil(float64(len(values))*p)) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(values) {
		index = len(values) - 1
	}
	return values[index]
}

func isAllowedInboundSource(endpoint domain.InboundEndpoint, event domain.InboundEvent) bool {
	if len(endpoint.AllowedSources) == 0 {
		return true
	}

	for _, candidate := range inboundSourceCandidates(event) {
		for _, allowed := range endpoint.AllowedSources {
			if candidate == allowed {
				return true
			}
		}
	}

	return false
}

func inboundSourceCandidates(event domain.InboundEvent) []string {
	candidates := make([]string, 0, 2)
	if event.SourceID != "" {
		candidates = append(candidates, event.SourceID)
	}
	if channel, ok := event.Metadata["channel"].(string); ok && channel != "" {
		candidates = append(candidates, channel)
	}
	return candidates
}
