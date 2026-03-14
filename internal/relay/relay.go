package relay

import (
	"context"
	"sync"
	"time"

	"github.com/pion/webrtc/v4"

	"github.com/taas-hq/taas/internal/domain"
)

type Relay interface {
	Dispatch(context.Context, domain.ControlCommand) error
	StopAll(context.Context, domain.ControlCommand, string) error
	Subscribe(sessionID string) (<-chan domain.TelemetryEvent, func())
	PublishTelemetry(context.Context, domain.TelemetryEvent) error
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
	config   CloudflareAdapterConfig
}

func NewCloudflareAdapter(config CloudflareAdapterConfig, fallback Relay) *CloudflareAdapter {
	return &CloudflareAdapter{
		api:      webrtc.NewAPI(),
		fallback: fallback,
		config:   config,
	}
}

func (r *CloudflareAdapter) Dispatch(ctx context.Context, command domain.ControlCommand) error {
	_ = r.api
	return r.fallback.Dispatch(ctx, command)
}

func (r *CloudflareAdapter) StopAll(ctx context.Context, command domain.ControlCommand, reason string) error {
	return r.fallback.StopAll(ctx, command, reason)
}

func (r *CloudflareAdapter) Subscribe(sessionID string) (<-chan domain.TelemetryEvent, func()) {
	return r.fallback.Subscribe(sessionID)
}

func (r *CloudflareAdapter) PublishTelemetry(ctx context.Context, event domain.TelemetryEvent) error {
	return r.fallback.PublishTelemetry(ctx, event)
}
