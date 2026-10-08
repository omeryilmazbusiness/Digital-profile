package httpx

import (
	"net/http"
	"strings"
)

// HeaderCSRF must accompany state-changing requests to cookie-authenticated routes.
// A custom header cannot be set by cross-site forms, and cross-origin scripts can only set it
// after a CORS preflight that the API refuses for unknown origins.
const HeaderCSRF = "X-CSRF-Protection"

// CSRF protects cookie-authenticated routes against cross-site request forgery, on top of
// SameSite=Strict cookies:
//
//   - unsafe methods under the given prefixes must send HeaderCSRF: 1;
//   - when the browser sends Origin, it must be one of allowedOrigins.
//
// Requests without Origin (non-browser clients) pass on the header check alone; they cannot
// be forged by a third-party page because browsers always send Origin on cross-origin writes.
func CSRF(allowedOrigins, prefixes []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isSafeMethod(r.Method) || !hasAnyPrefix(r.URL.Path, prefixes) {
				next.ServeHTTP(w, r)
				return
			}
			if r.Header.Get(HeaderCSRF) != "1" {
				Error(w, r, http.StatusForbidden, "missing "+HeaderCSRF+" header")
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" && !allowed[origin] {
				Error(w, r, http.StatusForbidden, "cross-origin request rejected")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isSafeMethod(m string) bool {
	return m == http.MethodGet || m == http.MethodHead || m == http.MethodOptions
}

func hasAnyPrefix(path string, prefixes []string) bool {
	for _, p := range prefixes {
		if path == strings.TrimSuffix(p, "/") || strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
