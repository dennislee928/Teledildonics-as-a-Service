package relay

import (
	"context"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/taas-hq/taas/internal/domain"
	"github.com/taas-hq/taas/internal/store"
)

type Relay interface {
	Dispatch(context.Context, domain.ControlCommand) error
	StopAll(context.Context, domain.ControlCommand, string) error
	Subscribe(sessionID string) (<-chan domain.TelemetryEvent, func())
	PublishTelemetry(context.Context, domain.TelemetryEvent) error
}

type BridgeSessionRelay interface {
	SubscribeBridgeSession(sessionID, bridgeID string) (<-chan domain.ControlCommand, func(), error)
}

type InMemoryRelay struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan domain.TelemetryEvent]struct{}
}

func NewInMemoryRelay() *InMemoryRelay {
	return &InMemoryRelay{
		subscribers: make(map[string]map[chan domain.TelemetryEvent]struct{}),
	}
}

func (r *InMemoryRelay) Dispatch(_ context.Context, command domain.ControlCommand) error {
	go func() {
		time.Sleep(25 * time.Millisecond)
		_ = r.PublishTelemetry(context.Background(), domain.TelemetryEvent{
			SessionID:   command.SessionID,
			Sequence:    command.Sequence,
			Status:      domain.TelemetryAck,
			ExecutedAt:  time.Now().UTC(),
			DeviceState: "command-accepted",
			LatencyMS:   25,
		})
	}()
	return nil
}

func (r *InMemoryRelay) StopAll(_ context.Context, command domain.ControlCommand, reason string) error {
	return r.PublishTelemetry(context.Background(), domain.TelemetryEvent{
		SessionID:   command.SessionID,
		Sequence:    command.Sequence,
		Status:      domain.TelemetryStopped,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "stopped",
		LatencyMS:   0,
		StopReason:  reason,
	})
}

func (r *InMemoryRelay) Subscribe(sessionID string) (<-chan domain.TelemetryEvent, func()) {
	channel := make(chan domain.TelemetryEvent, 8)
	r.mu.Lock()
	if _, ok := r.subscribers[sessionID]; !ok {
		r.subscribers[sessionID] = make(map[chan domain.TelemetryEvent]struct{})
	}
	r.subscribers[sessionID][channel] = struct{}{}
	r.mu.Unlock()

	cancel := func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if subscribers, ok := r.subscribers[sessionID]; ok {
			delete(subscribers, channel)
		}
		close(channel)
	}
	return channel, cancel
}

func (r *InMemoryRelay) PublishTelemetry(_ context.Context, event domain.TelemetryEvent) error {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for channel := range r.subscribers[event.SessionID] {
		select {
		case channel <- event:
		default:
		}
	}
	return nil
}

type CloudflareAdapterConfig struct {
	AccountID      string
	RealtimeAppID  string
	TurnServiceID  string
	FallbackWSBase string
}

type CloudflareAdapter struct {
	api      *webrtc.API
	fallback Relay
	repo     store.Repository
	config   CloudflareAdapterConfig
	mu       sync.Mutex
	bridges  map[string]map[chan domain.ControlCommand]string
	pending  map[string][]queuedCommand
}

type queuedCommand struct {
	bridgeID string
	command  domain.ControlCommand
}

func NewCloudflareAdapter(config CloudflareAdapterConfig, repo store.Repository, fallback Relay) *CloudflareAdapter {
	return &CloudflareAdapter{
		api:      webrtc.NewAPI(),
		fallback: fallback,
		repo:     repo,
		config:   config,
		bridges:  make(map[string]map[chan domain.ControlCommand]string),
		pending:  make(map[string][]queuedCommand),
	}
}

func (r *CloudflareAdapter) Dispatch(ctx context.Context, command domain.ControlCommand) error {
	_ = r.api
	grant, err := r.repo.GetGrantBySession(command.SessionID)
	if err != nil {
		return err
	}
	if delivered := r.dispatchToBridge(grant.BridgeID, command); delivered {
		return nil
	}
	r.queueCommand(command.SessionID, grant.BridgeID, command)
	return nil
}

func (r *CloudflareAdapter) StopAll(ctx context.Context, command domain.ControlCommand, reason string) error {
	_ = r.Dispatch(ctx, command)
	return r.fallback.PublishTelemetry(ctx, domain.TelemetryEvent{
		SessionID:   command.SessionID,
		Sequence:    command.Sequence,
		Status:      domain.TelemetryStopped,
		ExecutedAt:  time.Now().UTC(),
		DeviceState: "stopped",
		LatencyMS:   0,
		StopReason:  reason,
	})
}

func (r *CloudflareAdapter) Subscribe(sessionID string) (<-chan domain.TelemetryEvent, func()) {
	return r.fallback.Subscribe(sessionID)
}

func (r *CloudflareAdapter) PublishTelemetry(ctx context.Context, event domain.TelemetryEvent) error {
	return r.fallback.PublishTelemetry(ctx, event)
}

func (r *CloudflareAdapter) SubscribeBridgeSession(sessionID, bridgeID string) (<-chan domain.ControlCommand, func(), error) {
	channel := make(chan domain.ControlCommand, 8)

	r.mu.Lock()
	if _, ok := r.bridges[sessionID]; !ok {
		r.bridges[sessionID] = make(map[chan domain.ControlCommand]string)
	}
	r.bridges[sessionID][channel] = bridgeID
	pending := r.pending[sessionID]
	remaining := pending[:0]
	for _, queued := range pending {
		if queued.bridgeID != bridgeID {
			remaining = append(remaining, queued)
			continue
		}
		select {
		case channel <- queued.command:
		default:
			remaining = append(remaining, queued)
		}
	}
	if len(remaining) == 0 {
		delete(r.pending, sessionID)
	} else {
		r.pending[sessionID] = remaining
	}
	r.mu.Unlock()

	cancel := func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if subscribers, ok := r.bridges[sessionID]; ok {
			delete(subscribers, channel)
			if len(subscribers) == 0 {
				delete(r.bridges, sessionID)
			}
		}
		close(channel)
	}
	return channel, cancel, nil
}

func (r *CloudflareAdapter) dispatchToBridge(bridgeID string, command domain.ControlCommand) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	delivered := false
	for channel, subscribedBridgeID := range r.bridges[command.SessionID] {
		if subscribedBridgeID != bridgeID {
			continue
		}
		select {
		case channel <- command:
			delivered = true
		default:
		}
	}
	return delivered
}

func (r *CloudflareAdapter) queueCommand(sessionID, bridgeID string, command domain.ControlCommand) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pending[sessionID] = append(r.pending[sessionID], queuedCommand{
		bridgeID: bridgeID,
		command:  command,
	})
}
