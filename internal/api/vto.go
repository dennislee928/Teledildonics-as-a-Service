package api

import (
	"strconv"
	"time"

	"github.com/taas-hq/taas/internal/domain"
)

type healthStatusVTO struct {
	Status string `json:"status"`
}

type readinessCheckVTO struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type readinessStatusVTO struct {
	Status string                       `json:"status"`
	Checks map[string]readinessCheckVTO `json:"checks"`
}

type apiErrorVTO struct {
	Error string `json:"error"`
}

type inboundEventAcceptedVTO struct {
	Accepted bool                `json:"accepted"`
	Command  controlCommandVTO   `json:"command"`
	Usage    usageLedgerEntryVTO `json:"usage"`
}

type workspaceVTO struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Region    string    `json:"region"`
	CreatedAt time.Time `json:"createdAt"`
}

type creatorVTO struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	DisplayName string    `json:"displayName"`
	CreatedAt   time.Time `json:"createdAt"`
}

type deviceBridgeVTO struct {
	ID                   string    `json:"id"`
	WorkspaceID          string    `json:"workspaceId"`
	CreatorID            string    `json:"creatorId"`
	Transport            string    `json:"transport"`
	Status               string    `json:"status"`
	FallbackWebSocketURL string    `json:"fallbackWebsocketUrl"`
	PublicKey            string    `json:"publicKey"`
	TransportPublicKey   string    `json:"transportPublicKey"`
	CreatedAt            time.Time `json:"createdAt"`
	LastSeenAt           time.Time `json:"lastSeenAt"`
}

