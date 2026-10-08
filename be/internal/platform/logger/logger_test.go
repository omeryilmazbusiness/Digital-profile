package logger_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/logger"
)

func TestNew_JSON(t *testing.T) {
	var buf bytes.Buffer
	log := logger.New(&buf, config.Log{Level: slog.LevelInfo, Format: config.LogFormatJSON}, slog.String("service", "api"))

	log.Debug("hidden")
	log.Info("hello", "k", "v")

	lines := strings.Split(strings.TrimSpace(buf.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("got %d log lines, want 1 (debug must be filtered): %q", len(lines), buf.String())
	}

	var rec map[string]any
	if err := json.Unmarshal([]byte(lines[0]), &rec); err != nil {
		t.Fatalf("log line is not JSON: %v", err)
	}
	for key, want := range map[string]string{"msg": "hello", "k": "v", "service": "api", "level": "INFO"} {
		if rec[key] != want {
			t.Errorf("%s = %v, want %q", key, rec[key], want)
		}
	}
}

func TestNew_Text(t *testing.T) {
	var buf bytes.Buffer
	log := logger.New(&buf, config.Log{Level: slog.LevelDebug, Format: config.LogFormatText})

	log.Debug("visible")

	if !strings.Contains(buf.String(), "msg=visible") {
		t.Errorf("text output %q does not contain msg=visible", buf.String())
	}
}
