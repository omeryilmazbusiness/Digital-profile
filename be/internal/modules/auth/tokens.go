package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

// AccessClaims are the claims of an access token. SessionID ties the token to a server-side
// session, so revoking the session (logout, password change, theft) invalidates the token
// immediately instead of when it expires.
type AccessClaims struct {
	SessionID uuid.UUID `json:"sid"`
	jwt.RegisteredClaims
}

// Principal is the authenticated admin attached to a request.
type Principal struct {
	UserID    uuid.UUID
	SessionID uuid.UUID
}

var errInvalidToken = errors.New("invalid access token")

// TokenIssuer signs and verifies access tokens with an HS256 key ring. The first key signs;
// every key verifies, selected by the token's kid header.
type TokenIssuer struct {
	signer   config.SigningKey
	keys     map[string][]byte
	issuer   string
	audience string
	ttl      time.Duration
	now      func() time.Time
}

func NewTokenIssuer(keys []config.SigningKey, issuer, audience string, ttl time.Duration, now func() time.Time) (*TokenIssuer, error) {
	if len(keys) == 0 {
		return nil, errors.New("token issuer: at least one signing key is required")
	}
	ring := make(map[string][]byte, len(keys))
	for _, k := range keys {
		ring[k.ID] = k.Secret
	}
	return &TokenIssuer{signer: keys[0], keys: ring, issuer: issuer, audience: audience, ttl: ttl, now: now}, nil
}

// Issue returns a signed access token and its expiry.
func (ti *TokenIssuer) Issue(p Principal) (string, time.Time, error) {
	now := ti.now().Truncate(time.Second)
	exp := now.Add(ti.ttl)
	claims := AccessClaims{
		SessionID: p.SessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    ti.issuer,
			Subject:   p.UserID.String(),
			Audience:  jwt.ClaimStrings{ti.audience},
			ExpiresAt: jwt.NewNumericDate(exp),
			NotBefore: jwt.NewNumericDate(now),
			IssuedAt:  jwt.NewNumericDate(now),
			ID:        uuid.NewString(),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tok.Header["kid"] = ti.signer.ID
	signed, err := tok.SignedString(ti.signer.Secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}
	return signed, exp, nil
}

// Parse verifies signature, algorithm, issuer, audience and time claims. The algorithm is
// pinned to HS256, so "none" and algorithm-confusion tokens are rejected.
func (ti *TokenIssuer) Parse(token string) (Principal, error) {
	var claims AccessClaims
	_, err := jwt.ParseWithClaims(token, &claims, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		key, ok := ti.keys[kid]
		if !ok {
			return nil, fmt.Errorf("unknown kid %q", kid)
		}
		return key, nil
	},
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(ti.issuer),
		jwt.WithAudience(ti.audience),
		jwt.WithExpirationRequired(),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(5*time.Second),
		jwt.WithTimeFunc(ti.now),
	)
	if err != nil {
		return Principal{}, fmt.Errorf("%w: %w", errInvalidToken, err)
	}
	userID, err := uuid.Parse(claims.Subject)
	if err != nil || claims.SessionID == uuid.Nil {
		return Principal{}, fmt.Errorf("%w: missing subject or session", errInvalidToken)
	}
	return Principal{UserID: userID, SessionID: claims.SessionID}, nil
}

// refreshTokenBytes gives 256 bits of entropy; the token is opaque and never parsed.
const refreshTokenBytes = 32

// newRefreshToken returns the token handed to the client and the hash stored server side.
func newRefreshToken() (string, []byte, error) {
	b := make([]byte, refreshTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", nil, fmt.Errorf("generate refresh token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(b)
	return token, hashRefreshToken(token), nil
}

// hashRefreshToken is a plain SHA-256: the input already has full entropy, so a slow
// password hash would add nothing but latency.
func hashRefreshToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
