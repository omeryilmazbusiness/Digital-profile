// Package app wires configuration, infrastructure and modules into a runnable process.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
)

type App struct {
	cfg     config.Config
	log     *slog.Logger
	version string
	handler http.Handler
}

func New(cfg config.Config, log *slog.Logger, version string) *App {
	healthSvc := health.NewService(health.DefaultCheckTimeout)

	server := &Server{
		Handler: health.NewHandler(healthSvc, version),
	}

	return &App{
		cfg:     cfg,
		log:     log,
		version: version,
		handler: httpx.NewRouter(log, server),
	}
}

// Handler exposes the fully assembled HTTP handler, mainly for tests.
func (a *App) Handler() http.Handler { return a.handler }

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
