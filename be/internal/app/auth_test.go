package app_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/app"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

const (
	adminEmail    = "admin@example.com"
	adminPassword = "correct horse battery staple"
	appOrigin     = "http://localhost:3000"
)

type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

// browser replays cookies like a user agent would (path scoping, deletion) and checks every
// response against the OpenAPI contract.
type browser struct {
	t       *testing.T
	handler http.Handler
	spec    routers.Router
	cookies map[string]*http.Cookie
	headers map[string]string
}

type authEnv struct {
	clock *clock
	h     http.Handler
	spec  routers.Router
}

func newAuthEnv(t *testing.T) *authEnv {
	t.Helper()
	t.Parallel()
	pool := dbtest.New(t)
	clk := &clock{now: time.Now().UTC().Truncate(time.Second)}

	accounts := auth.NewAccounts(pool, auth.NewPasswordHasher(fastArgon2, 1), clk.Now)
	if _, err := accounts.Create(t.Context(), adminEmail, adminPassword); err != nil {
		t.Fatalf("create admin: %v", err)
	}

	cfg := testConfig(t, map[string]string{
		"APP_PUBLIC_ORIGIN":        appOrigin,
		"AUTH_LOCKOUT_THRESHOLD":   "3",
		"RATE_LIMIT_ENABLED":       "false",
		"AUTH_REFRESH_REUSE_GRACE": "5s",
	})
	a, err := app.Build(t.Context(), cfg, discardLogger(), "1.0.0", pool, app.WithArgon2Params(fastArgon2), app.WithClock(clk.Now))
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(a.Close)

	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}
	spec.Servers = nil
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		t.Fatal(err)
	}
	return &authEnv{clock: clk, h: a.Handler(), spec: router}
}

func (e *authEnv) browser(t *testing.T) *browser {
	return &browser{
		t: t, handler: e.h, spec: e.spec,
		cookies: map[string]*http.Cookie{},
		headers: map[string]string{httpx.HeaderCSRF: "1", "Origin": appOrigin},
	}
}

func (b *browser) do(method, path, body string) *httptest.ResponseRecorder {
	b.t.Helper()
	var req *http.Request
	if body == "" {
		req = httptest.NewRequestWithContext(b.t.Context(), method, "http://localhost"+path, http.NoBody)
	} else {
		req = httptest.NewRequestWithContext(b.t.Context(), method, "http://localhost"+path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range b.headers {
		if v != "" {
			req.Header.Set(k, v)
		}
	}
	for _, c := range b.cookies {
		if strings.HasPrefix(path, c.Path) {
			req.AddCookie(&http.Cookie{Name: c.Name, Value: c.Value})
		}
	}
	rec := httptest.NewRecorder()
	b.handler.ServeHTTP(rec, req)

	for _, c := range rec.Result().Cookies() {
		if c.MaxAge < 0 {
			delete(b.cookies, c.Name)
		} else {
			b.cookies[c.Name] = c
		}
	}
	validate(b.t, b.spec, req, rec)
	return rec
}

func (b *browser) login(password string) *httptest.ResponseRecorder {
	b.t.Helper()
	return b.do(http.MethodPost, "/api/v1/auth/login", `{"email":"`+adminEmail+`","password":"`+password+`"}`)
}

func wantStatus(t *testing.T, rec *httptest.ResponseRecorder, want int) {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("status = %d, want %d; body = %s", rec.Code, want, rec.Body)
	}
}

func TestAuthHTTP_SessionLifecycle(t *testing.T) {
	env := newAuthEnv(t)
	b := env.browser(t)

	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusUnauthorized)

	rec := b.login(adminPassword)
	wantStatus(t, rec, http.StatusOK)
	var login api.LoginResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &login); err != nil || string(login.Admin.Email) != adminEmail {
		t.Fatalf("login body = %s (%v)", rec.Body, err)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Error("auth responses must not be cached")
	}
	access, refresh := b.cookies["dp_access"], b.cookies["dp_refresh"]
	if access == nil || refresh == nil {
		t.Fatalf("session cookies missing: %v", rec.Header().Values("Set-Cookie"))
	}
	for _, c := range []*http.Cookie{access, refresh} {
		if !c.HttpOnly || c.SameSite != http.SameSiteStrictMode || c.MaxAge <= 0 {
			t.Errorf("cookie %s attributes = %+v", c.Name, c)
		}
	}
	if access.Path != "/" || refresh.Path != auth.RefreshCookiePath {
		t.Errorf("cookie paths = %q, %q", access.Path, refresh.Path)
	}
	if strings.Contains(rec.Body.String(), access.Value) || strings.Contains(rec.Body.String(), refresh.Value) {
		t.Error("tokens must only travel in HttpOnly cookies")
	}

	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusOK)

	oldRefresh := b.cookies["dp_refresh"].Value
	env.clock.Advance(time.Minute)
	wantStatus(t, b.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusOK)
	if b.cookies["dp_refresh"].Value == oldRefresh {
		t.Fatal("refresh token not rotated")
	}
	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusOK)

	wantStatus(t, b.do(http.MethodPut, "/api/v1/auth/password",
		`{"currentPassword":"`+adminPassword+`","newPassword":"a much better passphrase"}`), http.StatusNoContent)
	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusOK)

	rec = b.do(http.MethodPost, "/api/v1/auth/logout", "")
	wantStatus(t, rec, http.StatusNoContent)
	if len(b.cookies) != 0 {
		t.Errorf("logout did not clear cookies: %v", b.cookies)
	}
	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusUnauthorized)
	wantStatus(t, b.do(http.MethodPost, "/api/v1/auth/logout", ""), http.StatusNoContent)
}

