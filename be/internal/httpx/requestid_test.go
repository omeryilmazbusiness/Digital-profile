package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

var generatedID = regexp.MustCompile(`^[0-9a-f]{32}$`)

func TestRequestID(t *testing.T) {
	tests := []struct {
		name     string
		incoming string
		wantSame bool
	}{
		{"generated when absent", "", false},
		{"propagates well-formed id", "abc-123_DEF.4:5", true},
		{"rejects header injection", "abc\r\nSet-Cookie: x=y", false},
		{"rejects log injection", `abc","level":"ERROR`, false},
		{"rejects oversized id", strings.Repeat("a", 129), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var seen string
			h := httpx.RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				seen = middleware.GetReqID(r.Context())
			}))

			req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
			if tt.incoming != "" {
				req.Header[httpx.HeaderRequestID] = []string{tt.incoming}
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if got := rec.Header().Get(httpx.HeaderRequestID); got != seen {
				t.Errorf("response header %q != context id %q", got, seen)
			}
			if tt.wantSame {
				if seen != tt.incoming {
					t.Errorf("id = %q, want %q", seen, tt.incoming)
				}
				return
			}
			if !generatedID.MatchString(seen) {
				t.Errorf("id = %q, want 32 hex chars", seen)
			}
		})
	}
}

func TestRequestID_Unique(t *testing.T) {
	h := httpx.RequestID(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	seen := map[string]bool{}
	for range 1000 {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", http.NoBody))
		id := rec.Header().Get(httpx.HeaderRequestID)
		if seen[id] {
			t.Fatalf("duplicate request id %q", id)
		}
		seen[id] = true
	}
}
