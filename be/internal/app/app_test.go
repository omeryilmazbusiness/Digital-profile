package app_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/app"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

func testConfig(t *testing.T, overrides map[string]string) config.Config {
	t.Helper()
	vars := map[string]string{
		"APP_ENV":               "test",
		"HTTP_ADDR":             "127.0.0.1:0",
		"HTTP_SHUTDOWN_TIMEOUT": "2s",
		"DATABASE_URL":          "postgres://unused@127.0.0.1:1/unused?sslmode=disable",
		"DATABASE_MIN_CONNS":    "0",
	}
	for k, v := range overrides {
		vars[k] = v
	}
	cfg, err := config.LoadFrom(vars)
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	return cfg
}

func discardLogger() *slog.Logger { return slog.New(slog.DiscardHandler) }

func build(t *testing.T, cfg config.Config) *app.App {
	t.Helper()
	a, err := app.Build(cfg, discardLogger(), "9.9.9", nil)
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(a.Close)
	return a
}

func get(t *testing.T, h http.Handler, path string) (*http.Response, api.HealthReport) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, path, http.NoBody))
	res := rec.Result()
	var report api.HealthReport
	_ = json.NewDecoder(res.Body).Decode(&report)
	_ = res.Body.Close()
	return res, report
}

func TestApp_ServeAndGracefulShutdown(t *testing.T) {
	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	a := build(t, testConfig(t, nil))
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- a.Serve(ctx, ln) }()

	url := "http://" + ln.Addr().String() + "/healthz"
	req, _ := http.NewRequestWithContext(t.Context(), http.MethodGet, url, http.NoBody)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	body, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, body = %s", res.StatusCode, body)
	}
	var report api.HealthReport
	if err := json.Unmarshal(body, &report); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if report.Version != "9.9.9" || report.Status != api.Up {
		t.Errorf("report = %+v", report)
	}

	cancel()
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("Serve() returned %v after cancel, want nil", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not shut down")
	}
}

func TestApp_RunFailsOnBusyPort(t *testing.T) {
	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })

	a := build(t, testConfig(t, map[string]string{"HTTP_ADDR": ln.Addr().String()}))
	if err := a.Run(t.Context()); err == nil {
		t.Fatal("Run() on a busy port returned nil")
	}
}

func TestApp_ProductionSendsHSTS(t *testing.T) {
	a := build(t, testConfig(t, map[string]string{"APP_ENV": "production"}))
	res, _ := get(t, a.Handler(), "/healthz")
	if res.Header.Get("Strict-Transport-Security") == "" {
		t.Error("HSTS missing in production")
	}
}

func TestApp_CloseIsIdempotent(t *testing.T) {
	a := build(t, testConfig(t, nil))
	a.Close()
	a.Close()
}

func TestBootstrap_FailsFastWithoutDatabase(t *testing.T) {
	cfg := testConfig(t, map[string]string{"DATABASE_CONNECT_TIMEOUT": "1s"})
	if _, err := app.Bootstrap(t.Context(), cfg, discardLogger(), "v"); err == nil {
		t.Fatal("Bootstrap succeeded without a reachable database")
	}
}

func TestBootstrap_AutoMigrateThenReady(t *testing.T) {
	t.Parallel()
	cfg := testConfig(t, map[string]string{
		"DATABASE_URL":          dbtest.NewEmptyURL(t),
		"DATABASE_AUTO_MIGRATE": "true",
	})

	a, err := app.Bootstrap(t.Context(), cfg, discardLogger(), "1.2.3")
	if err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	t.Cleanup(a.Close)

	res, report := get(t, a.Handler(), "/readyz")
	if res.StatusCode != http.StatusOK || report.Status != api.Up {
		t.Fatalf("readyz = %d %+v", res.StatusCode, report)
	}
	names := map[string]api.HealthStatus{}
	if report.Checks != nil {
		for _, c := range *report.Checks {
			names[c.Name] = c.Status
		}
	}
	if names["database"] != api.Up || names["migrations"] != api.Up {
		t.Errorf("checks = %v, want database and migrations up", names)
	}
}

func TestBootstrap_NotReadyUntilMigrated(t *testing.T) {
	t.Parallel()
	cfg := testConfig(t, map[string]string{"DATABASE_URL": dbtest.NewEmptyURL(t)})

	a, err := app.Bootstrap(t.Context(), cfg, discardLogger(), "1.2.3")
	if err != nil {
		t.Fatalf("Bootstrap: %v", err)
	}
	t.Cleanup(a.Close)

	res, report := get(t, a.Handler(), "/readyz")
	if res.StatusCode != http.StatusServiceUnavailable || report.Status != api.Down {
		t.Fatalf("readyz = %d %+v, want 503 down", res.StatusCode, report)
	}
	for _, c := range *report.Checks {
		want := api.Up
		if c.Name == "migrations" {
			want = api.Down
		}
		if c.Status != want {
			t.Errorf("check %s = %s, want %s", c.Name, c.Status, want)
		}
	}

	if live, _ := get(t, a.Handler(), "/healthz"); live.StatusCode != http.StatusOK {
		t.Errorf("liveness = %d; it must not depend on the database", live.StatusCode)
	}
}
