// Package auth implements admin authentication: password login, short-lived access tokens,
// rotating refresh tokens bound to server-side sessions, brute-force lockout and an audit trail.
package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/netip"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
)

// Client-facing errors. Messages are deliberately uniform: they never reveal whether an
// email exists, whether a password was close, or whether an account is locked.
var (
	errInvalidCredentials = apperr.Unauthorized("invalid email or password, or too many failed attempts; try again later")
	errUnauthenticated    = apperr.Unauthorized("authentication required")
	errSessionEnded       = apperr.Unauthorized("session expired or revoked; sign in again")
	errRefreshRace        = apperr.Conflict("refresh token was just rotated by a concurrent request; retry with the current session")
)

// Audit events, mirrored by the auth_audit_events CHECK constraint.
const (
	eventAdminCreated         = "admin_created"
	eventLoginSucceeded       = "login_succeeded"
	eventLoginFailed          = "login_failed"
	eventLoginLocked          = "login_locked"
	eventAccountLocked        = "account_locked"
	eventLogout               = "logout"
	eventRefreshReuse         = "refresh_reuse_detected"
	eventPasswordChanged      = "password_changed"
	eventPasswordChangeFailed = "password_change_failed"
	eventPasswordReset        = "password_reset"
)

// Session revoke reasons, mirrored by the auth_sessions CHECK constraint.
const (
	reasonLogout          = "logout"
	reasonPasswordChanged = "password_changed"
	reasonPasswordReset   = "password_reset"
	reasonRefreshReuse    = "refresh_reuse"
)

const maxUserAgent = 512

// ClientInfo describes the caller for sessions and the audit log.
type ClientInfo struct {
	IP        netip.Addr
	UserAgent string
}

// Admin is the public view of the admin account.
type Admin struct {
	ID                uuid.UUID
	Email             string
	LastLoginAt       *time.Time
	PasswordChangedAt time.Time
}

// Tokens is what a successful login, refresh or password change hands to the transport layer.
type Tokens struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string
	RefreshExpiresAt time.Time
}

type Policy struct {
	RefreshTTL        time.Duration
	SessionMaxAge     time.Duration
	RefreshReuseGrace time.Duration
	LockoutThreshold  int
	LockoutBase       time.Duration
	LockoutMax        time.Duration
}

func PolicyFrom(a config.Auth) Policy {
	return Policy{
		RefreshTTL:        a.RefreshTTL,
		SessionMaxAge:     a.SessionMaxAge,
		RefreshReuseGrace: a.RefreshReuseGrace,
		LockoutThreshold:  a.LockoutThreshold,
		LockoutBase:       a.LockoutBase,
		LockoutMax:        a.LockoutMax,
	}
}

type Service struct {
	pool      *pgxpool.Pool
	tx        database.Transactor
	hasher    *PasswordHasher
	tokens    *TokenIssuer
	policy    Policy
	now       func() time.Time
	log       *slog.Logger
	dummyHash string
}

// NewService computes a dummy hash once, so logins for unknown emails cost the same as
// real ones and response timing does not reveal which emails exist.
func NewService(ctx context.Context, pool *pgxpool.Pool, hasher *PasswordHasher, tokens *TokenIssuer, policy Policy, now func() time.Time, log *slog.Logger) (*Service, error) {
	dummy, err := hasher.Hash(ctx, uuid.NewString())
	if err != nil {
		return nil, fmt.Errorf("compute dummy hash: %w", err)
	}
	return &Service{
		pool: pool, tx: database.NewTxManager(pool), hasher: hasher, tokens: tokens,
		policy: policy, now: now, log: log, dummyHash: dummy,
	}, nil
}

func (s *Service) q(ctx context.Context) *store.Queries {
	return store.New(database.Executor(ctx, s.pool))
}

