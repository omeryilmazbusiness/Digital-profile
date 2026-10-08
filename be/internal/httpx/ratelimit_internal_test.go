package httpx

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"sync"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *fakeClock) now() time.Time { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *fakeClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

func newTestLimiter(t *testing.T) (*RateLimiter, *fakeClock) {
	t.Helper()
	clock := &fakeClock{t: time.Unix(1_700_000_000, 0)}
	rl := newRateLimiter(config.RateLimit{
		Enabled: true, RPS: 1, Burst: 2,
		StrictRPS: 0.5, StrictBurst: 1, StrictPaths: []string{"/api/v1/auth/login/"},
		IdleTTL: time.Minute,
	}, clock.now)
	t.Cleanup(rl.Close)
	return rl, clock
}

func hit(h http.Handler, method, path, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, http.NoBody)
	req.RemoteAddr = ip + ":1234"
	rec := httptest.NewRecorder()
	ClientIP(nil)(h).ServeHTTP(rec, req)
	return rec
}

var noContent = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })

func TestRateLimiter_BurstThenRefill(t *testing.T) {
	rl, clock := newTestLimiter(t)
	h := rl.Middleware(noContent)

	for i := range 2 {
		if c := hit(h, http.MethodGet, "/x", "198.51.100.1").Code; c != http.StatusNoContent {
			t.Fatalf("request %d within burst: status %d", i, c)
		}
	}
	rec := hit(h, http.MethodGet, "/x", "198.51.100.1")
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("over burst: status %d, want 429", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "1" {
		t.Errorf("Retry-After = %q, want 1", got)
	}

	clock.advance(time.Second)
	if c := hit(h, http.MethodGet, "/x", "198.51.100.1").Code; c != http.StatusNoContent {
		t.Fatalf("after refill: status %d", c)
	}
}

func TestRateLimiter_RejectedRequestsDoNotConsume(t *testing.T) {
	rl, clock := newTestLimiter(t)
	h := rl.Middleware(noContent)

	hit(h, http.MethodGet, "/x", "198.51.100.1")
	hit(h, http.MethodGet, "/x", "198.51.100.1")
	for range 10 {
		hit(h, http.MethodGet, "/x", "198.51.100.1")
	}
	clock.advance(time.Second)
	if c := hit(h, http.MethodGet, "/x", "198.51.100.1").Code; c != http.StatusNoContent {
		t.Fatalf("hammering while limited must not push the refill further out: status %d", c)
	}
}

func TestRateLimiter_PerClientIsolation(t *testing.T) {
	rl, _ := newTestLimiter(t)
	h := rl.Middleware(noContent)

	for range 3 {
		hit(h, http.MethodGet, "/x", "198.51.100.1")
	}
	if c := hit(h, http.MethodGet, "/x", "198.51.100.2").Code; c != http.StatusNoContent {
		t.Fatalf("other client throttled: status %d", c)
	}
}

func TestRateLimiter_StrictPathHasOwnBucket(t *testing.T) {
	rl, clock := newTestLimiter(t)
	h := rl.Middleware(noContent)
	ip := "198.51.100.1"

	if c := hit(h, http.MethodPost, "/api/v1/auth/login", ip).Code; c != http.StatusNoContent {
		t.Fatalf("first login: %d", c)
	}
	rec := hit(h, http.MethodPost, "/api/v1/auth/login/", ip)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second login (trailing slash): %d, want 429", rec.Code)
	}
	if got := rec.Header().Get("Retry-After"); got != "2" {
		t.Errorf("Retry-After = %q, want 2 (0.5 rps)", got)
	}
	if c := hit(h, http.MethodGet, "/x", ip).Code; c != http.StatusNoContent {
		t.Fatalf("general traffic must not be blocked by a throttled login: %d", c)
	}
	clock.advance(2 * time.Second)
	if c := hit(h, http.MethodPost, "/api/v1/auth/login", ip).Code; c != http.StatusNoContent {
		t.Fatalf("login after refill: %d", c)
	}
}

func TestRateLimiter_ExemptRequests(t *testing.T) {
	rl, _ := newTestLimiter(t)
	h := rl.Middleware(noContent)
	for range 10 {
		for _, r := range []struct{ method, path string }{
			{http.MethodGet, "/healthz"},
			{http.MethodGet, "/readyz"},
			{http.MethodOptions, "/x"},
		} {
			if c := hit(h, r.method, r.path, "198.51.100.1").Code; c != http.StatusNoContent {
				t.Fatalf("%s %s limited: %d", r.method, r.path, c)
			}
		}
	}
}

func TestRateLimiter_SweepEvictsIdleClients(t *testing.T) {
	rl, clock := newTestLimiter(t)
	h := rl.Middleware(noContent)

	hit(h, http.MethodGet, "/x", "198.51.100.1")
	clock.advance(30 * time.Second)
	hit(h, http.MethodGet, "/x", "198.51.100.2")
	clock.advance(31 * time.Second)
	rl.sweep()

	rl.mu.Lock()
	defer rl.mu.Unlock()
	if _, ok := rl.normal.visitors[netip.MustParseAddr("198.51.100.1")]; ok {
		t.Error("idle client not evicted")
	}
	if _, ok := rl.normal.visitors[netip.MustParseAddr("198.51.100.2")]; !ok {
		t.Error("active client evicted")
	}
}

func TestRateLimiter_BoundedMemory(t *testing.T) {
	rl, _ := newTestLimiter(t)
	b := rl.normal
	for i := range maxTrackedClients {
		b.visitors[netip.AddrFrom4([4]byte{10, byte(i >> 16), byte(i >> 8), byte(i)})] = &visitor{}
	}
	if lim := rl.limiterFor(b, netip.MustParseAddr("203.0.113.1"), rl.now()); lim != b.overflow {
		t.Fatal("new client beyond the cap did not get the overflow bucket")
	}
	if len(b.visitors) != maxTrackedClients {
		t.Fatalf("visitors grew past the cap: %d", len(b.visitors))
	}
}

func TestRateLimiter_ConcurrentAndClose(_ *testing.T) {
	rl := NewRateLimiter(config.RateLimit{Enabled: true, RPS: 1000, Burst: 1000, StrictRPS: 1, StrictBurst: 1, IdleTTL: time.Millisecond})
	h := rl.Middleware(noContent)
	var wg sync.WaitGroup
	for i := range 50 {
		wg.Go(func() {
			for range 20 {
				hit(h, http.MethodGet, "/x", netip.AddrFrom4([4]byte{198, 51, 100, byte(i)}).String())
			}
		})
	}
	wg.Go(func() {
		for range 20 {
			rl.sweep()
		}
	})
	wg.Wait()
	rl.Close()
	rl.Close()
}