type deviceVTO struct {
	ID           string    `json:"id"`
	BridgeID     string    `json:"bridgeId"`
	CreatorID    string    `json:"creatorId"`
	Name         string    `json:"name"`
	Capability   string    `json:"capability"`
	MaxIntensity int       `json:"maxIntensity"`
	Connected    bool      `json:"connected"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type ruleSetVTO struct {
	ID                 string    `json:"id"`
	WorkspaceID        string    `json:"workspaceId"`
	CreatorID          string    `json:"creatorId"`
	AmountStepCents    int64     `json:"amountStepCents"`
	IntensityStep      int       `json:"intensityStep"`
	MaxIntensity       int       `json:"maxIntensity"`
	DurationPerStepMS  int       `json:"durationPerStepMs"`
	MaxDurationMS      int       `json:"maxDurationMs"`
	CooldownMS         int       `json:"cooldownMs"`
	RateLimitPerMinute int       `json:"rateLimitPerMinute"`
	PatternID          string    `json:"patternId"`
	Enabled            bool      `json:"enabled"`
	UpdatedAt          time.Time `json:"updatedAt"`
}

type sessionVTO struct {
	ID            string     `json:"id"`
	WorkspaceID   string     `json:"workspaceId"`
	CreatorID     string     `json:"creatorId"`
	DeviceID      string     `json:"deviceId"`
	RuleSetID     string     `json:"ruleSetId"`
	Status        string     `json:"status"`
	MaxIntensity  int        `json:"maxIntensity"`
	MaxDurationMS int        `json:"maxDurationMs"`
	Sequence      int64      `json:"sequence"`
	ArmedAt       *time.Time `json:"armedAt,omitempty"`
	StopReason    string     `json:"stopReason,omitempty"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type pairingBundleVTO struct {
	ServerTransportPublicKey string `json:"server_transport_public_key"`
	Nonce                    string `json:"nonce"`
	Ciphertext               string `json:"ciphertext"`
}

type pairDeviceBridgeResponseVTO struct {
	Bridge                 deviceBridgeVTO  `json:"bridge"`
	Device                 deviceVTO        `json:"device"`
	SessionKeyBundle       pairingBundleVTO `json:"session_key_bundle"`
	ServerSigningPublicKey string           `json:"server_signing_public_key"`
}

type usageLedgerEntryVTO struct {
	ID          string         `json:"id"`
	WorkspaceID string         `json:"workspace_id"`
	SessionID   string         `json:"session_id"`
	Metric      string         `json:"metric"`
	Units       float64        `json:"units"`
	OccurredAt  time.Time      `json:"occurred_at"`
	Metadata    map[string]any `json:"metadata"`
}

type auditEventVTO struct {
	ID          string         `json:"id"`
	WorkspaceID string         `json:"workspace_id"`
	CreatorID   string         `json:"creator_id"`
	SessionID   string         `json:"session_id,omitempty"`
	Kind        string         `json:"kind"`
	Actor       string         `json:"actor"`
	Details     map[string]any `json:"details"`
	OccurredAt  time.Time      `json:"occurred_at"`
}

type controlCommandVTO struct {
	SessionID  string    `json:"session_id"`
	Sequence   int64     `json:"sequence"`
	DeviceID   string    `json:"device_id"`
	Action     string    `json:"action"`
	Intensity  int       `json:"intensity"`
	DurationMS int       `json:"duration_ms"`
	PatternID  string    `json:"pattern_id"`
	Nonce      string    `json:"nonce"`
	IssuedAt   time.Time `json:"issued_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	Ciphertext string    `json:"ciphertext"`
	Signature  string    `json:"signature"`
}

type telemetryEventVTO struct {
	SessionID   string    `json:"session_id"`
	Sequence    int64     `json:"sequence"`
	Status      string    `json:"status"`
	ExecutedAt  time.Time `json:"executed_at"`
	DeviceState string    `json:"device_state"`
	LatencyMS   float64   `json:"latency_ms"`
	ErrorCode   string    `json:"error_code,omitempty"`
	StopReason  string    `json:"stop_reason,omitempty"`
}

type metricsSnapshotVTO struct {
	AckCount          int              `json:"ack_count"`
	AckP50MS          float64          `json:"ack_p50_ms"`
	AckP95MS          float64          `json:"ack_p95_ms"`
	WebhookFailures   int64            `json:"webhook_failures"`
	RuleRejections    int64            `json:"rule_rejections"`
	PanicStops        int64            `json:"panic_stops"`
	PerRegionFailures map[string]int64 `json:"per_region_failures"`
}

type workspaceOverviewVTO struct {
	Workspace       workspaceVTO          `json:"workspace"`
	Creator         creatorVTO            `json:"creator"`
	Bridges         []deviceBridgeVTO     `json:"bridges"`
	Devices         []deviceVTO           `json:"devices"`
	RuleSets        []ruleSetVTO          `json:"rulesets"`
	Sessions        []sessionVTO          `json:"sessions"`
	RecentUsage     []usageLedgerEntryVTO `json:"recent_usage"`
	RecentAudit     []auditEventVTO       `json:"recent_audit"`
	RecentTelemetry []telemetryEventVTO   `json:"recent_telemetry"`
	Metrics         metricsSnapshotVTO    `json:"metrics"`
	GeneratedAt     time.Time             `json:"generated_at"`
}

type hotZonesVTO map[string]int64

func newInboundEventAcceptedVTO(command domain.ControlCommand, usage domain.UsageLedgerEntry) inboundEventAcceptedVTO {
	return inboundEventAcceptedVTO{
		Accepted: true,
		Command:  newControlCommandVTO(command),
		Usage:    newUsageLedgerEntryVTO(usage),
	}
}

func newWorkspaceVTO(workspace domain.Workspace) workspaceVTO {
	return workspaceVTO{
		ID:        workspace.ID,
		Name:      workspace.Name,
		Region:    workspace.Region,
		CreatedAt: workspace.CreatedAt,
	}
}

func newCreatorVTO(creator domain.Creator) creatorVTO {
	return creatorVTO{
		ID:          creator.ID,
		WorkspaceID: creator.WorkspaceID,
		DisplayName: creator.DisplayName,
		CreatedAt:   creator.CreatedAt,
	}
}

func newDeviceBridgeVTO(bridge domain.DeviceBridge) deviceBridgeVTO {
	return deviceBridgeVTO{
		ID:                   bridge.ID,
		WorkspaceID:          bridge.WorkspaceID,
		CreatorID:            bridge.CreatorID,
		Transport:            string(bridge.Transport),
		Status:               bridge.Status,
		FallbackWebSocketURL: bridge.FallbackWebSocketURL,
		PublicKey:            bridge.PublicKey,
		TransportPublicKey:   bridge.TransportPublicKey,
		CreatedAt:            bridge.CreatedAt,
		LastSeenAt:           bridge.LastSeenAt,
	}
}

func newDeviceVTO(device domain.Device) deviceVTO {
	return deviceVTO{
		ID:           device.ID,
		BridgeID:     device.BridgeID,
		CreatorID:    device.CreatorID,
		Name:         device.Name,
		Capability:   string(device.Capability),
		MaxIntensity: device.MaxIntensity,
		Connected:    device.Connected,
		UpdatedAt:    device.UpdatedAt,
	}
}

func newRuleSetVTO(ruleSet domain.RuleSet) ruleSetVTO {
	return ruleSetVTO{
		ID:                 ruleSet.ID,
		WorkspaceID:        ruleSet.WorkspaceID,
		CreatorID:          ruleSet.CreatorID,
		AmountStepCents:    ruleSet.AmountStepCents,
		IntensityStep:      ruleSet.IntensityStep,
		MaxIntensity:       ruleSet.MaxIntensity,
		DurationPerStepMS:  ruleSet.DurationPerStepMS,
		MaxDurationMS:      ruleSet.MaxDurationMS,
		CooldownMS:         ruleSet.CooldownMS,
		RateLimitPerMinute: ruleSet.RateLimitPerMinute,
		PatternID:          ruleSet.PatternID,
		Enabled:            ruleSet.Enabled,
		UpdatedAt:          ruleSet.UpdatedAt,
	}
}

func newSessionVTO(session domain.Session) sessionVTO {
	return sessionVTO{
		ID:            session.ID,
		WorkspaceID:   session.WorkspaceID,
		CreatorID:     session.CreatorID,
		DeviceID:      session.DeviceID,
		RuleSetID:     session.RuleSetID,
		Status:        string(session.Status),
		MaxIntensity:  session.MaxIntensity,
		MaxDurationMS: session.MaxDurationMS,
		Sequence:      session.Sequence,
		ArmedAt:       session.ArmedAt,
		StopReason:    session.StopReason,
		CreatedAt:     session.CreatedAt,
		UpdatedAt:     session.UpdatedAt,
	}
}

func newPairingBundleVTO(bundle domain.PairingBundle) pairingBundleVTO {
	return pairingBundleVTO{
		ServerTransportPublicKey: bundle.ServerTransportPublicKey,
		Nonce:                    bundle.Nonce,
		Ciphertext:               bundle.Ciphertext,
	}
}

func newPairDeviceBridgeResponseVTO(response domain.PairDeviceBridgeResponse) pairDeviceBridgeResponseVTO {
	return pairDeviceBridgeResponseVTO{
		Bridge:                 newDeviceBridgeVTO(response.Bridge),
		Device:                 newDeviceVTO(response.Device),
		SessionKeyBundle:       newPairingBundleVTO(response.SessionKeyBundle),
		ServerSigningPublicKey: response.ServerSigningPublicKey,
	}
}

func newUsageLedgerEntryVTO(entry domain.UsageLedgerEntry) usageLedgerEntryVTO {
	return usageLedgerEntryVTO{
		ID:          entry.ID,
		WorkspaceID: entry.WorkspaceID,
		SessionID:   entry.SessionID,
		Metric:      entry.Metric,
		Units:       entry.Units,
		OccurredAt:  entry.OccurredAt,
		Metadata:    entry.Metadata,
	}
}

func newAuditEventVTO(entry domain.AuditEvent) auditEventVTO {
	return auditEventVTO{
		ID:          entry.ID,
		WorkspaceID: entry.WorkspaceID,
		CreatorID:   entry.CreatorID,
		SessionID:   entry.SessionID,
		Kind:        entry.Kind,
		Actor:       entry.Actor,
		Details:     entry.Details,
		OccurredAt:  entry.OccurredAt,
	}
}

func newControlCommandVTO(command domain.ControlCommand) controlCommandVTO {
	return controlCommandVTO{
		SessionID:  command.SessionID,
		Sequence:   command.Sequence,
		DeviceID:   command.DeviceID,
		Action:     string(command.Action),
		Intensity:  command.Intensity,
		DurationMS: command.DurationMS,
		PatternID:  command.PatternID,
		Nonce:      command.Nonce,
		IssuedAt:   command.IssuedAt,
		ExpiresAt:  command.ExpiresAt,
		Ciphertext: command.Ciphertext,
		Signature:  command.Signature,
	}
}

func newTelemetryEventVTO(event domain.TelemetryEvent) telemetryEventVTO {
	return telemetryEventVTO{
		SessionID:   event.SessionID,
		Sequence:    event.Sequence,
		Status:      string(event.Status),
		ExecutedAt:  event.ExecutedAt,
		DeviceState: event.DeviceState,
		LatencyMS:   event.LatencyMS,
		ErrorCode:   event.ErrorCode,
		StopReason:  event.StopReason,
	}
}

func newMetricsSnapshotVTO(snapshot domain.MetricsSnapshot) metricsSnapshotVTO {
	return metricsSnapshotVTO{
		AckCount:          snapshot.AckCount,
		AckP50MS:          snapshot.AckP50MS,
		AckP95MS:          snapshot.AckP95MS,
		WebhookFailures:   snapshot.WebhookFailures,
		RuleRejections:    snapshot.RuleRejections,
		PanicStops:        snapshot.PanicStops,
		PerRegionFailures: snapshot.PerRegionFailures,
	}
}

func newWorkspaceOverviewVTO(overview domain.WorkspaceOverview) workspaceOverviewVTO {
	return workspaceOverviewVTO{
		Workspace:       newWorkspaceVTO(overview.Workspace),
		Creator:         newCreatorVTO(overview.Creator),
		Bridges:         newDeviceBridgeVTOs(overview.Bridges),
		Devices:         newDeviceVTOs(overview.Devices),
		RuleSets:        newRuleSetVTOs(overview.RuleSets),
		Sessions:        newSessionVTOs(overview.Sessions),
		RecentUsage:     newUsageLedgerEntryVTOs(overview.RecentUsage),
		RecentAudit:     newAuditEventVTOs(overview.RecentAudit),
		RecentTelemetry: newTelemetryEventVTOs(overview.RecentTelemetry),
		Metrics:         newMetricsSnapshotVTO(overview.Metrics),
		GeneratedAt:     overview.GeneratedAt,
	}
}

func newHotZonesVTO(zones map[float64]int64) hotZonesVTO {
	response := make(hotZonesVTO, len(zones))
	for amount, count := range zones {
		response[strconv.FormatFloat(amount, 'f', -1, 64)] = count
	}
	return response
}

func newDeviceBridgeVTOs(bridges []domain.DeviceBridge) []deviceBridgeVTO {
	response := make([]deviceBridgeVTO, 0, len(bridges))
	for _, bridge := range bridges {
		response = append(response, newDeviceBridgeVTO(bridge))
	}
	return response
}

func newDeviceVTOs(devices []domain.Device) []deviceVTO {
	response := make([]deviceVTO, 0, len(devices))
	for _, device := range devices {
		response = append(response, newDeviceVTO(device))
	}
	return response
}

func newRuleSetVTOs(ruleSets []domain.RuleSet) []ruleSetVTO {
	response := make([]ruleSetVTO, 0, len(ruleSets))
	for _, ruleSet := range ruleSets {
		response = append(response, newRuleSetVTO(ruleSet))
	}
	return response
}

func newSessionVTOs(sessions []domain.Session) []sessionVTO {
	response := make([]sessionVTO, 0, len(sessions))
	for _, session := range sessions {
		response = append(response, newSessionVTO(session))
	}
	return response
}

func newUsageLedgerEntryVTOs(entries []domain.UsageLedgerEntry) []usageLedgerEntryVTO {
	response := make([]usageLedgerEntryVTO, 0, len(entries))
	for _, entry := range entries {
		response = append(response, newUsageLedgerEntryVTO(entry))
	}
	return response
}

func newAuditEventVTOs(entries []domain.AuditEvent) []auditEventVTO {
	response := make([]auditEventVTO, 0, len(entries))
	for _, entry := range entries {
		response = append(response, newAuditEventVTO(entry))
	}
	return response
}

func newTelemetryEventVTOs(events []domain.TelemetryEvent) []telemetryEventVTO {
	response := make([]telemetryEventVTO, 0, len(events))
	for _, event := range events {
		response = append(response, newTelemetryEventVTO(event))
	}
	return response
}
