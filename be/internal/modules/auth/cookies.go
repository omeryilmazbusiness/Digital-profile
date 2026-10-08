package auth

import (
	"net/http"
	"time"
)

// RefreshCookiePath limits the refresh token to the auth endpoints, so it is never sent with
// ordinary API or page requests.
const RefreshCookiePath = "/api/v1/auth"

// Cookies builds the session cookies. Over HTTPS the names carry the __Host- / __Secure-
// prefixes, which make browsers refuse cookies that are not Secure or (for __Host-) that set a
// Domain or a Path other than "/" — so a compromised sibling subdomain cannot plant them.
type Cookies struct {
	Secure bool
}

func (c Cookies) AccessName() string {
	if c.Secure {
		return "__Host-dp_access"
	}
	return "dp_access"
}

func (c Cookies) RefreshName() string {
	if c.Secure {
		return "__Secure-dp_refresh"
	}
	return "dp_refresh"
}

func (c Cookies) session(t Tokens, now time.Time) []*http.Cookie {
	return []*http.Cookie{
		c.cookie(c.AccessName(), "/", t.AccessToken, t.AccessExpiresAt.Sub(now)),
		c.cookie(c.RefreshName(), RefreshCookiePath, t.RefreshToken, t.RefreshExpiresAt.Sub(now)),
	}
}

func (c Cookies) cleared() []*http.Cookie {
	return []*http.Cookie{
		c.cookie(c.AccessName(), "/", "", -1),
		c.cookie(c.RefreshName(), RefreshCookiePath, "", -1),
	}
}

func (c Cookies) cookie(name, path, value string, ttl time.Duration) *http.Cookie {
	maxAge := int(ttl.Seconds())
	switch {
	case ttl < 0:
		maxAge = -1
	case maxAge == 0:
		// Max-Age=0 would turn it into a browser-session cookie; expire it almost immediately instead.
		maxAge = 1
	}
	// Secure is configuration-driven: plain-HTTP local development cannot use Secure cookies,
	// and config validation refuses AUTH_COOKIE_SECURE=false in production.
	return &http.Cookie{ //nolint:gosec // see above
		Name:     name,
		Value:    value,
		Path:     path,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   c.Secure,
		SameSite: http.SameSiteStrictMode,
	}
}

func (c Cookies) read(r *http.Request) (access, refresh string) {
	if ck, err := r.Cookie(c.AccessName()); err == nil {
		access = ck.Value
	}
	if ck, err := r.Cookie(c.RefreshName()); err == nil {
		refresh = ck.Value
	}
	return access, refresh
}
