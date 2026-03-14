package store

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/taas-hq/taas/internal/domain"
)

var (
	ErrNotFound      = errors.New("not found")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrNotImplemented = errors.New("not implemented")
)

type Repository interface {
	UpsertWorkspace(domain.Workspace) error
	GetWorkspace(id string) (domain.Workspace, error)
	UpsertCreator(domain.Creator) error
	GetCreator(id string) (domain.Creator, error)
	UpsertBridge(domain.DeviceBridge) error
	GetBridge(id string) (domain.DeviceBridge, error)
	ListBridges(workspaceID, creatorID string) []domain.DeviceBridge
	UpsertDevice(domain.Device) error
	GetDevice(id string) (domain.Device, error)
	ListDevices(creatorID string) []domain.Device
	UpsertRuleSet(domain.RuleSet) error
	GetRuleSet(id string) (domain.RuleSet, error)
	ListRuleSets(workspaceID, creatorID string) []domain.RuleSet
	CreateSession(domain.Session) error
	UpdateSession(domain.Session) error
	GetSession(id string) (domain.Session, error)
	ListSessions(workspaceID, creatorID string) []domain.Session
	ListArmedSessions() []domain.Session
	UpsertEndpoint(domain.InboundEndpoint) error
	GetEndpointByCreator(workspaceID, creatorID string) (domain.InboundEndpoint, error)
	PutGrant(domain.ControlGrant) error
	GetGrantBySession(sessionID string) (domain.ControlGrant, error)
	RevokeGrant(sessionID string, revokedAt time.Time) error
	AddUsage(domain.UsageLedgerEntry) error
	ListUsage(workspaceID string, limit int) []domain.UsageLedgerEntry
	AddAudit(domain.AuditEvent) error
	ListAudit(workspaceID, creatorID string, limit int) []domain.AuditEvent
	AddTelemetry(domain.TelemetryEvent) error
	ListTelemetry(sessionIDs []string, limit int) []domain.TelemetryEvent
	PutWorkspaceAPIKey(domain.WorkspaceAPIKey) error
	AuthenticateWorkspaceAPIKey(rawKey string, usedAt time.Time) (domain.WorkspaceAPIKey, error)
}

type RuntimeStore interface {
	ReserveIdempotency(workspaceID, key string, occurredAt time.Time) error
	LastSessionEvent(sessionID string) (time.Time, bool)
	AppendSessionEvent(sessionID string, occurredAt time.Time, within time.Duration) int
}

func HashWorkspaceAPIKey(rawKey string) string {
	sum := sha256.Sum256([]byte(rawKey))
	return hex.EncodeToString(sum[:])
}
