package auth

import (
	"log/slog"
	"net/netip"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

const (
	adminEmail    = "admin@example.com"
	adminPassword = "correct horse battery staple"
)

var (
	fastParams = Argon2Params{MemoryKiB: 8 * 1024, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}
	client     = ClientInfo{IP: netip.MustParseAddr("203.0.113.7"), UserAgent: "test-agent"}
	testPolicy = Policy{
		RefreshTTL:        time.Hour,
		SessionMaxAge:     3 * time.Hour,
		RefreshReuseGrace: 10 * time.Second,
		LockoutThreshold:  3,
		LockoutBase:       time.Minute,
		LockoutMax:        4 * time.Minute,
	}
)

type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

type fixture struct {
	t        *testing.T
	pool     *pgxpool.Pool
	clock    *fakeClock
	svc      *Service
	accounts *Accounts
	admin    Admin
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	t.Parallel()
	pool := dbtest.New(t)
	// Postgres stores microseconds; a truncated clock keeps round-tripped times comparable.
	clock := &fakeClock{now: time.Now().UTC().Truncate(time.Microsecond)}
	f := &fixture{t: t, pool: pool, clock: clock}
	f.svc = f.newService(fastParams)
	f.accounts = NewAccounts(pool, NewPasswordHasher(fastParams, 2), clock.Now)
	admin, err := f.accounts.Create(t.Context(), " Admin@Example.com ", adminPassword)
	if err != nil {
		t.Fatalf("create admin: %v", err)
	}
	f.admin = admin
	return f
}

func (f *fixture) newService(p Argon2Params) *Service {
	f.t.Helper()
	tokens, err := NewTokenIssuer([]config.SigningKey{keyA}, "iss", "aud", 15*time.Minute, f.clock.Now)
	if err != nil {
		f.t.Fatal(err)
	}
	svc, err := NewService(f.t.Context(), f.pool, NewPasswordHasher(p, 2), tokens, testPolicy, f.clock.Now, slog.New(slog.DiscardHandler))
	if err != nil {
		f.t.Fatal(err)
	}
	return svc
}

func (f *fixture) login() Tokens {
	f.t.Helper()
	_, tokens, err := f.svc.Login(f.t.Context(), adminEmail, adminPassword, client)
	if err != nil {
		f.t.Fatalf("login: %v", err)
	}
	return tokens
}

func (f *fixture) user() store.AdminUser {
	f.t.Helper()
	u, err := store.New(f.pool).GetAdminByID(f.t.Context(), f.admin.ID)
	if err != nil {
		f.t.Fatal(err)
	}
	return u
}

func (f *fixture) auditCount(event string) int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(f.t.Context(), "SELECT count(*) FROM auth_audit_events WHERE event = $1", event).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

func (f *fixture) activeSessions() int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(f.t.Context(), "SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL").Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}

func (f *fixture) authenticates(access string) bool {
	f.t.Helper()
	_, err := f.svc.Authenticate(f.t.Context(), access)
	if err != nil && apperr.KindOf(err) != apperr.KindUnauthorized {
		f.t.Fatalf("authenticate: unexpected error kind: %v", err)
	}
	return err == nil
}

func wantKind(t *testing.T, err error, kind apperr.Kind) {
	t.Helper()
	if apperr.KindOf(err) != kind {
		t.Fatalf("err = %v (kind %s), want kind %s", err, apperr.KindOf(err), kind)
	}
}

func TestLogin_Success(t *testing.T) {
	f := newFixture(t)
	if f.admin.Email != adminEmail {
		t.Fatalf("email stored as %q, want normalised %q", f.admin.Email, adminEmail)
	}

	admin, tokens, err := f.svc.Login(t.Context(), "  ADMIN@example.COM", adminPassword, client)
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if admin.ID != f.admin.ID || admin.LastLoginAt == nil || !admin.LastLoginAt.Equal(f.clock.Now()) {
		t.Errorf("admin = %+v", admin)
	}
	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Fatal("tokens missing")
	}
	if !tokens.RefreshExpiresAt.Equal(f.clock.Now().Add(testPolicy.RefreshTTL)) {
		t.Errorf("refresh expiry = %v", tokens.RefreshExpiresAt)
	}
	p, err := f.svc.Authenticate(t.Context(), tokens.AccessToken)
	if err != nil || p.UserID != f.admin.ID {
		t.Fatalf("authenticate = %+v, %v", p, err)
	}
	if me, err := f.svc.Me(t.Context(), p); err != nil || me.Email != adminEmail {
		t.Errorf("me = %+v, %v", me, err)
	}
	if f.auditCount(eventLoginSucceeded) != 1 || f.auditCount(eventAdminCreated) != 1 {
		t.Error("audit events missing")
	}

	var ip netip.Addr
	var ua string
	if err := f.pool.QueryRow(t.Context(), "SELECT ip, user_agent FROM auth_sessions").Scan(&ip, &ua); err != nil {
		t.Fatal(err)
	}
	if ip != client.IP || ua != client.UserAgent {
		t.Errorf("session client = %v %q", ip, ua)
	}
}

