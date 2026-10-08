// Package app wires configuration, infrastructure and modules into a runnable process.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
)

type App struct {
	cfg     config.Config
	log     *slog.Logger
	version string
	handler http.Handler
	closers []func()
}

// Bootstrap connects to the database, applies migrations when DATABASE_AUTO_MIGRATE is set,
// and builds the App. The returned App owns the pool; call Close when done.
func Bootstrap(ctx context.Context, cfg config.Config, log *slog.Logger, version string) (*App, error) {
	pool, err := database.Open(ctx, cfg.DB, log)
	if err != nil {
		return nil, err
	}

	if cfg.DB.AutoMigrate {
		if err := migrateUp(ctx, pool, log); err != nil {
			pool.Close()
			return nil, err
		}
	}

	a, err := Build(cfg, log, version, pool)
	if err != nil {
		pool.Close()
		return nil, err
	}
	a.closers = append(a.closers, pool.Close)
	return a, nil
}

func migrateUp(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
	m, err := database.NewMigrator(pool, db.Migrations, db.MigrationsDir, log)
	if err != nil {
		return err
	}
	defer func() { _ = m.Close() }()

	if err := m.Up(ctx); err != nil {
		return err
	}
	v, _, err := m.Version()
	if err != nil {
		return err
	}
	log.InfoContext(ctx, "database schema up to date", "version", v)
	return nil
}

// Build assembles the HTTP stack around an existing pool, which the caller keeps owning.
// A nil pool builds the app without database checks, for tests of the transport layer.
func Build(cfg config.Config, log *slog.Logger, version string, pool *pgxpool.Pool) (*App, error) {
	a := &App{cfg: cfg, log: log, version: version}

	checks := []health.Checker{}
	if pool != nil {
		expected, err := database.LatestVersion(db.Migrations, db.MigrationsDir)
		if err != nil {
			return nil, err
		}
		checks = append(checks,
			health.NewCheck("database", database.PingCheck(pool, log)),
			health.NewCheck("migrations", database.SchemaCheck(pool, expected, log)),
		)
	}
	healthSvc := health.NewService(health.DefaultCheckTimeout, checks...)

	trusted, err := cfg.HTTP.TrustedProxyPrefixes()
	if err != nil {
		return nil, err
	}

	var limiter *httpx.RateLimiter
	if cfg.RateLimit.Enabled {
		limiter = httpx.NewRateLimiter(cfg.RateLimit)
		a.closers = append(a.closers, limiter.Close)
	}

	handler, err := httpx.NewRouter(httpx.RouterConfig{
		Log:            log,
		Server:         &Server{Handler: health.NewHandler(healthSvc, version)},
		TrustedProxies: trusted,
		CORSOrigins:    cfg.CORS.AllowedOrigins,
		HSTS:           cfg.IsProduction(),
		MaxBodyBytes:   cfg.HTTP.MaxBodyBytes,
		RateLimiter:    limiter,
	})
	if err != nil {
		a.Close()
		return nil, err
	}
	a.handler = handler
	return a, nil
}

// Handler exposes the fully assembled HTTP handler, mainly for tests.
func (a *App) Handler() http.Handler { return a.handler }

// Close releases resources owned by the App in reverse acquisition order. Idempotent.
func (a *App) Close() {
	for i := len(a.closers) - 1; i >= 0; i-- {
		a.closers[i]()
	}
	a.closers = nil
}

// Run serves HTTP until ctx is cancelled, then drains in-flight requests
// within the configured shutdown timeout.
func (a *App) Run(ctx context.Context) error {
	ln, err := (&net.ListenConfig{}).Listen(ctx, "tcp", a.cfg.HTTP.Addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", a.cfg.HTTP.Addr, err)
	}
	return a.Serve(ctx, ln)
}

// Serve is Run with a caller-provided listener. It takes ownership of ln.
func (a *App) Serve(ctx context.Context, ln net.Listener) error {
	srv := &http.Server{
		Handler:           a.handler,
		ReadHeaderTimeout: a.cfg.HTTP.ReadHeaderTimeout,
		ReadTimeout:       a.cfg.HTTP.ReadTimeout,
		WriteTimeout:      a.cfg.HTTP.WriteTimeout,
		IdleTimeout:       a.cfg.HTTP.IdleTimeout,
		ErrorLog:          slog.NewLogLogger(a.log.Handler(), slog.LevelWarn),
		BaseContext:       func(net.Listener) context.Context { return context.WithoutCancel(ctx) },
	}

	serveErr := make(chan error, 1)
	go func() {
		a.log.InfoContext(ctx, "http server started", "addr", ln.Addr().String(), "env", a.cfg.Env, "version", a.version)
		serveErr <- srv.Serve(ln)
	}()

	select {
	case err := <-serveErr:
		return fmt.Errorf("http server: %w", err)
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), a.cfg.HTTP.ShutdownTimeout)
	defer cancel()

	a.log.InfoContext(shutdownCtx, "shutting down http server", "timeout", a.cfg.HTTP.ShutdownTimeout)
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	if err := <-serveErr; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("http server: %w", err)
	}

	a.log.InfoContext(shutdownCtx, "http server stopped")
	return nil
}