// Login verifies credentials and starts a session.
func (s *Service) Login(ctx context.Context, email, password string, c ClientInfo) (Admin, Tokens, error) {
	email = strings.TrimSpace(email)
	user, err := s.q(ctx).GetAdminByEmail(ctx, email)
	found := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Admin{}, Tokens{}, database.MapError(err)
	}

	hash := s.dummyHash
	if found {
		hash = user.PasswordHash
	}
	// Always hash, even for unknown or locked accounts, to keep timing uniform.
	ok, err := s.hasher.Verify(ctx, password, hash)
	if err != nil {
		return Admin{}, Tokens{}, apperr.Internal(fmt.Errorf("verify password: %w", err))
	}

	now := s.now()
	switch {
	case !found:
		s.auditBestEffort(ctx, eventLoginFailed, nil, &email, c)
		return Admin{}, Tokens{}, errInvalidCredentials
	case user.LockedUntil != nil && user.LockedUntil.After(now):
		s.auditBestEffort(ctx, eventLoginLocked, &user.ID, nil, c)
		return Admin{}, Tokens{}, errInvalidCredentials
	case !ok:
		s.recordFailure(ctx, user.ID, eventLoginFailed, c)
		return Admin{}, Tokens{}, errInvalidCredentials
	}

	var rehash string
	if s.hasher.NeedsRehash(user.PasswordHash) {
		if rehash, err = s.hasher.Hash(ctx, password); err != nil {
			return Admin{}, Tokens{}, apperr.Internal(err)
		}
	}

	var tokens Tokens
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		if err := q.RecordLoginSuccess(ctx, store.RecordLoginSuccessParams{ID: user.ID, Now: now}); err != nil {
			return err
		}
		if rehash != "" {
			if err := q.UpdatePasswordHash(ctx, store.UpdatePasswordHashParams{ID: user.ID, PasswordHash: rehash}); err != nil {
				return err
			}
		}
		var err error
		if tokens, err = s.startSession(ctx, q, user.ID, c, now); err != nil {
			return err
		}
		return s.audit(ctx, q, eventLoginSucceeded, &user.ID, nil, c, now)
	})
	if err != nil {
		return Admin{}, Tokens{}, database.MapError(err)
	}

	user.LastLoginAt = &now
	return toAdmin(user), tokens, nil
}

// recordFailure counts a wrong password and locks the account once the threshold is reached.
// The lock doubles with every further failure: base, 2×base, 4×base … capped at LockoutMax.
func (s *Service) recordFailure(ctx context.Context, userID uuid.UUID, event string, c ClientInfo) {
	now := s.now()
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		count, err := q.RecordLoginFailure(ctx, userID)
		if err != nil {
			return err
		}
		if err := s.audit(ctx, q, event, &userID, nil, c, now); err != nil {
			return err
		}
		if int(count) < s.policy.LockoutThreshold {
			return nil
		}
		until := now.Add(s.lockDuration(int(count)))
		if err := q.LockAdmin(ctx, store.LockAdminParams{ID: userID, LockedUntil: until}); err != nil {
			return err
		}
		s.log.WarnContext(ctx, "admin account locked", "user_id", userID, "failures", count, "until", until)
		return s.audit(ctx, q, eventAccountLocked, &userID, nil, c, now)
	})
	if err != nil {
		s.log.ErrorContext(ctx, "record login failure", "error", err, "user_id", userID)
	}
}

func (s *Service) lockDuration(failures int) time.Duration {
	exp := min(failures-s.policy.LockoutThreshold, 30)
	d := s.policy.LockoutBase << exp
	if d <= 0 || d > s.policy.LockoutMax {
		return s.policy.LockoutMax
	}
	return d
}

// Refresh rotates a refresh token. Each token is single-use: presenting a used token again
// (outside the short concurrency grace window) means it was copied, so every session of the
// account is revoked and both the thief and the victim must sign in again.
func (s *Service) Refresh(ctx context.Context, refreshToken string, c ClientInfo) (Tokens, error) {
	if refreshToken == "" {
		return Tokens{}, errSessionEnded
	}
	hash := hashRefreshToken(refreshToken)

	var (
		tokens     Tokens
		reuseOwner uuid.UUID
	)
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		now := s.now()
		row, err := q.GetRefreshTokenForUpdate(ctx, hash)
		if errors.Is(err, pgx.ErrNoRows) {
			return errSessionEnded
		}
		if err != nil {
			return err
		}

		if row.UsedAt != nil {
			if row.SessionRevokedAt == nil && now.Sub(*row.UsedAt) <= s.policy.RefreshReuseGrace {
				return errRefreshRace
			}
			if _, err := q.RevokeUserSessions(ctx, store.RevokeUserSessionsParams{UserID: row.UserID, Now: now, Reason: reasonRefreshReuse}); err != nil {
				return err
			}
			reuseOwner = row.UserID
			// Commit the revocation; the caller still gets 401 below.
			return s.audit(ctx, q, eventRefreshReuse, &row.UserID, nil, c, now)
		}

		if row.SessionRevokedAt != nil || !row.SessionExpiresAt.After(now) || !row.ExpiresAt.After(now) {
			return errSessionEnded
		}
		if err := q.MarkRefreshTokenUsed(ctx, store.MarkRefreshTokenUsedParams{ID: row.ID, Now: now}); err != nil {
			return err
		}
		if err := q.TouchSession(ctx, store.TouchSessionParams{ID: row.SessionID, Now: now}); err != nil {
			return err
		}
		tokens, err = s.issueTokens(ctx, q, row.UserID, row.SessionID, row.SessionExpiresAt, now)
		return err
	})
	if err != nil {
		return Tokens{}, database.MapError(err)
	}
	if reuseOwner != uuid.Nil {
		s.log.WarnContext(ctx, "refresh token reuse detected; all sessions revoked", "user_id", reuseOwner, "ip", c.IP.String())
		return Tokens{}, errSessionEnded
	}
	return tokens, nil
}

