package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

// Argon2Params are the argon2id cost parameters. Stored hashes embed the parameters they
// were created with, so raising the cost later only affects new hashes, and NeedsRehash
// upgrades existing ones on the next successful login.
type Argon2Params struct {
	MemoryKiB   uint32
	Iterations  uint32
	Parallelism uint8
	SaltLen     uint32
	KeyLen      uint32
}

// DefaultArgon2Params exceed the OWASP baseline (19 MiB, t=2, p=1) with headroom for a
// low-traffic admin login: roughly 50–100 ms per hash on current server CPUs.
var DefaultArgon2Params = Argon2Params{MemoryKiB: 64 * 1024, Iterations: 3, Parallelism: 2, SaltLen: 16, KeyLen: 32}

var errMalformedHash = errors.New("malformed password hash")

// PasswordHasher hashes and verifies passwords with argon2id.
//
// Each hash allocates MemoryKiB of memory, so concurrent hashing is capped: a flood of login
// attempts queues instead of exhausting process memory.
type PasswordHasher struct {
	params Argon2Params
	slots  chan struct{}
}

func NewPasswordHasher(p Argon2Params, maxConcurrent int) *PasswordHasher {
	return &PasswordHasher{params: p, slots: make(chan struct{}, max(maxConcurrent, 1))}
}

func (h *PasswordHasher) acquire(ctx context.Context) error {
	select {
	case h.slots <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (h *PasswordHasher) release() { <-h.slots }

// Hash returns a PHC-format string: $argon2id$v=19$m=...,t=...,p=...$salt$key.
func (h *PasswordHasher) Hash(ctx context.Context, password string) (string, error) {
	salt := make([]byte, h.params.SaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate salt: %w", err)
	}
	if err := h.acquire(ctx); err != nil {
		return "", err
	}
	defer h.release()

	p := h.params
	key := argon2.IDKey([]byte(password), salt, p.Iterations, p.MemoryKiB, p.Parallelism, p.KeyLen)
	return encodeHash(p, salt, key), nil
}

// Verify reports whether password matches encoded, comparing in constant time.
// A malformed hash is an error rather than a mismatch so corruption is noticed.
func (h *PasswordHasher) Verify(ctx context.Context, password, encoded string) (bool, error) {
	p, salt, want, err := decodeHash(encoded)
	if err != nil {
		return false, err
	}
	if err := h.acquire(ctx); err != nil {
		return false, err
	}
	defer h.release()

	got := argon2.IDKey([]byte(password), salt, p.Iterations, p.MemoryKiB, p.Parallelism, uint32(len(want))) //nolint:gosec // key length is bounded by decodeHash
	return subtle.ConstantTimeCompare(got, want) == 1, nil
}

// NeedsRehash reports whether encoded was produced with parameters other than the current ones.
func (h *PasswordHasher) NeedsRehash(encoded string) bool {
	p, salt, key, err := decodeHash(encoded)
	if err != nil {
		return true
	}
	cur := h.params
	return p.MemoryKiB != cur.MemoryKiB || p.Iterations != cur.Iterations || p.Parallelism != cur.Parallelism ||
		len(salt) != int(cur.SaltLen) || len(key) != int(cur.KeyLen)
}

var b64 = base64.RawStdEncoding

func encodeHash(p Argon2Params, salt, key []byte) string {
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, p.MemoryKiB, p.Iterations, p.Parallelism, b64.EncodeToString(salt), b64.EncodeToString(key))
}

func decodeHash(encoded string) (Argon2Params, []byte, []byte, error) {
	var p Argon2Params
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" {
		return p, nil, nil, errMalformedHash
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return p, nil, nil, errMalformedHash
	}
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &p.MemoryKiB, &p.Iterations, &p.Parallelism); err != nil {
		return p, nil, nil, errMalformedHash
	}
	// Bounds stop a tampered hash from turning verification into a memory or CPU bomb.
	if p.MemoryKiB < 8*1024 || p.MemoryKiB > 1024*1024 || p.Iterations < 1 || p.Iterations > 20 || p.Parallelism < 1 {
		return p, nil, nil, errMalformedHash
	}
	salt, err := b64.DecodeString(parts[4])
	if err != nil || len(salt) < 8 || len(salt) > 64 {
		return p, nil, nil, errMalformedHash
	}
	key, err := b64.DecodeString(parts[5])
	if err != nil || len(key) < 16 || len(key) > 64 {
		return p, nil, nil, errMalformedHash
	}
	return p, salt, key, nil
}
