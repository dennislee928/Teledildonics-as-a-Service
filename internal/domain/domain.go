package domain

import "time"

type Transport string

const (
	TransportCloudflareRealtime Transport = "cloudflare-realtime"
	TransportWebSocketFallback  Transport = "websocket-fallback"
)

type DeviceCapability string

const (
	CapabilityVibrate   DeviceCapability = "vibrate"
	CapabilityOscillate DeviceCapability = "oscillate"
	CapabilityRotate    DeviceCapability = "rotate"
)

type SessionStatus string

const (
	SessionPending SessionStatus = "pending"
	SessionArmed   SessionStatus = "armed"
	SessionStopped SessionStatus = "stopped"
)

type CommandAction string

const (
	ActionApply   CommandAction = "apply"
	ActionStopAll CommandAction = "stop-all"
)

type TelemetryStatus string

const (
	TelemetryAck       TelemetryStatus = "ack"
	TelemetryExecuting TelemetryStatus = "executing"
	TelemetryStopped   TelemetryStatus = "stopped"
	TelemetryError     TelemetryStatus = "error"
)

type Workspace struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Region    string    `json:"region"`
	CreatedAt time.Time `json:"createdAt"`
}

type Creator struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspaceId"`
	DisplayName string    `json:"displayName"`
	CreatedAt   time.Time `json:"createdAt"`
}

type DeviceBridge struct {
	ID                   string    `json:"id"`
	WorkspaceID          string    `json:"workspaceId"`
	CreatorID            string    `json:"creatorId"`
	Transport            Transport `json:"transport"`
	Status               string    `json:"status"`
	FallbackWebSocketURL string    `json:"fallbackWebsocketUrl"`
	PublicKey            string    `json:"publicKey"`
	TransportPublicKey   string    `json:"transportPublicKey"`
	CreatedAt            time.Time `json:"createdAt"`
	LastSeenAt           time.Time `json:"lastSeenAt"`
	WrappedSessionKey    []byte    `json:"-"`
}

type Device struct {
	ID           string           `json:"id"`
	BridgeID     string           `json:"bridgeId"`
	CreatorID    string           `json:"creatorId"`
	Name         string           `json:"name"`
	Capability   DeviceCapability `json:"capability"`
	MaxIntensity int              `json:"maxIntensity"`
	Connected    bool             `json:"connected"`
	UpdatedAt    time.Time        `json:"updatedAt"`
}

