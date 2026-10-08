package auth

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth/store"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
)

const (
	MinPasswordLen = 12
	MaxPasswordLen = 128
)

// PasswordPolicyViolation returns a field message when password is unacceptable, or "".
// Length is the policy that matters (NIST SP 800-63B); composition rules are not imposed.
func PasswordPolicyViolation(password, email string) string {
	n := utf8.RuneCountInString(password)
	switch {
	case n < MinPasswordLen:
		return fmt.Sprintf("must be at least %d characters", MinPasswordLen)
	case n > MaxPasswordLen:
		return fmt.Sprintf("must be at most %d characters", MaxPasswordLen)
	case strings.TrimSpace(password) == "":
		return "must not be blank"
	case strings.EqualFold(strings.TrimSpace(password), strings.TrimSpace(email)):
		return "must not be the email address"
	case strings.Count(password, string(firstRune(password))) == n:
		return "must not repeat a single character"
	}
	return ""
}

func firstRune(s string) rune {
	r, _ := utf8.DecodeRuneInString(s)
	return r
}

// NormalizeEmail validates a bare address (no display name) and lower-cases it.
func NormalizeEmail(email string) (string, error) {
	email = strings.TrimSpace(email)
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email || len(email) > 254 {
		return "", apperr.Invalid("request validation failed", apperr.FieldError{Field: "email", Message: "must be a valid email address"})
	}
	return strings.ToLower(email), nil
}

// Accounts manages the admin account outside the HTTP flow (CLI). There is no public
// sign-up: the single admin is created and recovered by an operator with database access.
type Accounts struct {
	pool   *pgxpool.Pool
	tx     database.Transactor
	hasher *PasswordHasher
	now    func() time.Time
}

func NewAccounts(pool *pgxpool.Pool, hasher *PasswordHasher, now func() time.Time) *Accounts {
	return &Accounts{pool: pool, tx: database.NewTxManager(pool), hasher: hasher, now: now}
}

var ErrAdminExists = apperr.Conflict("an admin account already exists; use reset-password instead")

func (a *Accounts) Create(ctx context.Context, email, password string) (Admin, error) {
	email, err := NormalizeEmail(email)
	if err != nil {
		return Admin{}, err
	}
	if msg := PasswordPolicyViolation(password, email); msg != "" {
		return Admin{}, apperr.Invalid("request validation failed", apperr.FieldError{Field: "password", Message: msg})
	}
	hash, err := a.hasher.Hash(ctx, password)
	if err != nil {
		return Admin{}, err
	}

	var user store.AdminUser
	err = a.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := store.New(database.Executor(ctx, a.pool))
		now := a.now()
		var err error
		user, err = q.CreateAdmin(ctx, store.CreateAdminParams{Email: email, PasswordHash: hash, Now: now})
		if err != nil {
			return err
		}
		return q.InsertAuditEvent(ctx, store.InsertAuditEventParams{UserID: &user.ID, Event: eventAdminCreated, Now: now})
	})
	if apperr.KindOf(database.MapError(err)) == apperr.KindConflict {
		// The singleton index rejects a second admin even with a different email.
		return Admin{}, ErrAdminExists.Wrap(err)
	}
	if err != nil {
		return Admin{}, database.MapError(err)
	}
	return toAdmin(user), nil
}

// ResetPassword sets a new password, clears any lockout and signs out every session.
func (a *Accounts) ResetPassword(ctx context.Context, email, password string) error {
	email = strings.TrimSpace(email)
	q := store.New(a.pool)
	user, err := q.GetAdminByEmail(ctx, email)
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.NotFound("no admin with that email")
	}
	if err != nil {
		return database.MapError(err)
	}
	if msg := PasswordPolicyViolation(password, user.Email); msg != "" {
		return apperr.Invalid("request validation failed", apperr.FieldError{Field: "password", Message: msg})
	}
	hash, err := a.hasher.Hash(ctx, password)
	if err != nil {
		return err
	}
	return database.MapError(a.tx.WithinTx(ctx, func(ctx context.Context) error {
		q := store.New(database.Executor(ctx, a.pool))
		now := a.now()
		if err := q.SetPassword(ctx, store.SetPasswordParams{ID: user.ID, PasswordHash: hash, Now: now}); err != nil {
			return err
		}
		if _, err := q.RevokeUserSessions(ctx, store.RevokeUserSessionsParams{UserID: user.ID, Now: now, Reason: reasonPasswordReset}); err != nil {
			return err
		}
		return q.InsertAuditEvent(ctx, store.InsertAuditEventParams{UserID: &user.ID, Event: eventPasswordReset, Now: now})
	}))
}
