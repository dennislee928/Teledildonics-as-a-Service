package store

import (
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/taas-hq/taas/internal/domain"
)

var ErrNotFound = errors.New("not found")

type MemoryStore struct {
	mu            sync.RWMutex
	workspaces    map[string]domain.Workspace
	creators      map[string]domain.Creator
	bridges       map[string]domain.DeviceBridge
	devices       map[string]domain.Device
	rulesets      map[string]domain.RuleSet
	sessions      map[string]domain.Session
	endpoints     map[string]domain.InboundEndpoint
	grants        map[string]domain.ControlGrant
	usage         []domain.UsageLedgerEntry
	audit         []domain.AuditEvent
	telemetry     []domain.TelemetryEvent
	idempotency   map[string]time.Time
	sessionEvents map[string][]time.Time
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		workspaces:    make(map[string]domain.Workspace),
		creators:      make(map[string]domain.Creator),
		bridges:       make(map[string]domain.DeviceBridge),
		devices:       make(map[string]domain.Device),
		rulesets:      make(map[string]domain.RuleSet),
		sessions:      make(map[string]domain.Session),
		endpoints:     make(map[string]domain.InboundEndpoint),
		grants:        make(map[string]domain.ControlGrant),
		idempotency:   make(map[string]time.Time),
		sessionEvents: make(map[string][]time.Time),
	}
}

func (s *MemoryStore) Seed(
	workspace domain.Workspace,
	creator domain.Creator,
	bridge domain.DeviceBridge,
	device domain.Device,
	ruleSet domain.RuleSet,
	endpoint domain.InboundEndpoint,
) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.workspaces[workspace.ID] = workspace
	s.creators[creator.ID] = creator
	s.bridges[bridge.ID] = bridge
	s.devices[device.ID] = device
	s.rulesets[ruleSet.ID] = ruleSet
	s.endpoints[endpoint.ID] = endpoint
}

func (s *MemoryStore) GetWorkspace(id string) (domain.Workspace, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	workspace, ok := s.workspaces[id]
	if !ok {
		return domain.Workspace{}, ErrNotFound
	}
	return workspace, nil
}

func (s *MemoryStore) GetCreator(id string) (domain.Creator, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	creator, ok := s.creators[id]
	if !ok {
		return domain.Creator{}, ErrNotFound
	}
	return creator, nil
}

func (s *MemoryStore) UpsertBridge(bridge domain.DeviceBridge) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bridges[bridge.ID] = bridge
}

func (s *MemoryStore) GetBridge(id string) (domain.DeviceBridge, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bridge, ok := s.bridges[id]
	if !ok {
		return domain.DeviceBridge{}, ErrNotFound
	}
	return bridge, nil
}

func (s *MemoryStore) UpsertDevice(device domain.Device) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.devices[device.ID] = device
}

func (s *MemoryStore) GetDevice(id string) (domain.Device, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	device, ok := s.devices[id]
	if !ok {
		return domain.Device{}, ErrNotFound
	}
	return device, nil
}

func (s *MemoryStore) UpsertRuleSet(ruleSet domain.RuleSet) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rulesets[ruleSet.ID] = ruleSet
}

func (s *MemoryStore) GetRuleSet(id string) (domain.RuleSet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ruleSet, ok := s.rulesets[id]
	if !ok {
		return domain.RuleSet{}, ErrNotFound
	}
	return ruleSet, nil
}

func (s *MemoryStore) CreateSession(session domain.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
}

func (s *MemoryStore) UpdateSession(session domain.Session) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[session.ID] = session
}

func (s *MemoryStore) GetSession(id string) (domain.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[id]
	if !ok {
		return domain.Session{}, ErrNotFound
	}
	return session, nil
}

func (s *MemoryStore) GetEndpointByCreator(workspaceID, creatorID string) (domain.InboundEndpoint, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, endpoint := range s.endpoints {
		if endpoint.WorkspaceID == workspaceID && endpoint.CreatorID == creatorID && endpoint.Active {
			return endpoint, nil
		}
	}
	return domain.InboundEndpoint{}, ErrNotFound
}

func (s *MemoryStore) PutGrant(grant domain.ControlGrant) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.grants[grant.SessionID] = grant
}

func (s *MemoryStore) GetGrantBySession(sessionID string) (domain.ControlGrant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	grant, ok := s.grants[sessionID]
	if !ok {
		return domain.ControlGrant{}, ErrNotFound
	}
	return grant, nil
}

func (s *MemoryStore) RevokeGrant(sessionID string, revokedAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	grant, ok := s.grants[sessionID]
	if !ok {
		return ErrNotFound
	}
	grant.RevokedAt = &revokedAt
	s.grants[sessionID] = grant
	return nil
}

func (s *MemoryStore) AddUsage(entry domain.UsageLedgerEntry) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.usage = append(s.usage, entry)
}

func (s *MemoryStore) AddAudit(entry domain.AuditEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.audit = append(s.audit, entry)
}