// Logout revokes the session identified by the refresh token or, failing that, by the
// access token. It succeeds when there is nothing to revoke, so it is safe to repeat.
func (s *Service) Logout(ctx context.Context, refreshToken, accessToken string, c ClientInfo) error {
	err := s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		var sessionID, userID uuid.UUID
		if refreshToken != "" {
			row, err := q.GetRefreshTokenForUpdate(ctx, hashRefreshToken(refreshToken))
			switch {
			case err == nil:
				sessionID, userID = row.SessionID, row.UserID
			case !errors.Is(err, pgx.ErrNoRows):
				return err
			}
		}
		if sessionID == uuid.Nil && accessToken != "" {
			if p, err := s.tokens.Parse(accessToken); err == nil {
				sessionID, userID = p.SessionID, p.UserID
			}
		}
		if sessionID == uuid.Nil {
			return nil
		}
		now := s.now()
		if err := q.RevokeSession(ctx, store.RevokeSessionParams{ID: sessionID, Now: now, Reason: reasonLogout}); err != nil {
			return err
		}
		return s.audit(ctx, q, eventLogout, &userID, nil, c, now)
	})
	return database.MapError(err)
}

// Authenticate validates an access token and confirms its session is still active.
func (s *Service) Authenticate(ctx context.Context, accessToken string) (Principal, error) {
	if accessToken == "" {
		return Principal{}, errUnauthenticated
	}
	p, err := s.tokens.Parse(accessToken)
	if err != nil {
		return Principal{}, errUnauthenticated.Wrap(err)
	}
	_, err = s.q(ctx).GetActiveSession(ctx, store.GetActiveSessionParams{ID: p.SessionID, UserID: p.UserID, Now: s.now()})
	if errors.Is(err, pgx.ErrNoRows) {
		return Principal{}, errSessionEnded
	}
	if err != nil {
		return Principal{}, database.MapError(err)
	}
	return p, nil
}

func (s *Service) Me(ctx context.Context, p Principal) (Admin, error) {
	user, err := s.q(ctx).GetAdminByID(ctx, p.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Admin{}, errSessionEnded
	}
	if err != nil {
		return Admin{}, database.MapError(err)
	}
	return toAdmin(user), nil
}

// ChangePassword replaces the password, revokes every session and starts a new one for the
// caller. A wrong current password counts towards the lockout like a failed login.
func (s *Service) ChangePassword(ctx context.Context, p Principal, current, next string, c ClientInfo) (Tokens, error) {
	user, err := s.q(ctx).GetAdminByID(ctx, p.UserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Tokens{}, errSessionEnded
	}
	if err != nil {
		return Tokens{}, database.MapError(err)
	}
	if msg := PasswordPolicyViolation(next, user.Email); msg != "" {
		return Tokens{}, apperr.Invalid("request validation failed", apperr.FieldError{Field: "newPassword", Message: msg})
	}

	ok, err := s.hasher.Verify(ctx, current, user.PasswordHash)
	if err != nil {
		return Tokens{}, apperr.Internal(err)
	}
	if !ok {
		s.recordFailure(ctx, user.ID, eventPasswordChangeFailed, c)
		return Tokens{}, apperr.Invalid("request validation failed", apperr.FieldError{Field: "currentPassword", Message: "is incorrect"})
	}
	if current == next {
		return Tokens{}, apperr.Invalid("request validation failed", apperr.FieldError{Field: "newPassword", Message: "must differ from the current password"})
	}

	newHash, err := s.hasher.Hash(ctx, next)
	if err != nil {
		return Tokens{}, apperr.Internal(err)
	}

	var tokens Tokens
	err = s.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := s.q(ctx)
		now := s.now()
		if err := q.SetPassword(ctx, store.SetPasswordParams{ID: user.ID, PasswordHash: newHash, Now: now}); err != nil {
			return err
		}
		if _, err := q.RevokeUserSessions(ctx, store.RevokeUserSessionsParams{UserID: user.ID, Now: now, Reason: reasonPasswordChanged}); err != nil {
			return err
		}
		var err error
		if tokens, err = s.startSession(ctx, q, user.ID, c, now); err != nil {
			return err
		}
		return s.audit(ctx, q, eventPasswordChanged, &user.ID, nil, c, now)
	})
	if err != nil {
		return Tokens{}, database.MapError(err)
	}
	return tokens, nil
}

