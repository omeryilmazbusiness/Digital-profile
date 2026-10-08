package app_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/app"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

func testConfig(t *testing.T) config.Config {
	t.Helper()
	cfg, err := config.LoadFrom(map[string]string{
		"APP_ENV":               "test",
		"HTTP_ADDR":             "127.0.0.1:0",
		"HTTP_SHUTDOWN_TIMEOUT": "2s",
	})
	if err != nil {
		t.Fatalf("config: %v", err)
	}
	return cfg
}

func discardLogger() *slog.Logger { return slog.New(slog.DiscardHandler) }

func TestApp_ServeAndGracefulShutdown(t *testing.T) {
	ln, err := (&net.ListenConfig{}).Listen(t.Context(), "tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan error, 1)
	go func() { done <- app.New(testConfig(t), discardLogger(), "9.9.9").Serve(ctx, ln) }()

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

	cfg := testConfig(t)
	cfg.HTTP.Addr = ln.Addr().String()

	if err := app.New(cfg, discardLogger(), "v").Run(t.Context()); err == nil {
		t.Fatal("Run() on a busy port returned nil")
	}
}