type RuleSet struct {
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

type Session struct {
	ID            string        `json:"id"`
	WorkspaceID   string        `json:"workspaceId"`
	CreatorID     string        `json:"creatorId"`
	DeviceID      string        `json:"deviceId"`
	RuleSetID     string        `json:"ruleSetId"`
	Status        SessionStatus `json:"status"`
	MaxIntensity  int           `json:"maxIntensity"`
	MaxDurationMS int           `json:"maxDurationMs"`
	Sequence      int64         `json:"sequence"`
	ArmedAt       *time.Time    `json:"armedAt,omitempty"`
	StopReason    string        `json:"stopReason,omitempty"`
	CreatedAt     time.Time     `json:"createdAt"`
	UpdatedAt     time.Time     `json:"updatedAt"`
}

type InboundEndpoint struct {
	ID             string
	WorkspaceID    string
	CreatorID      string
	PublicKeySPKI  string
	Active         bool
	CreatedAt      time.Time
	RotatedAt      time.Time
	AllowedSources []string
}

type ControlGrant struct {
	ID              string
	SessionID       string
	BridgeID        string
	WorkspaceID     string
	CreatorID       string
	SessionKey      []byte
	ExpiresAt       time.Time
	RevokedAt       *time.Time
	MaxIntensity    int
	MaxDurationMS   int
	CreatedAt       time.Time
	LastRotatedAt   time.Time
	TransportBundle PairingBundle
}

type PairingBundle struct {
	ServerTransportPublicKey string `json:"server_transport_public_key"`
	Nonce                    string `json:"nonce"`
	Ciphertext               string `json:"ciphertext"`
}

type UsageLedgerEntry struct {
	ID          string         `json:"id"`
	WorkspaceID string         `json:"workspace_id"`
	SessionID   string         `json:"session_id"`
	Metric      string         `json:"metric"`
	Units       float64        `json:"units"`
	OccurredAt  time.Time      `json:"occurred_at"`
	Metadata    map[string]any `json:"metadata"`
}

type AuditEvent struct {
	ID          string         `json:"id"`
	WorkspaceID string         `json:"workspace_id"`
	CreatorID   string         `json:"creator_id"`
	SessionID   string         `json:"session_id,omitempty"`
	Kind        string         `json:"kind"`
	Actor       string         `json:"actor"`
	Details     map[string]any `json:"details"`
	OccurredAt  time.Time      `json:"occurred_at"`
}

type InboundEvent struct {
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

type ControlCommand struct {
	SessionID  string        `json:"session_id"`
	Sequence   int64         `json:"sequence"`
	DeviceID   string        `json:"device_id"`
	Action     CommandAction `json:"action"`
	Intensity  int           `json:"intensity"`
	DurationMS int           `json:"duration_ms"`
	PatternID  string        `json:"pattern_id"`
	Nonce      string        `json:"nonce"`
	IssuedAt   time.Time     `json:"issued_at"`
	ExpiresAt  time.Time     `json:"expires_at"`
	Ciphertext string        `json:"ciphertext"`
	Signature  string        `json:"signature"`
}

type CommandPayload struct {
	SessionID  string        `json:"session_id"`
	DeviceID   string        `json:"device_id"`
	Action     CommandAction `json:"action"`
	Intensity  int           `json:"intensity"`
	DurationMS int           `json:"duration_ms"`
	PatternID  string        `json:"pattern_id"`
	IssuedAt   time.Time     `json:"issued_at"`
	ExpiresAt  time.Time     `json:"expires_at"`
}

type TelemetryEvent struct {
	SessionID   string          `json:"session_id"`
	Sequence    int64           `json:"sequence"`
	Status      TelemetryStatus `json:"status"`
	ExecutedAt  time.Time       `json:"executed_at"`
	DeviceState string          `json:"device_state"`
	LatencyMS   float64         `json:"latency_ms"`
	ErrorCode   string          `json:"error_code,omitempty"`
	StopReason  string          `json:"stop_reason,omitempty"`
}

type PairDeviceBridgeRequest struct {
	WorkspaceID        string           `json:"workspace_id"`
	CreatorID          string           `json:"creator_id"`
	BridgeID           string           `json:"bridge_id"`
	BridgeName         string           `json:"bridge_name"`
	TransportPublicKey string           `json:"transport_public_key"`
	DeviceName         string           `json:"device_name"`
	Capability         DeviceCapability `json:"capability"`
	MaxIntensity       int              `json:"max_intensity"`
}

type PairDeviceBridgeResponse struct {
	Bridge                 DeviceBridge  `json:"bridge"`
	Device                 Device        `json:"device"`
	SessionKeyBundle       PairingBundle `json:"session_key_bundle"`
	ServerSigningPublicKey string        `json:"server_signing_public_key"`
}

type CreateSessionRequest struct {
	WorkspaceID   string `json:"workspace_id"`
	CreatorID     string `json:"creator_id"`
	DeviceID      string `json:"device_id"`
	RuleSetID     string `json:"rule_set_id"`
	MaxIntensity  int    `json:"max_intensity"`
	MaxDurationMS int    `json:"max_duration_ms"`
}

type ArmSessionRequest struct {
	BridgeID    string `json:"bridge_id"`
	ExpiresInMS int    `json:"expires_in_ms"`
}

type StopSessionRequest struct {
	Reason string `json:"reason"`
}

type UpsertRuleSetRequest struct {
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
