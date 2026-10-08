// Package config loads and validates process configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"log/slog"
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
	Env  Environment `env:"APP_ENV" envDefault:"development"`
	HTTP HTTP        `envPrefix:"HTTP_"`
	Log  Log         `envPrefix:"LOG_"`
}

type HTTP struct {
	Addr              string        `env:"ADDR"                envDefault:":8080"`
	ReadHeaderTimeout time.Duration `env:"READ_HEADER_TIMEOUT" envDefault:"5s"`
	ReadTimeout       time.Duration `env:"READ_TIMEOUT"        envDefault:"15s"`
	WriteTimeout      time.Duration `env:"WRITE_TIMEOUT"       envDefault:"30s"`
	IdleTimeout       time.Duration `env:"IDLE_TIMEOUT"        envDefault:"120s"`
	ShutdownTimeout   time.Duration `env:"SHUTDOWN_TIMEOUT"    envDefault:"20s"`
}

type Log struct {
	Level  slog.Level `env:"LEVEL"  envDefault:"info"`
	Format LogFormat  `env:"FORMAT" envDefault:"json"`
}

// Load reads configuration from the process environment.
func Load() (Config, error) {
	return LoadFrom(env.ToMap(os.Environ()))
}

// LoadFrom reads configuration from the given variables. It never touches the process environment.
func LoadFrom(vars map[string]string) (Config, error) {
	cfg, err := env.ParseAsWithOptions[Config](env.Options{Environment: vars})
	if err != nil {
		return Config{}, fmt.Errorf("parse config: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, fmt.Errorf("invalid config: %w", err)
	}
	return cfg, nil
}

func (c Config) Validate() error {
	var errs []error

	if !c.Env.Valid() {
		errs = append(errs, fmt.Errorf("APP_ENV %q is not one of development|test|staging|production", c.Env))
	}
	if strings.TrimSpace(c.HTTP.Addr) == "" {
		errs = append(errs, errors.New("HTTP_ADDR must not be empty"))
	}
	for name, d := range map[string]time.Duration{
		"HTTP_READ_HEADER_TIMEOUT": c.HTTP.ReadHeaderTimeout,
		"HTTP_READ_TIMEOUT":        c.HTTP.ReadTimeout,
		"HTTP_WRITE_TIMEOUT":       c.HTTP.WriteTimeout,
		"HTTP_IDLE_TIMEOUT":        c.HTTP.IdleTimeout,
		"HTTP_SHUTDOWN_TIMEOUT":    c.HTTP.ShutdownTimeout,
	} {
		if d <= 0 {
			errs = append(errs, fmt.Errorf("%s must be positive, got %s", name, d))
		}
	}
	if c.Log.Format != LogFormatJSON && c.Log.Format != LogFormatText {
		errs = append(errs, fmt.Errorf("LOG_FORMAT %q is not one of json|text", c.Log.Format))
	}

	return errors.Join(errs...)
}

func (c Config) IsProduction() bool { return c.Env == EnvProduction }