func TestAuthHTTP_ExpiredAccessTokenIs401(t *testing.T) {
	env := newAuthEnv(t)
	b := env.browser(t)
	wantStatus(t, b.login(adminPassword), http.StatusOK)

	env.clock.Advance(16 * time.Minute)
	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusUnauthorized)
	wantStatus(t, b.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusOK)
	wantStatus(t, b.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusOK)
}

func TestAuthHTTP_RefreshReuseRevokesAllSessions(t *testing.T) {
	env := newAuthEnv(t)
	victim, laptop := env.browser(t), env.browser(t)
	wantStatus(t, victim.login(adminPassword), http.StatusOK)
	wantStatus(t, laptop.login(adminPassword), http.StatusOK)

	thief := env.browser(t)
	thief.cookies["dp_refresh"] = &http.Cookie{Name: "dp_refresh", Value: victim.cookies["dp_refresh"].Value, Path: auth.RefreshCookiePath}

	wantStatus(t, victim.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusOK)
	// Within the grace window the duplicate looks like a concurrent tab: 409, nothing issued.
	wantStatus(t, thief.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusConflict)

	env.clock.Advance(6 * time.Second)
	wantStatus(t, thief.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusUnauthorized)

	for name, b := range map[string]*browser{"victim": victim, "other session": laptop} {
		if rec := b.do(http.MethodGet, "/api/v1/auth/me", ""); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s still authenticated after reuse: %d", name, rec.Code)
		}
	}
	wantStatus(t, victim.do(http.MethodPost, "/api/v1/auth/refresh", ""), http.StatusUnauthorized)
}

func TestAuthHTTP_LoginDoesNotRevealAccounts(t *testing.T) {
	env := newAuthEnv(t)
	b := env.browser(t)

	unknown := b.do(http.MethodPost, "/api/v1/auth/login", `{"email":"nobody@example.com","password":"whatever-password"}`)
	wrong := b.login("wrong password!!")
	wantStatus(t, unknown, http.StatusUnauthorized)
	wantStatus(t, wrong, http.StatusUnauthorized)
	if detail(t, unknown) != detail(t, wrong) {
		t.Fatalf("responses differ: %s vs %s", unknown.Body, wrong.Body)
	}

	// Lock the account, then the right password gets exactly the same answer.
	b.login("wrong password!!")
	b.login("wrong password!!")
	locked := b.login(adminPassword)
	wantStatus(t, locked, http.StatusUnauthorized)
	if detail(t, locked) != detail(t, wrong) {
		t.Fatalf("locked response differs: %s", locked.Body)
	}
	if len(b.cookies) != 0 {
		t.Error("no cookies may be set on a rejected login")
	}

	env.clock.Advance(2 * time.Minute)
	wantStatus(t, b.login(adminPassword), http.StatusOK)
}

