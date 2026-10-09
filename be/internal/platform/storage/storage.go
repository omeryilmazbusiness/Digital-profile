// Package storage abstracts the blob store holding uploaded files. Implementations exist for
// the local filesystem (development, single-node deployments) and S3-compatible services
// (RustFS in development, Cloudflare R2 / AWS S3 in production).
package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"regexp"
	"time"
)

// ErrNotFound is returned when an object does not exist.
var ErrNotFound = errors.New("storage: object not found")

// Object describes a stored blob.
type Object struct {
	Size        int64
	ContentType string
	ModTime     time.Time
}

// Storage is the minimal blob API the application needs. Keys are opaque, slash-separated
// paths validated by ValidKey; callers own the key layout.
//
// Implementations must make Put atomic: readers never observe a partially written object.
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error
	// Get opens an object for reading; the caller must close the reader.
	Get(ctx context.Context, key string) (io.ReadCloser, Object, error)
	Stat(ctx context.Context, key string) (Object, error)
	// Delete removes an object. Deleting a missing object is not an error.
	Delete(ctx context.Context, key string) error
	// Ping verifies the backend is reachable and usable, for readiness probes.
	Ping(ctx context.Context) error
}

// keyPattern allows lower-case path segments of safe characters, so keys can never escape a
// directory ("..", absolute paths) or smuggle URL syntax into an S3 request.
var keyPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*(/[a-z0-9][a-z0-9._-]*)*$`)

const maxKeyLen = 512

// ValidKey reports whether key is acceptable to every implementation.
func ValidKey(key string) bool {
	return len(key) <= maxKeyLen && keyPattern.MatchString(key)
}

func checkKey(key string) error {
	if !ValidKey(key) {
		return fmt.Errorf("storage: invalid key %q", key)
	}
	return nil
}