// PurgeExpiredSessions deletes sessions that expired or were revoked more than retain ago.
// Refresh tokens cascade with them. Audit events are kept.
func (s *Service) PurgeExpiredSessions(ctx context.Context, retain time.Duration) (int64, error) {
	n, err := s.q(ctx).DeleteExpiredSessions(ctx, s.now().Add(-retain))
	return n, database.MapError(err)
}

func (s *Service) startSession(ctx context.Context, q *store.Queries, userID uuid.UUID, c ClientInfo, now time.Time) (Tokens, error) {
	sess, err := q.CreateSession(ctx, store.CreateSessionParams{
		UserID:    userID,
		Now:       now,
		ExpiresAt: now.Add(s.policy.SessionMaxAge),
		Ip:        ipPtr(c.IP),
		UserAgent: userAgentPtr(c.UserAgent),
	})
	if err != nil {
		return Tokens{}, err
	}
	return s.issueTokens(ctx, q, userID, sess.ID, sess.ExpiresAt, now)
}

func (s *Service) issueTokens(ctx context.Context, q *store.Queries, userID, sessionID uuid.UUID, sessionExpires, now time.Time) (Tokens, error) {
	refresh, hash, err := newRefreshToken()
	if err != nil {
		return Tokens{}, err
	}
	refreshExp := now.Add(s.policy.RefreshTTL)
	if sessionExpires.Before(refreshExp) {
		refreshExp = sessionExpires
	}
	if err := q.CreateRefreshToken(ctx, store.CreateRefreshTokenParams{SessionID: sessionID, TokenHash: hash, ExpiresAt: refreshExp, Now: now}); err != nil {
		return Tokens{}, err
	}
	access, accessExp, err := s.tokens.Issue(Principal{UserID: userID, SessionID: sessionID})
	if err != nil {
		return Tokens{}, err
	}
	return Tokens{AccessToken: access, AccessExpiresAt: accessExp, RefreshToken: refresh, RefreshExpiresAt: refreshExp}, nil
}

func (s *Service) audit(ctx context.Context, q *store.Queries, event string, userID *uuid.UUID, email *string, c ClientInfo, now time.Time) error {
	return q.InsertAuditEvent(ctx, store.InsertAuditEventParams{
		UserID: userID, Event: event, Email: email, Ip: ipPtr(c.IP), UserAgent: userAgentPtr(c.UserAgent), Now: now,
	})
}

// auditBestEffort records events on rejection paths, where an audit failure must not change
// the response the client gets.
func (s *Service) auditBestEffort(ctx context.Context, event string, userID *uuid.UUID, email *string, c ClientInfo) {
	if email != nil && len(*email) > 254 {
		email = ptr((*email)[:254])
	}
	if err := s.audit(ctx, s.q(ctx), event, userID, email, c, s.now()); err != nil {
		s.log.ErrorContext(ctx, "write auth audit event", "error", err, "event", event)
	}
}

func toAdmin(u store.AdminUser) Admin {
	return Admin{ID: u.ID, Email: u.Email, LastLoginAt: u.LastLoginAt, PasswordChangedAt: u.PasswordChangedAt}
}

func ptr[T any](v T) *T { return &v }

func ipPtr(ip netip.Addr) *netip.Addr {
	if !ip.IsValid() {
		return nil
	}
	return &ip
}

func userAgentPtr(ua string) *string {
	if ua == "" {
		return nil
	}
	ua = strings.ToValidUTF8(ua, "")
	for len(ua) > maxUserAgent {
		_, size := utf8.DecodeLastRuneInString(ua)
		ua = ua[:len(ua)-size]
	}
	return &ua
}
