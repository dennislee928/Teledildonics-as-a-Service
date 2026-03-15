package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisRuntimeStore struct {
	client    *redis.Client
	keyPrefix string
}

func NewRedisRuntimeStore(redisURL string) (*RedisRuntimeStore, error) {
	return NewRedisRuntimeStoreWithPrefix(redisURL, "taas:")
}

func NewRedisRuntimeStoreWithPrefix(redisURL, keyPrefix string) (*RedisRuntimeStore, error) {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(options)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, err
	}
	return &RedisRuntimeStore{
		client:    client,
		keyPrefix: keyPrefix,
	}, nil
}

func (s *RedisRuntimeStore) Close() error {
	return s.client.Close()
}

func (s *RedisRuntimeStore) HealthCheck(ctx context.Context) error {
	return s.client.Ping(ctx).Err()
}

func (s *RedisRuntimeStore) ReserveIdempotency(workspaceID, key string, occurredAt time.Time) error {
	cacheKey := fmt.Sprintf("%sidempotency:%s:%s", s.keyPrefix, workspaceID, key)
	reserved, err := s.client.SetNX(
		context.Background(),
		cacheKey,
		occurredAt.Format(time.RFC3339Nano),
		24*time.Hour,
	).Result()
	if err != nil {
		return err
	}
	if !reserved {
		return errors.New("duplicate idempotency key")
	}
	return nil
}

func (s *RedisRuntimeStore) LastSessionEvent(sessionID string) (time.Time, bool) {
	value, err := s.client.Get(context.Background(), fmt.Sprintf("%ssession:last:%s", s.keyPrefix, sessionID)).Result()
	if err != nil {
		return time.Time{}, false
	}
	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Time{}, false
	}
	return parsed, true
}

func (s *RedisRuntimeStore) AppendSessionEvent(sessionID string, occurredAt time.Time, within time.Duration) int {
	ctx := context.Background()
	windowKey := fmt.Sprintf("%ssession:events:%s", s.keyPrefix, sessionID)
	lastKey := fmt.Sprintf("%ssession:last:%s", s.keyPrefix, sessionID)
	minScore := occurredAt.Add(-within).UnixMilli()

	pipeline := s.client.TxPipeline()
	pipeline.ZRemRangeByScore(ctx, windowKey, "0", fmt.Sprintf("%d", minScore-1))
	pipeline.ZAdd(ctx, windowKey, redis.Z{
		Score:  float64(occurredAt.UnixMilli()),
		Member: occurredAt.Format(time.RFC3339Nano),
	})
	pipeline.Expire(ctx, windowKey, within+time.Minute)
	count := pipeline.ZCard(ctx, windowKey)
	pipeline.Set(ctx, lastKey, occurredAt.Format(time.RFC3339Nano), within+time.Minute)
	if _, err := pipeline.Exec(ctx); err != nil {
		return 0
	}
	return int(count.Val())
}