func TestLogin_DoesNotRevealWhetherEmailExists(t *testing.T) {
	f := newFixture(t)

	_, _, unknown := f.svc.Login(t.Context(), "nobody@example.com", adminPassword, client)
	_, _, wrong := f.svc.Login(t.Context(), adminEmail, "wrong password!!", client)
	wantKind(t, unknown, apperr.KindUnauthorized)
	if unknown.Error() != wrong.Error() {
		t.Fatalf("messages differ: %q vs %q", unknown, wrong)
	}
	if f.auditCount(eventLoginFailed) != 2 {
		t.Error("both failures must be audited")
	}
	var email string
	if err := f.pool.QueryRow(t.Context(), "SELECT email FROM auth_audit_events WHERE event = 'login_failed' AND user_id IS NULL").Scan(&email); err != nil || email != "nobody@example.com" {
		t.Errorf("unknown-email audit = %q, %v", email, err)
	}
}

func TestLogin_LockoutGrowsExponentiallyAndIsCapped(t *testing.T) {
	f := newFixture(t)
	var ref error
	fail := func() {
		_, _, err := f.svc.Login(t.Context(), adminEmail, "wrong password!!", client)
		wantKind(t, err, apperr.KindUnauthorized)
		ref = err
	}
	lockedFor := func() time.Duration {
		u := f.user()
		if u.LockedUntil == nil {
			return 0
		}
		return u.LockedUntil.Sub(f.clock.Now())
	}

	fail()
	fail()
	if lockedFor() != 0 {
		t.Fatal("locked before reaching the threshold")
	}
	fail()
	if got := lockedFor(); got != time.Minute {
		t.Fatalf("first lock = %v, want 1m", got)
	}

	// The correct password is refused while locked, with the same message.
	_, _, err := f.svc.Login(t.Context(), adminEmail, adminPassword, client)
	if err == nil || err.Error() != ref.Error() {
		t.Fatalf("locked login err = %v, want uniform rejection", err)
	}
	if f.auditCount(eventLoginLocked) != 1 {
		t.Error("locked attempt not audited")
	}

	for _, want := range []time.Duration{2 * time.Minute, 4 * time.Minute, 4 * time.Minute} {
		f.clock.Advance(lockedFor() + time.Second)
		fail()
		if got := lockedFor(); got != want {
			t.Fatalf("lock = %v, want %v", got, want)
		}
	}
	if f.auditCount(eventAccountLocked) != 4 {
		t.Errorf("account_locked events = %d, want 4", f.auditCount(eventAccountLocked))
	}

	f.clock.Advance(lockedFor() + time.Second)
	f.login()
	if u := f.user(); u.FailedLoginCount != 0 || u.LockedUntil != nil {
		t.Errorf("successful login did not reset lockout: %+v", u)
	}
}

func TestLogin_RehashesOutdatedHash(t *testing.T) {
	f := newFixture(t)
	stronger := fastParams
	stronger.Iterations = 2
	f.svc = f.newService(stronger)

	f.login()
	if f.svc.hasher.NeedsRehash(f.user().PasswordHash) {
		t.Fatal("hash was not upgraded on login")
	}
	f.login()
}

func TestRefresh_RotatesTokens(t *testing.T) {
	f := newFixture(t)
	first := f.login()

	f.clock.Advance(time.Minute)
	second, err := f.svc.Refresh(t.Context(), first.RefreshToken, client)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if second.RefreshToken == first.RefreshToken || second.AccessToken == first.AccessToken {
		t.Fatal("refresh did not rotate tokens")
	}
	if !f.authenticates(second.AccessToken) {
		t.Fatal("new access token rejected")
	}
	if _, err := f.svc.Refresh(t.Context(), second.RefreshToken, client); err != nil {
		t.Fatalf("rotated refresh token rejected: %v", err)
	}
}

func TestRefresh_ConcurrentUseWithinGraceIsConflict(t *testing.T) {
	f := newFixture(t)
	first := f.login()
	if _, err := f.svc.Refresh(t.Context(), first.RefreshToken, client); err != nil {
		t.Fatal(err)
	}

	f.clock.Advance(testPolicy.RefreshReuseGrace / 2)
	_, err := f.svc.Refresh(t.Context(), first.RefreshToken, client)
	wantKind(t, err, apperr.KindConflict)
	if f.activeSessions() != 1 {
		t.Fatal("a benign race must not revoke the session")
	}
}

