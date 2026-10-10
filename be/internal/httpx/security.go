package httpx

import (
	"net/http"
	"strings"
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
			// API responses are private by default; handlers serving cacheable content override it.
			h.Set("Cache-Control", "no-store")
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
		AllowedHeaders:   []string{"Accept", "Content-Type", HeaderRequestID, HeaderCSRF},
		ExposedHeaders:   []string{HeaderRequestID, "Retry-After"},
		AllowCredentials: true,
		MaxAge:           int((10 * time.Minute).Seconds()),
	})
}

// BodyRule raises the body limit and I/O deadlines for one route, e.g. file uploads, which
// need more than the server-wide HTTP_READ_TIMEOUT on a slow mobile connection.
type BodyRule struct {
	MaxBytes int64
	Timeout  time.Duration
}

// matchRule finds the rule for "METHOD /path"; a "{name}" segment in a rule's path matches
// any one non-empty segment.
func matchRule(rules map[string]BodyRule, method, path string) (BodyRule, bool) {
	if rule, ok := rules[method+" "+path]; ok {
		return rule, true
	}
	segs := strings.Split(path, "/")
	for key, rule := range rules {
		m, pattern, _ := strings.Cut(key, " ")
		if m != method || !strings.Contains(pattern, "{") {
			continue
		}
		want := strings.Split(pattern, "/")
		if len(want) != len(segs) {
			continue
		}
		ok := true
		for i, w := range want {
			isParam := strings.HasPrefix(w, "{") && strings.HasSuffix(w, "}")
			if (isParam && segs[i] == "") || (!isParam && w != segs[i]) {
				ok = false
				break
			}
		}
		if ok {
			return rule, true
		}
	}
	return BodyRule{}, false
}

// BodyLimit caps request bodies. Reads beyond limit fail with *http.MaxBytesError, which
// ErrorWriter renders as 413. Declared oversize bodies are rejected before any handler runs.
// rules, keyed by "METHOD /path" (see matchRule), override the default for specific routes.
func BodyLimit(def int64, rules map[string]BodyRule) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := def
			if rule, ok := matchRule(rules, r.Method, r.URL.Path); ok {
				limit = rule.MaxBytes
				if rule.Timeout > 0 {
					rc := http.NewResponseController(w)
					deadline := time.Now().Add(rule.Timeout)
					// Unsupported only by test recorders; the server-wide timeouts then apply.
					_ = rc.SetReadDeadline(deadline)
					_ = rc.SetWriteDeadline(deadline)
				}
			}
			if r.ContentLength > limit {
				Error(w, r, http.StatusRequestEntityTooLarge, "request body too large")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, limit)
			next.ServeHTTP(w, r)
		})
	}
}