func (s *MemoryStore) AddTelemetry(entry domain.TelemetryEvent) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.telemetry = append(s.telemetry, entry)
}

func (s *MemoryStore) ReserveIdempotency(workspaceID, key string, occurredAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	composite := fmt.Sprintf("%s:%s", workspaceID, key)
	if _, exists := s.idempotency[composite]; exists {
		return errors.New("duplicate idempotency key")
	}
	s.idempotency[composite] = occurredAt
	return nil
}

func (s *MemoryStore) LastSessionEvent(sessionID string) (time.Time, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	events := s.sessionEvents[sessionID]
	if len(events) == 0 {
		return time.Time{}, false
	}
	return events[len(events)-1], true
}

func (s *MemoryStore) AppendSessionEvent(sessionID string, occurredAt time.Time, within time.Duration) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	events := append(s.sessionEvents[sessionID], occurredAt)
	filtered := events[:0]
	for _, event := range events {
		if occurredAt.Sub(event) <= within {
			filtered = append(filtered, event)
		}
	}
	s.sessionEvents[sessionID] = filtered
	return len(filtered)
}

func (s *MemoryStore) ListBridges(workspaceID, creatorID string) []domain.DeviceBridge {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bridges := make([]domain.DeviceBridge, 0, len(s.bridges))
	for _, bridge := range s.bridges {
		if bridge.WorkspaceID == workspaceID && bridge.CreatorID == creatorID {
			bridges = append(bridges, bridge)
		}
	}
	sort.Slice(bridges, func(i, j int) bool {
		return bridges[i].CreatedAt.After(bridges[j].CreatedAt)
	})
	return bridges
}

func (s *MemoryStore) ListDevices(creatorID string) []domain.Device {
	s.mu.RLock()
	defer s.mu.RUnlock()
	devices := make([]domain.Device, 0, len(s.devices))
	for _, device := range s.devices {
		if device.CreatorID == creatorID {
			devices = append(devices, device)
		}
	}
	sort.Slice(devices, func(i, j int) bool {
		return devices[i].UpdatedAt.After(devices[j].UpdatedAt)
	})
	return devices
}

func (s *MemoryStore) ListRuleSets(workspaceID, creatorID string) []domain.RuleSet {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ruleSets := make([]domain.RuleSet, 0, len(s.rulesets))
	for _, ruleSet := range s.rulesets {
		if ruleSet.WorkspaceID == workspaceID && ruleSet.CreatorID == creatorID {
			ruleSets = append(ruleSets, ruleSet)
		}
	}
	sort.Slice(ruleSets, func(i, j int) bool {
		return ruleSets[i].UpdatedAt.After(ruleSets[j].UpdatedAt)
	})
	return ruleSets
}

func (s *MemoryStore) ListSessions(workspaceID, creatorID string) []domain.Session {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sessions := make([]domain.Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		if session.WorkspaceID == workspaceID && session.CreatorID == creatorID {
			sessions = append(sessions, session)
		}
	}
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})
	return sessions
}

func (s *MemoryStore) ListUsage(workspaceID string, limit int) []domain.UsageLedgerEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	usage := make([]domain.UsageLedgerEntry, 0, len(s.usage))
	for _, entry := range s.usage {
		if entry.WorkspaceID == workspaceID {
			usage = append(usage, entry)
		}
	}
	sort.Slice(usage, func(i, j int) bool {
		return usage[i].OccurredAt.After(usage[j].OccurredAt)
	})
	if limit > 0 && len(usage) > limit {
		return append([]domain.UsageLedgerEntry(nil), usage[:limit]...)
	}
	return usage
}

func (s *MemoryStore) ListAudit(workspaceID, creatorID string, limit int) []domain.AuditEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	audit := make([]domain.AuditEvent, 0, len(s.audit))
	for _, entry := range s.audit {
		if entry.WorkspaceID == workspaceID && (creatorID == "" || entry.CreatorID == creatorID) {
			audit = append(audit, entry)
		}
	}
	sort.Slice(audit, func(i, j int) bool {
		return audit[i].OccurredAt.After(audit[j].OccurredAt)
	})
	if limit > 0 && len(audit) > limit {
		return append([]domain.AuditEvent(nil), audit[:limit]...)
	}
	return audit
}

func (s *MemoryStore) ListTelemetry(sessionIDs []string, limit int) []domain.TelemetryEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	allowed := make(map[string]struct{}, len(sessionIDs))
	for _, sessionID := range sessionIDs {
		allowed[sessionID] = struct{}{}
	}
	events := make([]domain.TelemetryEvent, 0, len(s.telemetry))
	for _, entry := range s.telemetry {
		if len(allowed) == 0 {
			events = append(events, entry)
			continue
		}
		if _, ok := allowed[entry.SessionID]; ok {
			events = append(events, entry)
		}
	}
	sort.Slice(events, func(i, j int) bool {
		return events[i].ExecutedAt.After(events[j].ExecutedAt)
	})
	if limit > 0 && len(events) > limit {
		return append([]domain.TelemetryEvent(nil), events[:limit]...)
	}
	return events
}
