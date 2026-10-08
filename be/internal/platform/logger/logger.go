// Package logger builds the process-wide structured logger.
package logger

import (
	"io"
	"log/slog"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

func New(w io.Writer, cfg config.Log, attrs ...slog.Attr) *slog.Logger {
	opts := &slog.HandlerOptions{Level: cfg.Level}

	var h slog.Handler
	if cfg.Format == config.LogFormatText {
		h = slog.NewTextHandler(w, opts)
	} else {
		h = slog.NewJSONHandler(w, opts)
	}

	return slog.New(h.WithAttrs(attrs))
}
