// Package config loads and validates process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/caarlos0/env/v11"
)

type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvTest        Environment = "test"
	EnvStaging     Environment = "staging"
	EnvProduction  Environment = "production"
)

func (e Environment) Valid() bool {
	switch e {
	case EnvDevelopment, EnvTest, EnvStaging, EnvProduction:
		return true
	default:
		return false
	}
}

type LogFormat string

const (
	LogFormatJSON LogFormat = "json"
	LogFormatText LogFormat = "text"
)

type Config struct {
	Env Environment `env:"APP_ENV" envDefault:"development"`
	// PublicOrigin is the browser-facing origin (scheme://host[:port]) serving the site and API.
	// State-changing requests from any other origin are rejected (CSRF defence).
	PublicOrigin string    `env:"APP_PUBLIC_ORIGIN" envDefault:"http://localhost:3000"`
	HTTP         HTTP      `envPrefix:"HTTP_"`
	Log          Log       `envPrefix:"LOG_"`
	DB           DB        `envPrefix:"DATABASE_"`
	CORS         CORS      `envPrefix:"CORS_"`
	RateLimit    RateLimit `envPrefix:"RATE_LIMIT_"`
	Auth         Auth      `envPrefix:"AUTH_"`
	Storage      Storage   `envPrefix:"STORAGE_"`
	S3           S3        `envPrefix:"S3_"`
	Media        Media     `envPrefix:"MEDIA_"`
	Documents    Documents `envPrefix:"DOCUMENTS_"`
	Railway      Railway
}

// CLI is the subset of configuration operational commands need. It deliberately omits
// secrets such as AUTH_JWT_KEYS, so migrations can run with database credentials alone.
type CLI struct {
	Env Environment `env:"APP_ENV" envDefault:"development"`
	Log Log         `envPrefix:"LOG_"`
	DB  DB          `envPrefix:"DATABASE_"`
}

type HTTP struct {
	Addr              string        `env:"ADDR"                envDefault:":8080"`
	ReadHeaderTimeout time.Duration `env:"READ_HEADER_TIMEOUT" envDefault:"5s"`
	ReadTimeout       time.Duration `env:"READ_TIMEOUT"        envDefault:"15s"`
	WriteTimeout      time.Duration `env:"WRITE_TIMEOUT"       envDefault:"30s"`
	IdleTimeout       time.Duration `env:"IDLE_TIMEOUT"        envDefault:"120s"`
	ShutdownTimeout   time.Duration `env:"SHUTDOWN_TIMEOUT"    envDefault:"20s"`
	MaxBodyBytes      int64         `env:"MAX_BODY_BYTES"      envDefault:"1048576"`
	// TrustedProxies lists CIDRs whose X-Forwarded-For header is believed when resolving the client IP.
	TrustedProxies []string `env:"TRUSTED_PROXIES" envDefault:"127.0.0.1/32,::1/128" envSeparator:","`
}

// TrustedProxyPrefixes parses TrustedProxies. Validate guarantees it succeeds on a loaded Config.
func (h HTTP) TrustedProxyPrefixes() ([]netip.Prefix, error) {
	out := make([]netip.Prefix, 0, len(h.TrustedProxies))
	for _, raw := range h.TrustedProxies {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		p, err := netip.ParsePrefix(raw)
		if err != nil {
			return nil, fmt.Errorf("HTTP_TRUSTED_PROXIES: %q is not a CIDR", raw)
		}
		out = append(out, p.Masked())
	}
	return out, nil
}

type Log struct {
	Level  slog.Level `env:"LEVEL"  envDefault:"info"`
	Format LogFormat  `env:"FORMAT" envDefault:"json"`
}

