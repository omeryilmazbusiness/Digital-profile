package config_test

import (
	"log/slog"
	"maps"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

const testDSN = "postgres://app:secret@localhost:5432/app?sslmode=disable"

// vars returns the minimal valid environment plus overrides.
func vars(overrides map[string]string) map[string]string {
	v := map[string]string{"DATABASE_URL": testDSN}
	maps.Copy(v, overrides)
	return v
}

func TestLoadFrom_Defaults(t *testing.T) {
	cfg, err := config.LoadFrom(vars(nil))
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if cfg.Env != config.EnvDevelopment || cfg.IsProduction() {
		t.Errorf("Env = %q", cfg.Env)
	}
	if cfg.HTTP.Addr != ":8080" || cfg.HTTP.ShutdownTimeout != 20*time.Second || cfg.HTTP.MaxBodyBytes != 1<<20 {
		t.Errorf("HTTP = %+v", cfg.HTTP)
	}
	if cfg.Log.Level != slog.LevelInfo || cfg.Log.Format != config.LogFormatJSON {
		t.Errorf("Log = %+v", cfg.Log)
	}
	if cfg.DB.URL != testDSN || cfg.DB.MaxConns != 10 || cfg.DB.MinConns != 1 || cfg.DB.AutoMigrate {
		t.Errorf("DB = %+v", cfg.DB)
	}
	if len(cfg.CORS.AllowedOrigins) != 0 {
		t.Errorf("CORS.AllowedOrigins = %v, want none", cfg.CORS.AllowedOrigins)
	}
	rl := cfg.RateLimit
	if !rl.Enabled || rl.RPS != 10 || rl.Burst != 20 || rl.StrictBurst != 5 || len(rl.StrictPaths) != 2 {
		t.Errorf("RateLimit = %+v", rl)
	}

	prefixes, err := cfg.HTTP.TrustedProxyPrefixes()
	if err != nil {
		t.Fatalf("TrustedProxyPrefixes() error = %v", err)
	}
	want := []netip.Prefix{netip.MustParsePrefix("127.0.0.1/32"), netip.MustParsePrefix("::1/128")}
	if len(prefixes) != 2 || prefixes[0] != want[0] || prefixes[1] != want[1] {
		t.Errorf("TrustedProxyPrefixes() = %v, want %v", prefixes, want)
	}
}

func TestLoadFrom_Overrides(t *testing.T) {
	cfg, err := config.LoadFrom(vars(map[string]string{
		"APP_ENV":                "production",
		"HTTP_ADDR":              "127.0.0.1:9000",
		"HTTP_TRUSTED_PROXIES":   "10.0.0.0/8, 192.168.1.7/24",
		"LOG_LEVEL":              "debug",
		"LOG_FORMAT":             "text",
		"DATABASE_MAX_CONNS":     "25",
		"DATABASE_AUTO_MIGRATE":  "true",
		"CORS_ALLOWED_ORIGINS":   "https://a.example,https://b.example",
		"RATE_LIMIT_ENABLED":     "false",
		"RATE_LIMIT_STRICT_PATH": "ignored-unknown-var",
	}))
	if err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}

	if !cfg.IsProduction() || cfg.HTTP.Addr != "127.0.0.1:9000" {
		t.Errorf("cfg = %+v", cfg)
	}
	if cfg.Log.Level != slog.LevelDebug || cfg.Log.Format != config.LogFormatText {
		t.Errorf("Log = %+v", cfg.Log)
	}
	if cfg.DB.MaxConns != 25 || !cfg.DB.AutoMigrate {
		t.Errorf("DB = %+v", cfg.DB)
	}
	if len(cfg.CORS.AllowedOrigins) != 2 || cfg.CORS.AllowedOrigins[1] != "https://b.example" {
		t.Errorf("CORS = %+v", cfg.CORS)
	}
	if cfg.RateLimit.Enabled {
		t.Error("RateLimit.Enabled = true, want false")
	}

	prefixes, err := cfg.HTTP.TrustedProxyPrefixes()
	if err != nil {
		t.Fatalf("TrustedProxyPrefixes() error = %v", err)
	}
	if prefixes[1] != netip.MustParsePrefix("192.168.1.0/24") {
		t.Errorf("prefix was not masked: %v", prefixes[1])
	}
}

func TestLoadFrom_Invalid(t *testing.T) {
	tests := []struct {
		name    string
		vars    map[string]string
		wantErr string
	}{
		{"missing database url", map[string]string{"DATABASE_URL": ""}, "DATABASE_URL"},
		{"non-postgres database url", vars(map[string]string{"DATABASE_URL": "mysql://x/y"}), "DATABASE_URL"},
		{"unknown env", vars(map[string]string{"APP_ENV": "prod"}), "APP_ENV"},
		{"empty addr", vars(map[string]string{"HTTP_ADDR": " "}), "HTTP_ADDR"},
		{"zero timeout", vars(map[string]string{"HTTP_READ_TIMEOUT": "0s"}), "HTTP_READ_TIMEOUT"},
		{"unparseable duration", vars(map[string]string{"HTTP_IDLE_TIMEOUT": "soon"}), "parse config"},
		{"zero body limit", vars(map[string]string{"HTTP_MAX_BODY_BYTES": "0"}), "HTTP_MAX_BODY_BYTES"},
		{"bad trusted proxy", vars(map[string]string{"HTTP_TRUSTED_PROXIES": "10.0.0.1"}), "HTTP_TRUSTED_PROXIES"},
		{"unknown log format", vars(map[string]string{"LOG_FORMAT": "xml"}), "LOG_FORMAT"},
		{"unknown log level", vars(map[string]string{"LOG_LEVEL": "loud"}), "parse config"},
		{"min conns above max", vars(map[string]string{"DATABASE_MIN_CONNS": "20"}), "DATABASE_MIN_CONNS"},
		{"zero max conns", vars(map[string]string{"DATABASE_MAX_CONNS": "0"}), "DATABASE_MAX_CONNS"},
		{"cors origin with path", vars(map[string]string{"CORS_ALLOWED_ORIGINS": "https://a.example/app"}), "CORS_ALLOWED_ORIGINS"},
		{"cors http in production", vars(map[string]string{"APP_ENV": "production", "CORS_ALLOWED_ORIGINS": "http://a.example"}), "https in production"},
		{"zero rate", vars(map[string]string{"RATE_LIMIT_RPS": "0"}), "RATE_LIMIT_RPS"},
		{"zero burst", vars(map[string]string{"RATE_LIMIT_STRICT_BURST": "0"}), "RATE_LIMIT_BURST"},
		{"idle ttl shorter than refill", vars(map[string]string{"RATE_LIMIT_IDLE_TTL": "10s"}), "RATE_LIMIT_IDLE_TTL"},
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

func TestLoadFrom_DisabledRateLimitSkipsItsValidation(t *testing.T) {
	if _, err := config.LoadFrom(vars(map[string]string{"RATE_LIMIT_ENABLED": "false", "RATE_LIMIT_RPS": "0"})); err != nil {
		t.Fatalf("LoadFrom() error = %v", err)
	}
}

func TestLoadFrom_ReportsAllErrors(t *testing.T) {
	_, err := config.LoadFrom(vars(map[string]string{"APP_ENV": "nope", "LOG_FORMAT": "xml"}))
	if err == nil {
		t.Fatal("LoadFrom() error = nil, want error")
	}
	for _, want := range []string{"APP_ENV", "LOG_FORMAT"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}
