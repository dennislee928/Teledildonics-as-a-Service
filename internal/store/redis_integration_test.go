package store_test

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/taas-hq/taas/internal/store"
)

func TestRedisRuntimeStoreTracksSlidingWindowState(t *testing.T) {
	redisURL := redisIntegrationURL(t)
	runtimeStore, err := store.NewRedisRuntimeStoreWithPrefix(
		redisURL,
		fmt.Sprintf("taas-test:%d:", time.Now().UnixNano()),
	)
	if err != nil {
		t.Fatalf("open redis runtime store: %v", err)
	}
	defer func() {
		_ = runtimeStore.Close()
	}()

	occurredAt := time.Now().UTC().Round(0)
	if err := runtimeStore.ReserveIdempotency("ws_demo", "evt-1", occurredAt); err != nil {
		t.Fatalf("first reserve idempotency: %v", err)
	}
	if err := runtimeStore.ReserveIdempotency("ws_demo", "evt-1", occurredAt); err == nil {
		t.Fatalf("expected duplicate idempotency error")
	}

	if _, ok := runtimeStore.LastSessionEvent("session_demo"); ok {
		t.Fatalf("expected no prior session event")
	}
	if count := runtimeStore.AppendSessionEvent("session_demo", occurredAt, 100*time.Millisecond); count != 1 {
		t.Fatalf("expected count 1, got %d", count)
	}
	lastEventAt, ok := runtimeStore.LastSessionEvent("session_demo")
	if !ok {
		t.Fatalf("expected last session event")
	}
	if got, want := lastEventAt.Format(time.RFC3339Nano), occurredAt.Format(time.RFC3339Nano); got != want {
		t.Fatalf("expected last event %s, got %s", want, got)
	}

	if count := runtimeStore.AppendSessionEvent("session_demo", occurredAt.Add(50*time.Millisecond), 100*time.Millisecond); count != 2 {
		t.Fatalf("expected count 2, got %d", count)
	}
	if count := runtimeStore.AppendSessionEvent("session_demo", occurredAt.Add(250*time.Millisecond), 100*time.Millisecond); count != 1 {
		t.Fatalf("expected pruned count 1, got %d", count)
	}
}

func redisIntegrationURL(t *testing.T) string {
	t.Helper()
	if redisURL := os.Getenv("TAAS_TEST_REDIS_URL"); redisURL != "" {
		return redisURL
	}
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		return redisURL
	}
	t.Skip("set TAAS_TEST_REDIS_URL or REDIS_URL to run Redis integration tests")
	return ""
}