func TestRefresh_ReuseRevokesEverySession(t *testing.T) {
	f := newFixture(t)
	stolen := f.login()
	other := f.login()

	rotated, err := f.svc.Refresh(t.Context(), stolen.RefreshToken, client)
	if err != nil {
		t.Fatal(err)
	}
	f.clock.Advance(testPolicy.RefreshReuseGrace + time.Second)

	_, err = f.svc.Refresh(t.Context(), stolen.RefreshToken, client)
	wantKind(t, err, apperr.KindUnauthorized)

	if f.activeSessions() != 0 {
		t.Fatal("reuse must revoke every session of the account")
	}
	for name, access := range map[string]string{"rotated": rotated.AccessToken, "other": other.AccessToken} {
		if f.authenticates(access) {
			t.Errorf("%s access token still accepted after reuse", name)
		}
	}
	if _, err := f.svc.Refresh(t.Context(), rotated.RefreshToken, client); err == nil {
		t.Error("rotated refresh token still accepted after reuse")
	}
	if f.auditCount(eventRefreshReuse) != 1 {
		t.Error("reuse not audited")
	}
}

func TestRefresh_RejectsUnknownAndExpired(t *testing.T) {
	f := newFixture(t)
	for _, token := range []string{"", "not-a-token"} {
		_, err := f.svc.Refresh(t.Context(), token, client)
		wantKind(t, err, apperr.KindUnauthorized)
	}

	tokens := f.login()
	f.clock.Advance(testPolicy.RefreshTTL + time.Second)
	_, err := f.svc.Refresh(t.Context(), tokens.RefreshToken, client)
	wantKind(t, err, apperr.KindUnauthorized)
}

func TestRefresh_CannotOutliveSessionMaxAge(t *testing.T) {
	f := newFixture(t)
	start := f.clock.Now()
	tokens := f.login()

	for range 3 {
		f.clock.Advance(testPolicy.RefreshTTL - time.Minute)
		var err error
		if tokens, err = f.svc.Refresh(t.Context(), tokens.RefreshToken, client); err != nil {
			t.Fatal(err)
		}
	}
	if want := start.Add(testPolicy.SessionMaxAge); !tokens.RefreshExpiresAt.Equal(want) {
		t.Fatalf("refresh expiry = %v, want capped at session end %v", tokens.RefreshExpiresAt, want)
	}
	f.clock.Advance(tokens.RefreshExpiresAt.Sub(f.clock.Now()) + time.Second)
	_, err := f.svc.Refresh(t.Context(), tokens.RefreshToken, client)
	wantKind(t, err, apperr.KindUnauthorized)
}

func TestLogout(t *testing.T) {
	f := newFixture(t)
	a := f.login()
	b := f.login()

	if err := f.svc.Logout(t.Context(), a.RefreshToken, "", client); err != nil {
		t.Fatal(err)
	}
	if f.authenticates(a.AccessToken) {
		t.Error("access token survives logout")
	}
	if _, err := f.svc.Refresh(t.Context(), a.RefreshToken, client); err == nil {
		t.Error("refresh token survives logout")
	}
	if !f.authenticates(b.AccessToken) {
		t.Error("logout must only end the current session")
	}

	// Without a refresh cookie the access token identifies the session.
	if err := f.svc.Logout(t.Context(), "", b.AccessToken, client); err != nil {
		t.Fatal(err)
	}
	if f.authenticates(b.AccessToken) {
		t.Error("access-token logout did not revoke the session")
	}

	if err := f.svc.Logout(t.Context(), "", "", client); err != nil {
		t.Errorf("logout without credentials = %v, want idempotent success", err)
	}
	if f.auditCount(eventLogout) != 2 {
		t.Errorf("logout events = %d, want 2", f.auditCount(eventLogout))
	}
}

func TestAuthenticate_RejectsBadTokens(t *testing.T) {
	f := newFixture(t)
	tokens := f.login()
	for _, token := range []string{"", "garbage", tokens.AccessToken + "x"} {
		if f.authenticates(token) {
			t.Errorf("token %q accepted", token)
		}
	}
	f.clock.Advance(16 * time.Minute)
	if f.authenticates(tokens.AccessToken) {
		t.Error("expired access token accepted")
	}
}

