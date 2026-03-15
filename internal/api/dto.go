package api

import (
	"time"

	"github.com/taas-hq/taas/internal/domain"
)

type inboundEventDTO struct {
	EventType      string         `json:"event_type"`
	WorkspaceID    string         `json:"workspace_id"`
	CreatorID      string         `json:"creator_id"`
	SourceID       string         `json:"source_id"`
	Amount         float64        `json:"amount"`
	Currency       string         `json:"currency"`
	OccurredAt     time.Time      `json:"occurred_at"`
	IdempotencyKey string         `json:"idempotency_key"`
	Signature      string         `json:"signature"`
	Metadata       map[string]any `json:"metadata"`
}

func (dto inboundEventDTO) toDomain() domain.InboundEvent {
	return domain.InboundEvent{
		EventType:      dto.EventType,
		WorkspaceID:    dto.WorkspaceID,
		CreatorID:      dto.CreatorID,
		SourceID:       dto.SourceID,
		Amount:         dto.Amount,
		Currency:       dto.Currency,
		OccurredAt:     dto.OccurredAt,
		IdempotencyKey: dto.IdempotencyKey,
		Signature:      dto.Signature,
		Metadata:       dto.Metadata,
	}
}

type pairDeviceBridgeRequestDTO struct {
	WorkspaceID        string `json:"workspace_id"`
	CreatorID          string `json:"creator_id"`
	BridgeID           string `json:"bridge_id"`
	BridgeName         string `json:"bridge_name"`
	TransportPublicKey string `json:"transport_public_key"`
	DeviceName         string `json:"device_name"`
	Capability         string `json:"capability"`
	MaxIntensity       int    `json:"max_intensity"`
}

func (dto pairDeviceBridgeRequestDTO) toDomain() domain.PairDeviceBridgeRequest {
	return domain.PairDeviceBridgeRequest{
		WorkspaceID:        dto.WorkspaceID,
		CreatorID:          dto.CreatorID,
		BridgeID:           dto.BridgeID,
		BridgeName:         dto.BridgeName,
		TransportPublicKey: dto.TransportPublicKey,
		DeviceName:         dto.DeviceName,
		Capability:         domain.DeviceCapability(dto.Capability),
		MaxIntensity:       dto.MaxIntensity,
	}
}

type createSessionRequestDTO struct {
	WorkspaceID   string `json:"workspace_id"`
	CreatorID     string `json:"creator_id"`
	DeviceID      string `json:"device_id"`
	RuleSetID     string `json:"rule_set_id"`
	MaxIntensity  int    `json:"max_intensity"`
	MaxDurationMS int    `json:"max_duration_ms"`
}

func (dto createSessionRequestDTO) toDomain() domain.CreateSessionRequest {
	return domain.CreateSessionRequest{
		WorkspaceID:   dto.WorkspaceID,
		CreatorID:     dto.CreatorID,
		DeviceID:      dto.DeviceID,
		RuleSetID:     dto.RuleSetID,
		MaxIntensity:  dto.MaxIntensity,
		MaxDurationMS: dto.MaxDurationMS,
	}
}

type armSessionRequestDTO struct {
	BridgeID    string `json:"bridge_id"`
	ExpiresInMS int    `json:"expires_in_ms"`
}

func (dto armSessionRequestDTO) toDomain() domain.ArmSessionRequest {
	return domain.ArmSessionRequest{
		BridgeID:    dto.BridgeID,
		ExpiresInMS: dto.ExpiresInMS,
	}
}

type stopSessionRequestDTO struct {
	Reason string `json:"reason"`
}

func (dto stopSessionRequestDTO) toDomain() domain.StopSessionRequest {
	return domain.StopSessionRequest{
		Reason: dto.Reason,
	}
}

type ingestTelemetryRequestDTO struct {
	Sequence    int64     `json:"sequence"`
	Status      string    `json:"status"`
	ExecutedAt  time.Time `json:"executed_at"`
	DeviceState string    `json:"device_state"`
	LatencyMS   float64   `json:"latency_ms"`
	ErrorCode   string    `json:"error_code,omitempty"`
	StopReason  string    `json:"stop_reason,omitempty"`
}

func (dto ingestTelemetryRequestDTO) toDomain() domain.IngestTelemetryRequest {
	return domain.IngestTelemetryRequest{
		Sequence:    dto.Sequence,
		Status:      domain.TelemetryStatus(dto.Status),
		ExecutedAt:  dto.ExecutedAt,
		DeviceState: dto.DeviceState,
		LatencyMS:   dto.LatencyMS,
		ErrorCode:   dto.ErrorCode,
		StopReason:  dto.StopReason,
	}
}

type upsertRuleSetRequestDTO struct {
	WorkspaceID        string `json:"workspace_id"`
	CreatorID          string `json:"creator_id"`
	AmountStepCents    int64  `json:"amount_step_cents"`
	IntensityStep      int    `json:"intensity_step"`
	MaxIntensity       int    `json:"max_intensity"`
	DurationPerStepMS  int    `json:"duration_per_step_ms"`
	MaxDurationMS      int    `json:"max_duration_ms"`
	CooldownMS         int    `json:"cooldown_ms"`
	RateLimitPerMinute int    `json:"rate_limit_per_minute"`
	PatternID          string `json:"pattern_id"`
	Enabled            bool   `json:"enabled"`
}

func (dto upsertRuleSetRequestDTO) toDomain() domain.UpsertRuleSetRequest {
	return domain.UpsertRuleSetRequest{
		WorkspaceID:        dto.WorkspaceID,
		CreatorID:          dto.CreatorID,
		AmountStepCents:    dto.AmountStepCents,
		IntensityStep:      dto.IntensityStep,
		MaxIntensity:       dto.MaxIntensity,
		DurationPerStepMS:  dto.DurationPerStepMS,
		MaxDurationMS:      dto.MaxDurationMS,
		CooldownMS:         dto.CooldownMS,
		RateLimitPerMinute: dto.RateLimitPerMinute,
		PatternID:          dto.PatternID,
		Enabled:            dto.Enabled,
	}
}
