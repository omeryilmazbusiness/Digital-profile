package httpx_test

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

var ok = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })

func TestSecurityHeaders_HSTSOnlyWhenEnabled(t *testing.T) {
	for _, hsts := range []bool{false, true} {
		rec := httptest.NewRecorder()
		httpx.SecurityHeaders(hsts)(ok).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", http.NoBody))
		if got := rec.Header().Get("Strict-Transport-Security") != ""; got != hsts {
			t.Errorf("hsts=%v: header present = %v", hsts, got)
		}
		if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
			t.Error("nosniff missing")
		}
	}
}

func TestCORS(t *testing.T) {
	h := httpx.CORS([]string{"https://app.example.com"})(ok)

	preflight := func(origin string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodOptions, "/api/v1/x", http.NoBody)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		req.Header.Set("Access-Control-Request-Headers", "Content-Type, "+httpx.HeaderCSRF)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	allowed := preflight("https://app.example.com")
	if got := allowed.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("allowed origin echoed = %q", got)
	}
	if allowed.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("credentials not allowed for configured origin")
	}

	if got := preflight("https://evil.example.com").Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("foreign origin allowed: %q", got)
	}

	req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	req.Header.Set("Origin", "https://app.example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if !strings.Contains(rec.Header().Get("Access-Control-Expose-Headers"), "X-Request-Id") {
		t.Error("X-Request-Id not exposed to the browser")
	}
}

func TestCORS_DisabledWithoutOrigins(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	req.Header.Set("Origin", "https://anything.example.com")
	rec := httptest.NewRecorder()
	httpx.CORS(nil)(ok).ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("CORS headers sent although no origins configured")
	}
}

func TestBodyLimit(t *testing.T) {
	var readErr error
	h := httpx.BodyLimit(8, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, readErr = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusNoContent)
	}))

	t.Run("declared oversize rejected up front", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("123456789")))
		if rec.Code != http.StatusRequestEntityTooLarge {
			t.Fatalf("status = %d, want 413", rec.Code)
		}
	})

	t.Run("undeclared oversize fails on read", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/", io.NopCloser(strings.NewReader("123456789")))
		req.ContentLength = -1
		h.ServeHTTP(httptest.NewRecorder(), req)
		var maxErr *http.MaxBytesError
		if !errors.As(readErr, &maxErr) {
			t.Fatalf("read error = %v, want *http.MaxBytesError", readErr)
		}
	})

	t.Run("within limit", func(t *testing.T) {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("12345678")))
		if rec.Code != http.StatusNoContent || readErr != nil {
			t.Fatalf("status = %d, err = %v", rec.Code, readErr)
		}
	})
}

func TestBodyLimit_RouteRule(t *testing.T) {
	h := httpx.BodyLimit(8, map[string]httpx.BodyRule{
		"POST /upload":         {MaxBytes: 32, Timeout: time.Minute},
		"PUT /items/{id}/file": {MaxBytes: 32},
	})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, err := io.ReadAll(r.Body); err != nil {
			w.WriteHeader(http.StatusRequestEntityTooLarge)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	body := strings.Repeat("x", 20)
	for _, tc := range []struct {
		method, path string
		want         int
	}{
		{http.MethodPost, "/upload", http.StatusNoContent},
		{http.MethodPut, "/upload", http.StatusRequestEntityTooLarge},
		{http.MethodPost, "/other", http.StatusRequestEntityTooLarge},
		{http.MethodPut, "/items/42/file", http.StatusNoContent},
		{http.MethodPut, "/items//file", http.StatusRequestEntityTooLarge},
		{http.MethodPut, "/items/42/file/x", http.StatusRequestEntityTooLarge},
		{http.MethodPost, "/items/42/file", http.StatusRequestEntityTooLarge},
	} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, strings.NewReader(body)))
		if rec.Code != tc.want {
			t.Errorf("%s %s: status = %d, want %d", tc.method, tc.path, rec.Code, tc.want)
		}
	}
}

func TestContentDisposition(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"Groups & Umrah": `inline; filename="Groups--Umrah.pdf"; filename*=UTF-8''Groups%20&%20Umrah.pdf`,
		"Rates":          `inline; filename="Rates.pdf"`,
		"عروض":           `inline; filename="document.pdf"; filename*=UTF-8''%D8%B9%D8%B1%D9%88%D8%B6.pdf`,
	}
	for in, want := range cases {
		if got := httpx.ContentDisposition("inline", in, ".pdf", "document"); got != want {
			t.Errorf("ContentDisposition(%q) = %s\nwant %s", in, got, want)
		}
	}
}