func TestChangePassword(t *testing.T) {
	f := newFixture(t)
	current := f.login()
	other := f.login()
	p, err := f.svc.Authenticate(t.Context(), current.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	const newPassword = "a much better passphrase"

	cases := map[string]struct{ current, next, field string }{
		"wrong current": {"wrong password!!", newPassword, "currentPassword"},
		"too short":     {adminPassword, "short", "newPassword"},
		"same":          {adminPassword, adminPassword, "newPassword"},
		"is the email":  {adminPassword, adminEmail, "newPassword"},
	}
	for name, c := range cases {
		_, err := f.svc.ChangePassword(t.Context(), p, c.current, c.next, client)
		ae, ok := apperr.As(err)
		if !ok || ae.Kind != apperr.KindInvalid || len(ae.Fields) != 1 || ae.Fields[0].Field != c.field {
			t.Errorf("%s: err = %#v", name, err)
		}
	}
	if f.user().FailedLoginCount != 1 || f.auditCount(eventPasswordChangeFailed) != 1 {
		t.Error("a wrong current password must count towards the lockout")
	}

	tokens, err := f.svc.ChangePassword(t.Context(), p, adminPassword, newPassword, client)
	if err != nil {
		t.Fatalf("change password: %v", err)
	}
	if f.authenticates(current.AccessToken) || f.authenticates(other.AccessToken) {
		t.Error("old sessions survive a password change")
	}
	if !f.authenticates(tokens.AccessToken) {
		t.Error("caller did not get a fresh session")
	}
	if _, _, err := f.svc.Login(t.Context(), adminEmail, adminPassword, client); err == nil {
		t.Error("old password still works")
	}
	if _, _, err := f.svc.Login(t.Context(), adminEmail, newPassword, client); err != nil {
		t.Errorf("new password rejected: %v", err)
	}
	if !f.user().PasswordChangedAt.Equal(f.clock.Now()) {
		t.Error("password_changed_at not updated")
	}
}

func TestAccounts(t *testing.T) {
	f := newFixture(t)
	ctx := t.Context()

	_, err := f.accounts.Create(ctx, "second@example.com", adminPassword)
	wantKind(t, err, apperr.KindConflict)

	for name, c := range map[string]struct{ email, pw string }{
		"bad email":    {"not-an-email", adminPassword},
		"display name": {"Admin <a@example.com>", adminPassword},
		"weak":         {"x@example.com", "aaaaaaaaaaaaaaaa"},
	} {
		if _, err := f.accounts.Create(ctx, c.email, c.pw); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: err = %v, want invalid", name, err)
		}
	}

	tokens := f.login()
	for range testPolicy.LockoutThreshold {
		_, _, _ = f.svc.Login(ctx, adminEmail, "wrong password!!", client)
	}
	if f.user().LockedUntil == nil {
		t.Fatal("precondition: account should be locked")
	}

	const reset = "reset by the operator 42"
	if err := f.accounts.ResetPassword(ctx, "ADMIN@example.com", reset); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if f.authenticates(tokens.AccessToken) {
		t.Error("reset must sign out every session")
	}
	if _, _, err := f.svc.Login(ctx, adminEmail, reset, client); err != nil {
		t.Errorf("login after reset (should also unlock): %v", err)
	}
	wantKind(t, f.accounts.ResetPassword(ctx, "nobody@example.com", reset), apperr.KindNotFound)
	wantKind(t, f.accounts.ResetPassword(ctx, adminEmail, "short"), apperr.KindInvalid)
	if f.auditCount(eventPasswordReset) != 1 {
		t.Error("reset not audited")
	}
}

func TestPurgeExpiredSessions(t *testing.T) {
	f := newFixture(t)
	f.login()
	revoked := f.login()
	if err := f.svc.Logout(t.Context(), revoked.RefreshToken, "", client); err != nil {
		t.Fatal(err)
	}

	f.clock.Advance(2 * time.Hour)
	if n, err := f.svc.PurgeExpiredSessions(t.Context(), time.Hour); err != nil || n != 1 {
		t.Fatalf("purge = %d, %v; want only the revoked session", n, err)
	}
	f.clock.Advance(testPolicy.SessionMaxAge)
	if n, err := f.svc.PurgeExpiredSessions(t.Context(), time.Hour); err != nil || n != 1 {
		t.Fatalf("purge = %d, %v; want the expired session", n, err)
	}
	var tokens int
	_ = f.pool.QueryRow(t.Context(), "SELECT count(*) FROM refresh_tokens").Scan(&tokens)
	if tokens != 0 {
		t.Errorf("refresh tokens not cascaded: %d left", tokens)
	}
}

func TestUserAgentPtr(t *testing.T) {
	if userAgentPtr("") != nil {
		t.Error("empty user agent should be NULL")
	}
	long := strings.Repeat("ü", 400) // 800 bytes
	got := *userAgentPtr(long)
	if len(got) > maxUserAgent || !strings.HasPrefix(long, got) {
		t.Errorf("truncated to %d bytes, valid prefix = %t", len(got), strings.HasPrefix(long, got))
	}
	if *userAgentPtr("bad\xffbyte") != "badbyte" {
		t.Error("invalid UTF-8 not stripped")
	}
}
