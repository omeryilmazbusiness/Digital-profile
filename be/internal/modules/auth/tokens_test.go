package auth

import (
	"bytes"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

var (
	keyA = config.SigningKey{ID: "a", Secret: bytes.Repeat([]byte{1}, 32)}
	keyB = config.SigningKey{ID: "b", Secret: bytes.Repeat([]byte{2}, 32)}
)

func newIssuer(t *testing.T, now *time.Time, keys ...config.SigningKey) *TokenIssuer {
	t.Helper()
	ti, err := NewTokenIssuer(keys, "iss", "aud", 15*time.Minute, func() time.Time { return *now })
	if err != nil {
		t.Fatal(err)
	}
	return ti
}

func TestTokenIssuer_RoundTrip(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	ti := newIssuer(t, &now, keyA)
	p := Principal{UserID: uuid.New(), SessionID: uuid.New()}

	tok, exp, err := ti.Issue(p)
	if err != nil {
		t.Fatal(err)
	}
	if !exp.Equal(now.Add(15 * time.Minute)) {
		t.Errorf("exp = %v", exp)
	}
	got, err := ti.Parse(tok)
	if err != nil || got != p {
		t.Fatalf("Parse = %+v, %v; want %+v", got, err, p)
	}

	header, _ := base64.RawURLEncoding.DecodeString(strings.Split(tok, ".")[0])
	if !strings.Contains(string(header), `"kid":"a"`) || !strings.Contains(string(header), `"alg":"HS256"`) {
		t.Errorf("header = %s", header)
	}
}

func TestTokenIssuer_KeyRotation(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	old := newIssuer(t, &now, keyA)
	tok, _, _ := old.Issue(Principal{UserID: uuid.New(), SessionID: uuid.New()})

	rotated := newIssuer(t, &now, keyB, keyA)
	if _, err := rotated.Parse(tok); err != nil {
		t.Fatalf("token signed with a retired-but-listed key rejected: %v", err)
	}
	fresh, _, _ := rotated.Issue(Principal{UserID: uuid.New(), SessionID: uuid.New()})
	if _, err := old.Parse(fresh); err == nil {
		t.Fatal("issuer without key b accepted a token signed by b")
	}

	dropped := newIssuer(t, &now, keyB)
	if _, err := dropped.Parse(tok); err == nil {
		t.Fatal("token signed with a removed key still accepted")
	}
}

func TestTokenIssuer_Rejects(t *testing.T) {
	now := time.Unix(1_800_000_000, 0)
	ti := newIssuer(t, &now, keyA)
	p := Principal{UserID: uuid.New(), SessionID: uuid.New()}
	valid, _, _ := ti.Issue(p)

	sign := func(method jwt.SigningMethod, key any, mutate func(*AccessClaims), kid string) string {
		c := AccessClaims{SessionID: p.SessionID, RegisteredClaims: jwt.RegisteredClaims{
			Issuer: "iss", Subject: p.UserID.String(), Audience: jwt.ClaimStrings{"aud"},
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Minute)), IssuedAt: jwt.NewNumericDate(now),
		}}
		if mutate != nil {
			mutate(&c)
		}
		tok := jwt.NewWithClaims(method, c)
		tok.Header["kid"] = kid
		s, err := tok.SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}

	tests := map[string]string{
		"garbage":         "not.a.jwt",
		"tampered":        valid[:len(valid)-2] + "xx",
		"alg none":        sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, nil, "a"),
		"other algorithm": sign(jwt.SigningMethodHS512, keyA.Secret, nil, "a"),
		"unknown kid":     sign(jwt.SigningMethodHS256, keyA.Secret, nil, "zzz"),
		"wrong key":       sign(jwt.SigningMethodHS256, keyB.Secret, nil, "a"),
		"wrong issuer":    sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.Issuer = "evil" }, "a"),
		"wrong audience":  sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.Audience = jwt.ClaimStrings{"other"} }, "a"),
		"no expiry":       sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.ExpiresAt = nil }, "a"),
		"expired":         sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.ExpiresAt = jwt.NewNumericDate(now.Add(-time.Minute)) }, "a"),
		"issued in future": sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) {
			c.IssuedAt = jwt.NewNumericDate(now.Add(time.Hour))
		}, "a"),
		"no session":  sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.SessionID = uuid.Nil }, "a"),
		"bad subject": sign(jwt.SigningMethodHS256, keyA.Secret, func(c *AccessClaims) { c.Subject = "admin" }, "a"),
	}
	for name, tok := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := ti.Parse(tok); !errors.Is(err, errInvalidToken) {
				t.Fatalf("Parse err = %v, want errInvalidToken", err)
			}
		})
	}

	t.Run("expires after ttl", func(t *testing.T) {
		later := now.Add(16 * time.Minute)
		if _, err := newIssuer(t, &later, keyA).Parse(valid); err == nil {
			t.Fatal("token accepted after expiry")
		}
	})
}

func TestRefreshToken(t *testing.T) {
	tok, hash, err := newRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	if len(tok) != 43 || len(hash) != 32 {
		t.Fatalf("token len %d, hash len %d", len(tok), len(hash))
	}
	if !bytes.Equal(hashRefreshToken(tok), hash) {
		t.Fatal("hash not reproducible")
	}
	other, _, _ := newRefreshToken()
	if other == tok {
		t.Fatal("refresh tokens repeat")
	}
}

func TestNewTokenIssuer_RequiresKey(t *testing.T) {
	if _, err := NewTokenIssuer(nil, "i", "a", time.Minute, time.Now); err == nil {
		t.Fatal("issuer without keys created")
	}
}
