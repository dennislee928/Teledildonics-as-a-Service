package main

import "os"

type config struct {
	addr                  string
	staticRoot            string
	repositoryBackend     string
	runtimeBackend        string
	postgresDSN           string
	redisURL              string
	cloudflareAccountID   string
	cloudflareRealtimeApp string
	cloudflareTurnService string
}

func loadConfig() config {
	return config{
		addr:                  envOrDefault("CONTROL_API_ADDR", ":8080"),
		staticRoot:            envOrDefault("STATIC_ROOT", "."),
		repositoryBackend:     envOrDefault("STORE_REPOSITORY_BACKEND", "memory"),
		runtimeBackend:        envOrDefault("STORE_RUNTIME_BACKEND", "memory"),
		postgresDSN:           envOrDefault("POSTGRES_DSN", ""),
		redisURL:              envOrDefault("REDIS_URL", ""),
		cloudflareAccountID:   envOrDefault("CLOUDFLARE_ACCOUNT_ID", ""),
		cloudflareRealtimeApp: envOrDefault("CLOUDFLARE_REALTIME_APP_ID", ""),
		cloudflareTurnService: envOrDefault("CLOUDFLARE_TURN_SERVICE_ID", ""),
	}
}

func envOrDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
