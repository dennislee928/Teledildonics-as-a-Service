package main

import (
	"context"
	"log/slog"
	"os"
)

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if err := run(context.Background(), logger); err != nil {
		logger.Error("control api stopped", slog.Any("error", err))
		os.Exit(1)
	}
}
