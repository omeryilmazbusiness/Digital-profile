package config_test

import (
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

func TestLoadFrom_Defaults(t *testing.T) {
	cfg, err := config.LoadFrom(map[string]string{})
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if cfg.Env != config.EnvDevelopment {
		t.Errorf("Env = %q, want %q", cfg.Env, config.EnvDevelopment)
	}
	if cfg.HTTP.Addr != ":8080" {
		t.Errorf("HTTP.Addr = %q, want :8080", cfg.HTTP.Addr)
	}
	if cfg.HTTP.ShutdownTimeout != 20*time.Second {
		t.Errorf("HTTP.ShutdownTimeout = %s, want 20s", cfg.HTTP.ShutdownTimeout)
	}
	if cfg.Log.Level != slog.LevelInfo {
		t.Errorf("Log.Level = %s, want INFO", cfg.Log.Level)
	}
	if cfg.Log.Format != config.LogFormatJSON {
		t.Errorf("Log.Format = %q, want json", cfg.Log.Format)
	}
	if cfg.IsProduction() {
		t.Error("IsProduction() = true for development defaults")
	}
}

func TestLoadFrom_Overrides(t *testing.T) {
	cfg, err := config.LoadFrom(map[string]string{
		"APP_ENV":               "production",
		"HTTP_ADDR":             "127.0.0.1:9000",
		"HTTP_SHUTDOWN_TIMEOUT": "3s",
		"LOG_LEVEL":             "debug",
		"LOG_FORMAT":            "text",
	})
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if !cfg.IsProduction() {
		t.Error("IsProduction() = false, want true")
	}
	if cfg.HTTP.Addr != "127.0.0.1:9000" {
		t.Errorf("HTTP.Addr = %q", cfg.HTTP.Addr)
	}
	if cfg.HTTP.ShutdownTimeout != 3*time.Second {
		t.Errorf("HTTP.ShutdownTimeout = %s", cfg.HTTP.ShutdownTimeout)
	}
	if cfg.Log.Level != slog.LevelDebug {
		t.Errorf("Log.Level = %s", cfg.Log.Level)
	}
	if cfg.Log.Format != config.LogFormatText {
		t.Errorf("Log.Format = %q", cfg.Log.Format)
	}
}

func TestLoadFrom_Invalid(t *testing.T) {
	tests := []struct {
		name    string
		vars    map[string]string
		wantErr string
	}{
		{"unknown env", map[string]string{"APP_ENV": "prod"}, "APP_ENV"},
		{"empty addr", map[string]string{"HTTP_ADDR": " "}, "HTTP_ADDR"},
		{"zero timeout", map[string]string{"HTTP_READ_TIMEOUT": "0s"}, "HTTP_READ_TIMEOUT"},
		{"negative timeout", map[string]string{"HTTP_SHUTDOWN_TIMEOUT": "-1s"}, "HTTP_SHUTDOWN_TIMEOUT"},
		{"unparseable duration", map[string]string{"HTTP_IDLE_TIMEOUT": "soon"}, "parse config"},
		{"unknown log format", map[string]string{"LOG_FORMAT": "xml"}, "LOG_FORMAT"},
		{"unknown log level", map[string]string{"LOG_LEVEL": "loud"}, "parse config"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := config.LoadFrom(tt.vars)
			if err == nil {
				t.Fatal("LoadFrom() error = nil, want error")
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q does not mention %q", err, tt.wantErr)
			}
		})
	}
}

func TestLoadFrom_ReportsAllErrors(t *testing.T) {
	_, err := config.LoadFrom(map[string]string{"APP_ENV": "nope", "LOG_FORMAT": "xml"})
	if err == nil {
		t.Fatal("LoadFrom() error = nil, want error")
	}
	for _, want := range []string{"APP_ENV", "LOG_FORMAT"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}
