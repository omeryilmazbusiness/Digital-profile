package storage_test

import (
	"bytes"
	"errors"
	"io"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/johannesboyne/gofakes3"
	"github.com/johannesboyne/gofakes3/backend/s3mem"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

func TestValidKey(t *testing.T) {
	for key, want := range map[string]bool{
		"media/abc.webp":                    true,
		"a":                                 true,
		"documents/2026/x-y_z.pdf":          true,
		"":                                  false,
		"/abs":                              false,
		"../escape":                         false,
		"media/../x":                        false,
		"media//x":                          false,
		"media/":                            false,
		"Upper/case":                        false,
		"media/.hidden":                     false,
		"space here":                        false,
		"q?x=1":                             false,
		strings.Repeat("a", 513):            false,
		"media/" + strings.Repeat("a", 500): true,
	} {
		if got := storage.ValidKey(key); got != want {
			t.Errorf("ValidKey(%q) = %t, want %t", key, got, want)
		}
	}
}

func TestLocal(t *testing.T) {
	l, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = l.Close() })
	conformance(t, l)

	if err := l.Put(t.Context(), "x.content-type", strings.NewReader("x"), 1, "text/plain"); err == nil {
		t.Error("reserved sidecar suffix accepted as a key")
	}
}

func TestS3(t *testing.T) {
	backend := s3mem.New()
	faker := gofakes3.New(backend)
	srv := httptest.NewServer(faker.Server())
	t.Cleanup(srv.Close)
	if err := backend.CreateBucket("test-bucket"); err != nil {
		t.Fatal(err)
	}

	s, err := storage.NewS3(storage.S3Config{
		Endpoint: srv.URL, Region: "us-east-1", Bucket: "test-bucket",
		AccessKey: "key", SecretKey: "secret", PathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	conformance(t, s)

	missing, err := storage.NewS3(storage.S3Config{
		Endpoint: srv.URL, Region: "us-east-1", Bucket: "no-such-bucket",
		AccessKey: "key", SecretKey: "secret", PathStyle: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := missing.Ping(t.Context()); err == nil {
		t.Error("Ping succeeded for a missing bucket")
	}
}

func TestNewS3_RejectsBadEndpoint(t *testing.T) {
	for _, ep := range []string{"", "localhost:9000", "ftp://x", "http://"} {
		if _, err := storage.NewS3(storage.S3Config{Endpoint: ep, Bucket: "b"}); err == nil {
			t.Errorf("endpoint %q accepted", ep)
		}
	}
}

// conformance is the behavioural contract every Storage implementation must satisfy.
func conformance(t *testing.T, s storage.Storage) {
	t.Helper()
	ctx := t.Context()

	if err := s.Ping(ctx); err != nil {
		t.Fatalf("Ping: %v", err)
	}

	data := []byte("RIFF....WEBPVP8 fake image bytes")
	if err := s.Put(ctx, "media/abc.webp", bytes.NewReader(data), int64(len(data)), "image/webp"); err != nil {
		t.Fatalf("Put: %v", err)
	}

	obj, err := s.Stat(ctx, "media/abc.webp")
	if err != nil || obj.Size != int64(len(data)) || obj.ContentType != "image/webp" {
		t.Fatalf("Stat = %+v, %v", obj, err)
	}

	rc, obj, err := s.Get(ctx, "media/abc.webp")
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	got, _ := io.ReadAll(rc)
	_ = rc.Close()
	if !bytes.Equal(got, data) || obj.ContentType != "image/webp" {
		t.Fatalf("Get returned %q (%+v)", got, obj)
	}

	// Overwrite replaces the content atomically.
	if err := s.Put(ctx, "media/abc.webp", strings.NewReader("v2"), 2, "image/webp"); err != nil {
		t.Fatal(err)
	}
	if obj, _ := s.Stat(ctx, "media/abc.webp"); obj.Size != 2 {
		t.Errorf("overwrite size = %d", obj.Size)
	}

	if _, err := s.Stat(ctx, "media/missing.webp"); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("Stat missing = %v, want ErrNotFound", err)
	}
	if _, _, err := s.Get(ctx, "media/missing.webp"); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("Get missing = %v, want ErrNotFound", err)
	}

	if err := s.Delete(ctx, "media/abc.webp"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if _, err := s.Stat(ctx, "media/abc.webp"); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("object survives Delete: %v", err)
	}
	if err := s.Delete(ctx, "media/abc.webp"); err != nil {
		t.Errorf("Delete of a missing object = %v, want nil", err)
	}

	// A size mismatch must fail rather than store a truncated object.
	if err := s.Put(ctx, "media/short.webp", strings.NewReader("abc"), 10, "image/webp"); err == nil {
		t.Error("Put accepted a body shorter than the declared size")
	}
	if _, err := s.Stat(ctx, "media/short.webp"); !errors.Is(err, storage.ErrNotFound) {
		t.Errorf("failed Put left an object behind: %v", err)
	}

	for _, key := range []string{"../escape", "/etc/passwd", "a/../../b"} {
		if err := s.Put(ctx, key, strings.NewReader("x"), 1, "text/plain"); err == nil {
			t.Errorf("Put(%q) accepted an unsafe key", key)
		}
		if _, _, err := s.Get(ctx, key); err == nil || errors.Is(err, storage.ErrNotFound) {
			t.Errorf("Get(%q) = %v, want key validation error", key, err)
		}
	}
}
