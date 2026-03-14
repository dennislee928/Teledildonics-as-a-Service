package store

import (
	"errors"
	"fmt"
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
