package httpx_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

// stubServer lets each test decide how the handlers behave.
type stubServer struct {
	liveness func() (api.GetLivenessResponseObject, error)
}

func (s stubServer) GetLiveness(context.Context, api.GetLivenessRequestObject) (api.GetLivenessResponseObject, error) {
	return s.liveness()
}

func (stubServer) GetReadiness(context.Context, api.GetReadinessRequestObject) (api.GetReadinessResponseObject, error) {
	return api.GetReadiness200JSONResponse{Status: api.Up, Version: "test"}, nil
}

func newRouter(t *testing.T, s stubServer) (http.Handler, *bytes.Buffer) {
	t.Helper()
	var logs bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&logs, &slog.HandlerOptions{Level: slog.LevelDebug}))
	if s.liveness == nil {
		s.liveness = func() (api.GetLivenessResponseObject, error) {
			return api.GetLiveness200JSONResponse{Status: api.Up, Version: "test"}, nil
		}
	}
	return httpx.NewRouter(log, s), &logs
}

func decodeProblem(t *testing.T, res *http.Response) api.Problem {
	t.Helper()
	if ct := res.Header.Get("Content-Type"); ct != httpx.ContentTypeProblem {
		t.Fatalf("Content-Type = %q, want %q", ct, httpx.ContentTypeProblem)
	}
	var p api.Problem
	if err := json.NewDecoder(res.Body).Decode(&p); err != nil {
		t.Fatalf("decode problem: %v", err)
	}
	if int(p.Status) != res.StatusCode {
		t.Errorf("problem.status = %d, HTTP status = %d", p.Status, res.StatusCode)
	}
	if p.RequestId == nil || *p.RequestId == "" {
		t.Error("problem.requestId is missing")
	}
	return p
}

func serve(h http.Handler, method, target string) *http.Response {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, target, http.NoBody))
	return rec.Result()
}

func TestRouter_ServesGeneratedRoute(t *testing.T) {
	h, logs := newRouter(t, stubServer{})

	res := serve(h, http.MethodGet, "/healthz")
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", res.StatusCode)
	}
	if strings.Contains(logs.String(), `"request_id":""`) || !strings.Contains(logs.String(), `"request_id":"`) {
		t.Errorf("access log has no generated request id: %s", logs.String())
	}
	if !strings.Contains(logs.String(), `"path":"/healthz"`) {
		t.Errorf("access log missing path: %s", logs.String())
	}
}

func TestRouter_HonoursIncomingRequestID(t *testing.T) {
	h, logs := newRouter(t, stubServer{})

	req := httptest.NewRequest(http.MethodGet, "/healthz", http.NoBody)
	req.Header.Set("X-Request-Id", "trace-123")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if !strings.Contains(logs.String(), `"request_id":"trace-123"`) {
		t.Errorf("access log does not carry incoming request id: %s", logs.String())
	}
}

func TestRouter_NotFoundIsProblem(t *testing.T) {
	h, _ := newRouter(t, stubServer{})

	res := serve(h, http.MethodGet, "/does-not-exist")
	defer res.Body.Close()

	if res.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", res.StatusCode)
	}
	p := decodeProblem(t, res)
	if p.Title != "Not Found" || p.Instance == nil || *p.Instance != "/does-not-exist" {
		t.Errorf("problem = %+v", p)
	}
}

func TestRouter_MethodNotAllowedIsProblem(t *testing.T) {
	h, _ := newRouter(t, stubServer{})

	res := serve(h, http.MethodPost, "/healthz")
	defer res.Body.Close()

	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", res.StatusCode)
	}
	decodeProblem(t, res)
}

func TestRouter_HandlerErrorIsOpaque500(t *testing.T) {
	h, logs := newRouter(t, stubServer{liveness: func() (api.GetLivenessResponseObject, error) {
		return nil, errors.New("secret connection string leaked")
	}})

	res := serve(h, http.MethodGet, "/healthz")
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", res.StatusCode)
	}
	body, _ := io.ReadAll(res.Body)
	if strings.Contains(string(body), "secret") {
		t.Fatalf("internal error leaked to client: %s", body)
	}
	if !strings.Contains(logs.String(), "secret connection string leaked") {
		t.Error("internal error was not logged")
	}
}

func TestRouter_PanicIsRecovered(t *testing.T) {
	h, logs := newRouter(t, stubServer{liveness: func() (api.GetLivenessResponseObject, error) {
		panic("kaboom")
	}})

	res := serve(h, http.MethodGet, "/healthz")
	defer res.Body.Close()

	if res.StatusCode != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", res.StatusCode)
	}
	p := decodeProblem(t, res)
	if p.Detail != nil {
		t.Errorf("panic detail leaked: %q", *p.Detail)
	}
	if !strings.Contains(logs.String(), "panic recovered") || !strings.Contains(logs.String(), "kaboom") {
		t.Errorf("panic was not logged: %s", logs.String())
	}
}

func TestRouter_ErrAbortHandlerIsRepanicked(t *testing.T) {
	h, _ := newRouter(t, stubServer{liveness: func() (api.GetLivenessResponseObject, error) {
		panic(http.ErrAbortHandler)
	}})

	defer func() {
		if rec := recover(); rec != http.ErrAbortHandler { //nolint:errorlint // identity check on sentinel panic value
			t.Errorf("recovered %v, want http.ErrAbortHandler", rec)
		}
	}()
	serve(h, http.MethodGet, "/healthz")
	t.Fatal("expected panic to propagate")
}
