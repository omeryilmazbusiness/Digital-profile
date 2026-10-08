package httpx_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

// decodeProblemNoID is decodeProblem for handlers tested outside the router,
// where no RequestID middleware has run.
func decodeProblemNoID(t *testing.T, res *http.Response) api.Problem {
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
	return p
}