func detail(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var p api.Problem
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil || p.Detail == nil {
		t.Fatalf("not a problem with detail: %s", rec.Body)
	}
	return *p.Detail
}

func TestAuthHTTP_CSRF(t *testing.T) {
	env := newAuthEnv(t)

	noHeader := env.browser(t)
	noHeader.headers[httpx.HeaderCSRF] = ""
	wantStatus(t, noHeader.login(adminPassword), http.StatusForbidden)

	evil := env.browser(t)
	evil.headers["Origin"] = "https://evil.example"
	wantStatus(t, evil.login(adminPassword), http.StatusForbidden)

	// Non-browser clients send no Origin; the custom header is still required.
	cli := env.browser(t)
	cli.headers["Origin"] = ""
	wantStatus(t, cli.login(adminPassword), http.StatusOK)

	// Safe methods are not CSRF-checked; SameSite=Strict keeps cookies off cross-site GETs.
	cli.headers[httpx.HeaderCSRF] = ""
	wantStatus(t, cli.do(http.MethodGet, "/api/v1/auth/me", ""), http.StatusOK)
	wantStatus(t, cli.do(http.MethodPost, "/api/v1/auth/logout", ""), http.StatusForbidden)
}

func TestAuthHTTP_RequestValidation(t *testing.T) {
	env := newAuthEnv(t)
	b := env.browser(t)
	for name, body := range map[string]string{
		"malformed":      `{"email":`,
		"not an email":   `{"email":"nope","password":"x"}`,
		"missing field":  `{"email":"a@example.com"}`,
		"unknown field":  `{"email":"a@example.com","password":"x","admin":true}`,
		"oversized pass": `{"email":"a@example.com","password":"` + strings.Repeat("x", 1025) + `"}`,
	} {
		if rec := b.do(http.MethodPost, "/api/v1/auth/login", body); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400; body = %s", name, rec.Code, rec.Body)
		}
	}
}

func TestAuthHTTP_ProductionUsesHostPrefixedSecureCookies(t *testing.T) {
	t.Parallel()
	pool := dbtest.New(t)
	if _, err := auth.NewAccounts(pool, auth.NewPasswordHasher(fastArgon2, 1), time.Now).Create(t.Context(), adminEmail, adminPassword); err != nil {
		t.Fatal(err)
	}
	cfg := testConfig(t, map[string]string{
		"APP_ENV":            "production",
		"APP_PUBLIC_ORIGIN":  "https://admin.example.com",
		"AUTH_COOKIE_SECURE": "true",
	})
	a, err := app.Build(t.Context(), cfg, discardLogger(), "1.0.0", pool, app.WithArgon2Params(fastArgon2))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(a.Close)

	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "https://api.example.com/api/v1/auth/login",
		strings.NewReader(`{"email":"`+adminEmail+`","password":"`+adminPassword+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(httpx.HeaderCSRF, "1")
	req.Header.Set("Origin", "https://admin.example.com")
	rec := httptest.NewRecorder()
	a.Handler().ServeHTTP(rec, req)
	wantStatus(t, rec, http.StatusOK)

	names := map[string]*http.Cookie{}
	for _, c := range rec.Result().Cookies() {
		names[c.Name] = c
	}
	access, refresh := names["__Host-dp_access"], names["__Secure-dp_refresh"]
	if access == nil || refresh == nil || !access.Secure || !refresh.Secure || access.Domain != "" {
		t.Fatalf("cookies = %v", rec.Header().Values("Set-Cookie"))
	}
}
