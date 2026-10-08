package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

// MinJWTKeyBytes is the HS256 minimum: the key must be at least as long as the hash output.
const MinJWTKeyBytes = 32

type Auth struct {
	// JWTKeys is a key ring of "kid:base64secret" entries. The first key signs new tokens;
	// the rest only verify, which allows rotation without logging everyone out.
	JWTKeys     []string `env:"JWT_KEYS,required,notEmpty" envSeparator:","`
	JWTIssuer   string   `env:"JWT_ISSUER"   envDefault:"digital-profile-api"`
	JWTAudience string   `env:"JWT_AUDIENCE" envDefault:"digital-profile-admin"`

	AccessTTL     time.Duration `env:"ACCESS_TTL"      envDefault:"15m"`
	RefreshTTL    time.Duration `env:"REFRESH_TTL"     envDefault:"168h"`
	SessionMaxAge time.Duration `env:"SESSION_MAX_AGE" envDefault:"720h"`
	// RefreshReuseGrace tolerates a just-rotated refresh token being presented again
	// (two tabs refreshing at once) without treating it as theft. No tokens are issued
	// for such a request, so the grace window grants nothing to an attacker.
	RefreshReuseGrace time.Duration `env:"REFRESH_REUSE_GRACE" envDefault:"10s"`

	// CookieSecure marks auth cookies Secure and enables the __Host-/__Secure- name prefixes.
	// Disable only for plain-HTTP local development.
	CookieSecure bool `env:"COOKIE_SECURE" envDefault:"true"`

	// After LockoutThreshold consecutive failures the account locks for LockoutBase,
	// doubling with every further failure up to LockoutMax.
	LockoutThreshold int           `env:"LOCKOUT_THRESHOLD" envDefault:"5"`
	LockoutBase      time.Duration `env:"LOCKOUT_BASE"      envDefault:"1m"`
	LockoutMax       time.Duration `env:"LOCKOUT_MAX"       envDefault:"1h"`
}

type SigningKey struct {
	ID     string
	Secret []byte
}

var keyID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,32}$`)

// SigningKeys parses JWTKeys. Validate guarantees it succeeds on a loaded Config.
func (a Auth) SigningKeys() ([]SigningKey, error) {
	keys := make([]SigningKey, 0, len(a.JWTKeys))
	seen := map[string]bool{}
	for i, raw := range a.JWTKeys {
		id, secret, ok := strings.Cut(strings.TrimSpace(raw), ":")
		if !ok || !keyID.MatchString(id) {
			return nil, fmt.Errorf("AUTH_JWT_KEYS entry %d must be kid:base64secret with kid matching %s", i+1, keyID)
		}
		if seen[id] {
			return nil, fmt.Errorf("AUTH_JWT_KEYS: duplicate kid %q", id)
		}
		seen[id] = true
		b, err := decodeKey(secret)
		if err != nil {
			return nil, fmt.Errorf("AUTH_JWT_KEYS: key %q is not valid base64", id)
		}
		if len(b) < MinJWTKeyBytes {
			return nil, fmt.Errorf("AUTH_JWT_KEYS: key %q must decode to at least %d bytes, got %d", id, MinJWTKeyBytes, len(b))
		}
		keys = append(keys, SigningKey{ID: id, Secret: b})
	}
	return keys, nil
}

func decodeKey(s string) ([]byte, error) {
	for _, enc := range []*base64.Encoding{base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding} {
		if b, err := enc.DecodeString(s); err == nil {
			return b, nil
		}
	}
	return nil, errors.New("invalid base64")
}

func (a Auth) validate(production bool) []error {
	var errs []error
	if _, err := a.SigningKeys(); err != nil {
		errs = append(errs, err)
	}
	if strings.TrimSpace(a.JWTIssuer) == "" || strings.TrimSpace(a.JWTAudience) == "" {
		errs = append(errs, errors.New("AUTH_JWT_ISSUER and AUTH_JWT_AUDIENCE must not be empty"))
	}
	if a.AccessTTL < time.Minute || a.AccessTTL > time.Hour {
		errs = append(errs, fmt.Errorf("AUTH_ACCESS_TTL must be between 1m and 1h, got %s", a.AccessTTL))
	}
	if a.RefreshTTL <= a.AccessTTL {
		errs = append(errs, errors.New("AUTH_REFRESH_TTL must be longer than AUTH_ACCESS_TTL"))
	}
	if a.SessionMaxAge < a.RefreshTTL {
		errs = append(errs, errors.New("AUTH_SESSION_MAX_AGE must be at least AUTH_REFRESH_TTL"))
	}
	if a.RefreshReuseGrace < 0 || a.RefreshReuseGrace > time.Minute {
		errs = append(errs, fmt.Errorf("AUTH_REFRESH_REUSE_GRACE must be between 0 and 1m, got %s", a.RefreshReuseGrace))
	}
	if production && !a.CookieSecure {
		errs = append(errs, errors.New("AUTH_COOKIE_SECURE must be true in production"))
	}
	if a.LockoutThreshold < 1 {
		errs = append(errs, errors.New("AUTH_LOCKOUT_THRESHOLD must be at least 1"))
	}
	if a.LockoutBase <= 0 || a.LockoutMax < a.LockoutBase {
		errs = append(errs, errors.New("AUTH_LOCKOUT_BASE must be positive and AUTH_LOCKOUT_MAX at least AUTH_LOCKOUT_BASE"))
	}
	return errs
}
