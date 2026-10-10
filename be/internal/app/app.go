// Package app wires configuration, infrastructure and modules into a runnable process.
package app

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/discover"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/settings"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/site"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/imaging"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

// maxConcurrentHashes bounds argon2id memory: each hash allocates Argon2Params.MemoryKiB.
const maxConcurrentHashes = 4

type App struct {
	cfg     config.Config
	log     *slog.Logger
	version string
	handler http.Handler
	jobs    []func(context.Context)
	closers []func()
}

type options struct {
	argon2 auth.Argon2Params
	now    func() time.Time
}

// Option customises Build, mainly so tests can use a cheap password hash and a fixed clock.
type Option func(*options)

func WithArgon2Params(p auth.Argon2Params) Option { return func(o *options) { o.argon2 = p } }
func WithClock(now func() time.Time) Option       { return func(o *options) { o.now = now } }

// Bootstrap connects to the database, applies migrations when DATABASE_AUTO_MIGRATE is set,
// and builds the App. The returned App owns the pool; call Close when done.
func Bootstrap(ctx context.Context, cfg config.Config, log *slog.Logger, version string, opts ...Option) (*App, error) {
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

	a, err := Build(ctx, cfg, log, version, pool, opts...)
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
// The pool connects lazily, so transport-level tests can pass one for an unreachable server.
func Build(ctx context.Context, cfg config.Config, log *slog.Logger, version string, pool *pgxpool.Pool, opts ...Option) (*App, error) {
	if pool == nil {
		return nil, errors.New("app: database pool is required")
	}
	o := options{argon2: auth.DefaultArgon2Params, now: utcNow}
	for _, opt := range opts {
		opt(&o)
	}
	a := &App{cfg: cfg, log: log, version: version}

	expected, err := database.LatestVersion(db.Migrations, db.MigrationsDir)
	if err != nil {
		return nil, err
	}
	blobs, closeBlobs, err := openStorage(cfg, pool)
	if err != nil {
		return nil, err
	}
	a.closers = append(a.closers, closeBlobs)

	healthSvc := health.NewService(health.DefaultCheckTimeout,
		health.NewCheck("database", database.PingCheck(pool, log)),
		health.NewCheck("migrations", database.SchemaCheck(pool, expected, log)),
		health.NewCheck("storage", storageCheck(blobs, log)),
	)

	proc, err := imaging.NewProcessor(imaging.Options{
		MaxPixels:   cfg.Media.MaxPixels,
		Quality:     cfg.Media.WebPQuality,
		Concurrency: cfg.Media.ProcessingConcurrency,
	})
	if err != nil {
		a.Close()
		return nil, err
	}
	mediaSvc := media.NewService(pool, blobs, proc, cfg.Media.PublicBaseURL, log)
	profileSvc := profile.NewService(pool, mediaSvc, cfg.PublicOrigin, log)
	discoverSvc := discover.NewService(pool, blobs, log)
	settingsSvc := settings.NewService(pool)

	authSvc, guard, authHandler, err := buildAuth(ctx, cfg, log, pool, o)
	if err != nil {
		a.Close()
		return nil, err
	}
	a.jobs = append(a.jobs, sessionJanitor(authSvc, log))

	trusted, err := cfg.HTTP.TrustedProxyPrefixes()
	if err != nil {
		a.Close()
		return nil, err
	}

	var limiter *httpx.RateLimiter
	if cfg.RateLimit.Enabled {
		limiter = httpx.NewRateLimiter(cfg.RateLimit)
		a.closers = append(a.closers, limiter.Close)
	}

	handler, err := httpx.NewRouter(httpx.RouterConfig{
		Log: log,
		Server: &Server{
			Handler:         health.NewHandler(healthSvc, version),
			AuthHandler:     authHandler,
			MediaHandler:    media.NewHandler(mediaSvc, cfg.Media.MaxUploadBytes),
			ProfileHandler:  profile.NewHandler(profileSvc),
			DiscoverHandler: discover.NewHandler(discoverSvc, cfg.Documents.MaxUploadBytes),
			SettingsHandler: settings.NewHandler(settingsSvc),
			SiteHandler:     site.NewHandler(profileSvc, discoverSvc, settingsSvc),
		},
		TrustedProxies: trusted,
		CORSOrigins:    cfg.CORS.AllowedOrigins,
		HSTS:           cfg.IsProduction(),
		MaxBodyBytes:   cfg.HTTP.MaxBodyBytes,
		BodyRules: map[string]httpx.BodyRule{
			// Room for multipart framing on top of the file itself.
			http.MethodPost + " /api/v1/admin/media": {MaxBytes: cfg.Media.MaxUploadBytes + 64<<10, Timeout: uploadTimeout},
			http.MethodPost + " /api/v1/admin/discover/sections/{sectionId}/documents": {
				MaxBytes: cfg.Documents.MaxUploadBytes + 128<<10, Timeout: uploadTimeout,
			},
			http.MethodPut + " /api/v1/admin/documents/{documentId}/file": {
				MaxBytes: cfg.Documents.MaxUploadBytes + 64<<10, Timeout: uploadTimeout,
			},
		},
		RateLimiter:       limiter,
		CSRFOrigins:       append([]string{cfg.PublicOrigin}, cfg.CORS.AllowedOrigins...),
		CSRFPrefixes:      []string{"/api/v1/auth/", "/api/v1/admin/"},
		StrictMiddlewares: []api.StrictMiddlewareFunc{guard.Middleware},
	})
	if err != nil {
		a.Close()
		return nil, err
	}
	a.handler = handler
	return a, nil
}

// uploadTimeout covers a large photo over a slow mobile uplink plus processing.
const uploadTimeout = 3 * time.Minute

func openStorage(cfg config.Config, pool *pgxpool.Pool) (storage.Storage, func(), error) {
	switch cfg.Storage.Driver {
	case config.StoragePostgres:
		return storage.NewPostgres(pool), func() {}, nil
	case config.StorageS3:
		s, err := storage.NewS3(storage.S3Config{
			Endpoint: cfg.S3.Endpoint, Region: cfg.S3.Region, Bucket: cfg.S3.Bucket,
			AccessKey: cfg.S3.AccessKey, SecretKey: cfg.S3.SecretKey, PathStyle: cfg.S3.PathStyle,
		})
		return s, func() {}, err
	default:
		l, err := storage.NewLocal(cfg.Storage.LocalDir)
		if err != nil {
			return nil, nil, err
		}
		return l, func() { _ = l.Close() }, nil
	}
}

func storageCheck(s storage.Storage, log *slog.Logger) func(context.Context) error {
	return func(ctx context.Context) error {
		if err := s.Ping(ctx); err != nil {
			log.WarnContext(ctx, "storage health check failed", "error", err)
			return errors.New("storage unavailable")
		}
		return nil
	}
}

func buildAuth(ctx context.Context, cfg config.Config, log *slog.Logger, pool *pgxpool.Pool, o options) (*auth.Service, *auth.Guard, *auth.Handler, error) {
	keys, err := cfg.Auth.SigningKeys()
	if err != nil {
		return nil, nil, nil, err
	}
	tokens, err := auth.NewTokenIssuer(keys, cfg.Auth.JWTIssuer, cfg.Auth.JWTAudience, cfg.Auth.AccessTTL, o.now)
	if err != nil {
		return nil, nil, nil, err
	}
	hasher := auth.NewPasswordHasher(o.argon2, maxConcurrentHashes)
	svc, err := auth.NewService(ctx, pool, hasher, tokens, auth.PolicyFrom(cfg.Auth), o.now, log)
	if err != nil {
		return nil, nil, nil, err
	}
	spec, err := api.GetSpec()
	if err != nil {
		return nil, nil, nil, fmt.Errorf("load openapi spec: %w", err)
	}
	cookies := auth.Cookies{Secure: cfg.Auth.CookieSecure}
	return svc, auth.NewGuard(spec, svc, cookies), auth.NewHandler(svc, cookies, o.now), nil
}

// sessionJanitor deletes long-expired sessions hourly so the tables stay small.
func sessionJanitor(svc *auth.Service, log *slog.Logger) func(context.Context) {
	const (
		interval = time.Hour
		retain   = 24 * time.Hour
	)
	return func(ctx context.Context) {
		t := time.NewTicker(interval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				n, err := svc.PurgeExpiredSessions(ctx, retain)
				if err != nil {
					log.WarnContext(ctx, "purge expired sessions", "error", err)
				} else if n > 0 {
					log.InfoContext(ctx, "purged expired sessions", "count", n)
				}
			}
		}
	}
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

	jobsCtx, stopJobs := context.WithCancel(context.WithoutCancel(ctx))
	var jobs sync.WaitGroup
	for _, job := range a.jobs {
		jobs.Go(func() { job(jobsCtx) })
	}
	defer func() {
		stopJobs()
		jobs.Wait()
	}()

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

// utcNow keeps every timestamp the API emits in UTC, independent of the host time zone.
func utcNow() time.Time { return time.Now().UTC() }
