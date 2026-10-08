package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

func TestCSRF(t *testing.T) {
	h := httpx.CSRF([]string{"https://app.example.com"}, []string{"/api/v1/auth/", "/api/v1/admin/"})(ok)

	cases := []struct {
		name, method, path, origin string
		header                     bool
		want                       int
	}{
		{"safe method needs nothing", http.MethodGet, "/api/v1/admin/x", "https://evil.example", false, http.StatusNoContent},
		{"unprotected prefix", http.MethodPost, "/api/v1/public/leads", "", false, http.StatusNoContent},
		{"missing header", http.MethodPost, "/api/v1/auth/login", "https://app.example.com", false, http.StatusForbidden},
		{"foreign origin", http.MethodPost, "/api/v1/auth/login", "https://evil.example", true, http.StatusForbidden},
		{"null origin", http.MethodDelete, "/api/v1/admin/x", "null", true, http.StatusForbidden},
		{"allowed origin", http.MethodPut, "/api/v1/admin/x", "https://app.example.com", true, http.StatusNoContent},
		{"no origin (non-browser)", http.MethodPost, "/api/v1/auth/refresh", "", true, http.StatusNoContent},
		{"prefix root", http.MethodPost, "/api/v1/admin", "", false, http.StatusForbidden},
		{"lookalike path", http.MethodPost, "/api/v1/administrator", "", false, http.StatusNoContent},
	}
	for _, c := range cases {
		req := httptest.NewRequest(c.method, c.path, http.NoBody)
		if c.origin != "" {
			req.Header.Set("Origin", c.origin)
		}
		if c.header {
			req.Header.Set(httpx.HeaderCSRF, "1")
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != c.want {
			t.Errorf("%s: status = %d, want %d", c.name, rec.Code, c.want)
		}
		if c.want == http.StatusForbidden && rec.Header().Get("Content-Type") != httpx.ContentTypeProblem {
			t.Errorf("%s: rejection is not a problem document", c.name)
		}
	}
}