type DB struct {
	URL             string        `env:"URL,required,notEmpty"`
	MaxConns        int32         `env:"MAX_CONNS"          envDefault:"10"`
	MinConns        int32         `env:"MIN_CONNS"          envDefault:"1"`
	MaxConnLifetime time.Duration `env:"MAX_CONN_LIFETIME"  envDefault:"1h"`
	MaxConnIdleTime time.Duration `env:"MAX_CONN_IDLE_TIME" envDefault:"15m"`
	ConnectTimeout  time.Duration `env:"CONNECT_TIMEOUT"    envDefault:"5s"`
	// AutoMigrate applies pending migrations at startup. Intended for development;
	// production deploys run `cli migrate up` as an explicit release step.
	AutoMigrate bool `env:"AUTO_MIGRATE" envDefault:"false"`
}

type CORS struct {
	AllowedOrigins []string `env:"ALLOWED_ORIGINS" envSeparator:","`
}

type RateLimit struct {
	Enabled bool `env:"ENABLED" envDefault:"true"`
	// Default policy, applied per client IP to every non-probe request.
	RPS   float64 `env:"RPS"   envDefault:"10"`
	Burst int     `env:"BURST" envDefault:"20"`
	// Strict policy for abuse-prone endpoints (login, public forms).
	StrictRPS   float64  `env:"STRICT_RPS"   envDefault:"0.2"`
	StrictBurst int      `env:"STRICT_BURST" envDefault:"5"`
	StrictPaths []string `env:"STRICT_PATHS" envDefault:"/api/v1/auth/login,/api/v1/auth/password,/api/v1/public/leads" envSeparator:","`
	// IdleTTL evicts per-client state that has not been used for this long.
	IdleTTL time.Duration `env:"IDLE_TTL" envDefault:"10m"`
}

// Load reads configuration from the process environment.
func Load() (Config, error) {
	return LoadFrom(env.ToMap(os.Environ()))
}

// LoadFrom reads configuration from the given variables. It never touches the process environment.
func LoadFrom(vars map[string]string) (Config, error) {
	return load[Config](vars)
}

// LoadCLI reads the CLI subset from the process environment.
func LoadCLI() (CLI, error) {
	return LoadCLIFrom(env.ToMap(os.Environ()))
}

func LoadCLIFrom(vars map[string]string) (CLI, error) {
	return load[CLI](vars)
}

