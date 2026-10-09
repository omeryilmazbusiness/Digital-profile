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

const (
	testDSN = "postgres://app:secret@localhost:5432/app?sslmode=disable"
	// 32 bytes of zeros, base64: valid length, obviously not a real key.
	testKey = "k1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
)

// vars returns the minimal valid environment plus overrides.
func vars(overrides map[string]string) map[string]string {
	v := map[string]string{"DATABASE_URL": testDSN, "AUTH_JWT_KEYS": testKey}
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
	if !rl.Enabled || rl.RPS != 10 || rl.Burst != 20 || rl.StrictBurst != 5 || len(rl.StrictPaths) != 3 {
		t.Errorf("RateLimit = %+v", rl)
	}

	if cfg.PublicOrigin != "http://localhost:3000" {
		t.Errorf("PublicOrigin = %q", cfg.PublicOrigin)
	}
	a := cfg.Auth
	if a.AccessTTL != 15*time.Minute || a.RefreshTTL != 7*24*time.Hour || !a.CookieSecure || a.LockoutThreshold != 5 {
		t.Errorf("Auth = %+v", a)
	}
	keys, err := a.SigningKeys()
	if err != nil || len(keys) != 1 || keys[0].ID != "k1" || len(keys[0].Secret) != 32 {
		t.Errorf("SigningKeys() = %+v, %v", keys, err)
	}

	if cfg.Storage.Driver != config.StorageLocal || cfg.Storage.LocalDir == "" {
		t.Errorf("Storage = %+v", cfg.Storage)
	}
	if m := cfg.Media; m.MaxUploadBytes != 20<<20 || m.MaxPixels != 50_000_000 || m.ProcessingConcurrency != 1 || m.PublicBaseURL != "" {
		t.Errorf("Media = %+v", m)
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
		"APP_PUBLIC_ORIGIN":      "https://momen.example",
		"AUTH_JWT_KEYS":          "new:" + strings.Repeat("A", 44) + "," + testKey,
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
	if keys, _ := cfg.Auth.SigningKeys(); len(keys) != 2 || keys[0].ID != "new" {
		t.Errorf("first key must be the signer: %+v", keys)
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
		{"missing jwt keys", vars(map[string]string{"AUTH_JWT_KEYS": ""}), "AUTH_JWT_KEYS"},
		{"jwt key without kid", vars(map[string]string{"AUTH_JWT_KEYS": strings.Repeat("A", 44)}), "kid:base64secret"},
		{"short jwt key", vars(map[string]string{"AUTH_JWT_KEYS": "k1:c2hvcnQ="}), "at least 32 bytes"},
		{"jwt key not base64", vars(map[string]string{"AUTH_JWT_KEYS": "k1:!!!"}), "not valid base64"},
		{"duplicate kid", vars(map[string]string{"AUTH_JWT_KEYS": testKey + "," + testKey}), "duplicate kid"},
		{"access ttl too long", vars(map[string]string{"AUTH_ACCESS_TTL": "2h"}), "AUTH_ACCESS_TTL"},
		{"refresh not longer than access", vars(map[string]string{"AUTH_REFRESH_TTL": "15m"}), "AUTH_REFRESH_TTL"},
		{"session shorter than refresh", vars(map[string]string{"AUTH_SESSION_MAX_AGE": "1h"}), "AUTH_SESSION_MAX_AGE"},
		{"insecure cookies in production", vars(map[string]string{"APP_ENV": "production", "APP_PUBLIC_ORIGIN": "https://a.example", "AUTH_COOKIE_SECURE": "false"}), "AUTH_COOKIE_SECURE"},
		{"zero lockout threshold", vars(map[string]string{"AUTH_LOCKOUT_THRESHOLD": "0"}), "AUTH_LOCKOUT_THRESHOLD"},
		{"lockout max below base", vars(map[string]string{"AUTH_LOCKOUT_MAX": "10s"}), "AUTH_LOCKOUT_MAX"},
		{"public origin with slash", vars(map[string]string{"APP_PUBLIC_ORIGIN": "https://a.example/"}), "APP_PUBLIC_ORIGIN"},
		{"public origin http in production", vars(map[string]string{"APP_ENV": "production"}), "APP_PUBLIC_ORIGIN"},
		{"idle ttl shorter than refill", vars(map[string]string{"RATE_LIMIT_IDLE_TTL": "10s"}), "RATE_LIMIT_IDLE_TTL"},
		{"unknown storage driver", vars(map[string]string{"STORAGE_DRIVER": "gcs"}), "STORAGE_DRIVER"},
		{"empty local dir", vars(map[string]string{"STORAGE_LOCAL_DIR": " "}), "STORAGE_LOCAL_DIR"},
		{"s3 without endpoint", vars(map[string]string{"STORAGE_DRIVER": "s3", "S3_BUCKET": "b", "S3_ACCESS_KEY": "a", "S3_SECRET_KEY": "s"}), "S3_ENDPOINT"},
		{"s3 without credentials", vars(map[string]string{"STORAGE_DRIVER": "s3", "S3_ENDPOINT": "http://localhost:9000"}), "S3_ACCESS_KEY"},
		{"tiny upload limit", vars(map[string]string{"MEDIA_MAX_UPLOAD_BYTES": "1000"}), "MEDIA_MAX_UPLOAD_BYTES"},
		{"huge pixel limit", vars(map[string]string{"MEDIA_MAX_PIXELS": "999999999"}), "MEDIA_MAX_PIXELS"},
		{"zero processing concurrency", vars(map[string]string{"MEDIA_PROCESSING_CONCURRENCY": "0"}), "MEDIA_PROCESSING_CONCURRENCY"},
		{"low webp quality", vars(map[string]string{"MEDIA_WEBP_QUALITY": "10"}), "MEDIA_WEBP_QUALITY"},
		{"media base url with slash", vars(map[string]string{"MEDIA_PUBLIC_BASE_URL": "https://cdn.example/"}), "MEDIA_PUBLIC_BASE_URL"},
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

func TestLoadCLIFrom_NeedsOnlyDatabase(t *testing.T) {
	cfg, err := config.LoadCLIFrom(map[string]string{"DATABASE_URL": testDSN})
	if err != nil {
		t.Fatalf("LoadCLIFrom() error = %v", err)
	}
	if cfg.DB.URL != testDSN {
		t.Errorf("DB.URL = %q", cfg.DB.URL)
	}
	if _, err := config.LoadCLIFrom(map[string]string{"DATABASE_URL": "mysql://x"}); err == nil {
		t.Error("invalid DATABASE_URL accepted")
	}
}
