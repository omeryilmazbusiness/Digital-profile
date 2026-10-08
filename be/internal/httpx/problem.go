// Package httpx holds transport-level HTTP concerns shared by every module:
// RFC 9457 error responses, middleware and router assembly.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

const ContentTypeProblem = "application/problem+json"

// NewProblem builds a Problem for the given status. An empty detail is omitted.
func NewProblem(r *http.Request, status int, detail string) api.Problem {
	p := api.Problem{
		Type:   "about:blank",
		Title:  http.StatusText(status),
		Status: int32(status), //nolint:gosec // HTTP status codes always fit in int32.
	}
	if detail != "" {
		p.Detail = &detail
	}
	if r != nil {
		instance := r.URL.Path
		p.Instance = &instance
		if id := middleware.GetReqID(r.Context()); id != "" {
			p.RequestId = &id
		}
	}
	return p
}

// WriteProblem writes p as application/problem+json.
func WriteProblem(w http.ResponseWriter, p api.Problem) {
	w.Header().Set("Content-Type", ContentTypeProblem)
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(int(p.Status))
	if err := json.NewEncoder(w).Encode(p); err != nil {
		slog.Error("write problem response", "error", err)
	}
}

// Error writes a problem response for the given status.
func Error(w http.ResponseWriter, r *http.Request, status int, detail string) {
	WriteProblem(w, NewProblem(r, status, detail))
}