func load[T interface{ Validate() error }](vars map[string]string) (T, error) {
	var zero T
	cfg, err := env.ParseAsWithOptions[T](env.Options{Environment: vars})
	if err != nil {
		return zero, fmt.Errorf("parse config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return zero, fmt.Errorf("invalid config: %w", err)
	}
	return cfg, nil
}

func (c CLI) Validate() error {
	var errs []error
	if !c.Env.Valid() {
		errs = append(errs, fmt.Errorf("APP_ENV %q is not one of development|test|staging|production", c.Env))
	}
	if c.Log.Format != LogFormatJSON && c.Log.Format != LogFormatText {
		errs = append(errs, fmt.Errorf("LOG_FORMAT %q is not one of json|text", c.Log.Format))
	}
	errs = append(errs, c.DB.validate()...)
	return errors.Join(errs...)
}

func (c Config) Validate() error {
	var errs []error

	if !c.Env.Valid() {
		errs = append(errs, fmt.Errorf("APP_ENV %q is not one of development|test|staging|production", c.Env))
	}
	errs = append(errs, c.HTTP.validate()...)
	if c.Log.Format != LogFormatJSON && c.Log.Format != LogFormatText {
		errs = append(errs, fmt.Errorf("LOG_FORMAT %q is not one of json|text", c.Log.Format))
	}
	errs = append(errs, c.DB.validate()...)
	if err := validateOrigin("APP_PUBLIC_ORIGIN", c.PublicOrigin, c.IsProduction()); err != nil {
		errs = append(errs, err)
	}
	errs = append(errs, c.CORS.validate(c.IsProduction())...)
	errs = append(errs, c.Auth.validate(c.IsProduction())...)
	errs = append(errs, c.RateLimit.validate()...)
	errs = append(errs, c.Storage.validate(c.S3, c.Railway)...)
	errs = append(errs, c.Media.validate(c.IsProduction())...)
	errs = append(errs, c.Documents.validate()...)

	return errors.Join(errs...)
}

func (h HTTP) validate() []error {
	var errs []error
	if strings.TrimSpace(h.Addr) == "" {
		errs = append(errs, errors.New("HTTP_ADDR must not be empty"))
	}
	errs = append(errs, positive(map[string]time.Duration{
		"HTTP_READ_HEADER_TIMEOUT": h.ReadHeaderTimeout,
		"HTTP_READ_TIMEOUT":        h.ReadTimeout,
		"HTTP_WRITE_TIMEOUT":       h.WriteTimeout,
		"HTTP_IDLE_TIMEOUT":        h.IdleTimeout,
		"HTTP_SHUTDOWN_TIMEOUT":    h.ShutdownTimeout,
	})...)
	if h.MaxBodyBytes <= 0 {
		errs = append(errs, fmt.Errorf("HTTP_MAX_BODY_BYTES must be positive, got %d", h.MaxBodyBytes))
	}
	if _, err := h.TrustedProxyPrefixes(); err != nil {
		errs = append(errs, err)
	}
	return errs
}

func (d DB) validate() []error {
	var errs []error
	if u, err := url.Parse(d.URL); err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
		errs = append(errs, errors.New("DATABASE_URL must be a postgres:// or postgresql:// URL with a host"))
	}
	if d.MaxConns <= 0 {
		errs = append(errs, fmt.Errorf("DATABASE_MAX_CONNS must be positive, got %d", d.MaxConns))
	}
	if d.MinConns < 0 || d.MinConns > d.MaxConns {
		errs = append(errs, fmt.Errorf("DATABASE_MIN_CONNS must be between 0 and DATABASE_MAX_CONNS, got %d", d.MinConns))
	}
	errs = append(errs, positive(map[string]time.Duration{
		"DATABASE_MAX_CONN_LIFETIME":  d.MaxConnLifetime,
		"DATABASE_MAX_CONN_IDLE_TIME": d.MaxConnIdleTime,
		"DATABASE_CONNECT_TIMEOUT":    d.ConnectTimeout,
	})...)
	return errs
}

func (c CORS) validate(production bool) []error {
	var errs []error
	for _, o := range c.AllowedOrigins {
		if err := validateOrigin("CORS_ALLOWED_ORIGINS", o, production); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}

// validateOrigin requires an exact browser origin, as compared against the Origin header:
// scheme and host, optional port, no path, no trailing slash.
func validateOrigin(name, o string, production bool) error {
	u, err := url.Parse(o)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return fmt.Errorf("%s: %q is not an origin (scheme://host[:port], no trailing slash)", name, o)
	}
	if production && u.Scheme != "https" {
		return fmt.Errorf("%s: %q must use https in production", name, o)
	}
	return nil
}

func (r RateLimit) validate() []error {
	if !r.Enabled {
		return nil
	}
	var errs []error
	if r.RPS <= 0 || r.StrictRPS <= 0 {
		errs = append(errs, errors.New("RATE_LIMIT_RPS and RATE_LIMIT_STRICT_RPS must be positive"))
	}
	if r.Burst < 1 || r.StrictBurst < 1 {
		errs = append(errs, errors.New("RATE_LIMIT_BURST and RATE_LIMIT_STRICT_BURST must be at least 1"))
	}
	if len(errs) > 0 {
		return errs
	}
	// Evicting a client before its bucket refills would hand it a fresh burst early.
	refill := time.Duration(max(float64(r.Burst)/r.RPS, float64(r.StrictBurst)/r.StrictRPS) * float64(time.Second))
	if r.IdleTTL < refill {
		errs = append(errs, fmt.Errorf("RATE_LIMIT_IDLE_TTL must be at least the slowest bucket refill time (%s)", refill))
	}
	return errs
}

func positive(durations map[string]time.Duration) []error {
	var errs []error
	for name, d := range durations {
		if d <= 0 {
			errs = append(errs, fmt.Errorf("%s must be positive, got %s", name, d))
		}
	}
	return errs
}

func (c Config) IsProduction() bool { return c.Env == EnvProduction }
