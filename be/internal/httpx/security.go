package httpx

import (
	"net/http"
	"time"

	"github.com/go-chi/cors"
)

// SecurityHeaders sets defensive headers suited to a JSON API that is never framed or rendered.
// HSTS is only sent when hsts is true (production behind TLS); sending it from plain-HTTP
// development hosts would pin browsers to HTTPS for localhost.
func SecurityHeaders(hsts bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			h := w.Header()
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("X-Frame-Options", "DENY")
			h.Set("Referrer-Policy", "no-referrer")
			h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
			h.Set("Cross-Origin-Opener-Policy", "same-origin")
			h.Set("Cross-Origin-Resource-Policy", "same-origin")
			if hsts {
				h.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}

// CORS allows credentialed requests from the configured origins only. With no origins
// configured it is a no-op: the production topology is same-origin behind the reverse proxy.
func CORS(origins []string) func(http.Handler) http.Handler {
	if len(origins) == 0 {
		return func(next http.Handler) http.Handler { return next }
	}
	return cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", HeaderRequestID},
		ExposedHeaders:   []string{HeaderRequestID, "Retry-After"},
		AllowCredentials: true,
		MaxAge:           int((10 * time.Minute).Seconds()),
	})
}

// BodyLimit caps request bodies. Reads beyond limit fail with *http.MaxBytesError, which
// ErrorWriter renders as 413. Declared oversize bodies are rejected before any handler runs.
func BodyLimit(limit int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.ContentLength > limit {
				Error(w, r, http.StatusRequestEntityTooLarge, "request body too large")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}
