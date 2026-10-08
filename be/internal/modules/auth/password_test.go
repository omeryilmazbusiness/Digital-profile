package auth

import (
	"context"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// Cheap parameters keep the suite fast; production cost is covered by TestDefaultParams.
var testParams = Argon2Params{MemoryKiB: 8 * 1024, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}

func TestPasswordHasher_RoundTrip(t *testing.T) {
	h := NewPasswordHasher(testParams, 2)
	ctx := t.Context()

	enc, err := h.Hash(ctx, "correct horse battery staple")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(enc, "$argon2id$v=19$m=8192,t=1,p=1$") {
		t.Fatalf("unexpected encoding %q", enc)
	}
	if ok, err := h.Verify(ctx, "correct horse battery staple", enc); err != nil || !ok {
		t.Fatalf("Verify(correct) = %v, %v", ok, err)
	}
	if ok, err := h.Verify(ctx, "correct horse battery stapl", enc); err != nil || ok {
		t.Fatalf("Verify(wrong) = %v, %v", ok, err)
	}

	again, _ := h.Hash(ctx, "correct horse battery staple")
	if again == enc {
		t.Fatal("two hashes of the same password are identical: salt not random")
	}
}

func TestPasswordHasher_RejectsMalformedAndHostileHashes(t *testing.T) {
	h := NewPasswordHasher(testParams, 1)
	for _, enc := range []string{
		"",
		"plaintext",
		"$2a$10$abcdefghijklmnopqrstuv",
		"$argon2i$v=19$m=8192,t=1,p=1$c2FsdHNhbHQ$a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=16$m=8192,t=1,p=1$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=99999999,t=1,p=1$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=8192,t=999,p=1$c2FsdHNhbHRzYWx0$a2V5a2V5a2V5a2V5a2V5a2V5",
		"$argon2id$v=19$m=8192,t=1,p=1$!!!$a2V5a2V5a2V5a2V5a2V5a2V5",
	} {
		if ok, err := h.Verify(t.Context(), "x", enc); err == nil || ok {
			t.Errorf("Verify(%q) = %v, %v; want malformed error", enc, ok, err)
		}
		if !h.NeedsRehash(enc) {
			t.Errorf("NeedsRehash(%q) = false", enc)
		}
	}
}

func TestPasswordHasher_NeedsRehash(t *testing.T) {
	old := NewPasswordHasher(testParams, 1)
	enc, _ := old.Hash(t.Context(), "pw")
	if old.NeedsRehash(enc) {
		t.Error("fresh hash flagged for rehash")
	}
	stronger := testParams
	stronger.Iterations = 2
	h := NewPasswordHasher(stronger, 1)
	if !h.NeedsRehash(enc) {
		t.Error("hash with weaker params not flagged")
	}
	if ok, _ := h.Verify(t.Context(), "pw", enc); !ok {
		t.Error("hash with old params must still verify")
	}
}

func TestPasswordHasher_CapsConcurrency(t *testing.T) {
	h := NewPasswordHasher(testParams, 2)
	var running, peak atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			_ = h.acquire(context.Background())
			n := running.Add(1)
			for {
				p := peak.Load()
				if n <= p || peak.CompareAndSwap(p, n) {
					break
				}
			}
			time.Sleep(5 * time.Millisecond)
			running.Add(-1)
			h.release()
		})
	}
	wg.Wait()
	if peak.Load() > 2 {
		t.Fatalf("peak concurrency %d exceeds cap 2", peak.Load())
	}

	// A caller whose context ends while queued gives up instead of waiting forever.
	full := NewPasswordHasher(testParams, 1)
	_ = full.acquire(context.Background())
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Millisecond)
	defer cancel()
	if _, err := full.Hash(ctx, "pw"); err == nil {
		t.Fatal("Hash succeeded while all slots were taken")
	}
}

func TestDefaultParams(t *testing.T) {
	if testing.Short() {
		t.Skip("slow")
	}
	h := NewPasswordHasher(DefaultArgon2Params, 1)
	start := time.Now()
	enc, err := h.Hash(t.Context(), "pw")
	if err != nil {
		t.Fatal(err)
	}
	if d := time.Since(start); d < 5*time.Millisecond {
		t.Errorf("default hash took only %v; parameters are too weak", d)
	}
	if !strings.Contains(enc, "m=65536,t=3,p=2") {
		t.Errorf("unexpected params in %q", enc)
	}
}
