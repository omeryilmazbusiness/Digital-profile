package httpx

import (
	"math"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

// maxTrackedClients bounds memory under a flood of distinct addresses. Beyond it, new clients
// share one overflow bucket per policy, so the limiter degrades to a global cap instead of
// growing without bound.
const maxTrackedClients = 100_000

// Policy is a token bucket: RPS sustained rate, Burst momentary allowance.
type Policy struct {
	RPS   float64
	Burst int
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type bucket struct {
	policy   Policy
	visitors map[netip.Addr]*visitor
	overflow *rate.Limiter
}

// RateLimiter throttles requests per client IP (as resolved by ClientIP). Paths listed as
// strict use a separate, tighter bucket so brute-force attempts on login cannot borrow from
// a client's general allowance and vice versa. Probe endpoints are never limited, nor are
// immutable public assets: a page legitimately loads dozens of them at once, and bandwidth
// abuse on cacheable files is the CDN/reverse proxy's job.
type RateLimiter struct {
	mu      sync.Mutex
	normal  *bucket
	strict  *bucket
	strictP map[string]struct{}
	exempt  map[string]struct{}
	idleTTL time.Duration
	now     func() time.Time
	done    chan struct{}
	stopped sync.Once
}

// NewRateLimiter starts a janitor goroutine; call Close to stop it.
func NewRateLimiter(cfg config.RateLimit) *RateLimiter {
	return newRateLimiter(cfg, time.Now)
}

func newRateLimiter(cfg config.RateLimit, now func() time.Time) *RateLimiter {
	rl := &RateLimiter{
		normal:  newBucket(Policy{RPS: cfg.RPS, Burst: cfg.Burst}),
		strict:  newBucket(Policy{RPS: cfg.StrictRPS, Burst: cfg.StrictBurst}),
		strictP: pathSet(cfg.StrictPaths),
		exempt:  pathSet([]string{"/healthz", "/readyz"}),
		idleTTL: cfg.IdleTTL,
		now:     now,
		done:    make(chan struct{}),
	}
	go rl.janitor()
	return rl
}

func newBucket(p Policy) *bucket {
	return &bucket{
		policy:   p,
		visitors: make(map[netip.Addr]*visitor),
		overflow: rate.NewLimiter(rate.Limit(p.RPS), p.Burst),
	}
}

func pathSet(paths []string) map[string]struct{} {
	set := make(map[string]struct{}, len(paths))
	for _, p := range paths {
		if p = normalisePath(p); p != "" {
			set[p] = struct{}{}
		}
	}
	return set
}

func normalisePath(p string) string {
	p = strings.TrimSpace(p)
	if len(p) > 1 {
		p = strings.TrimRight(p, "/")
	}
	return p
}

// ImmutableAssetPrefix is the public path of content-addressed files.
const ImmutableAssetPrefix = "/api/v1/public/media/"

func isImmutableAsset(r *http.Request) bool {
	return (r.Method == http.MethodGet || r.Method == http.MethodHead) && strings.HasPrefix(r.URL.Path, ImmutableAssetPrefix)
}

func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := normalisePath(r.URL.Path)
		if _, ok := rl.exempt[path]; ok || r.Method == http.MethodOptions || isImmutableAsset(r) {
			next.ServeHTTP(w, r)
			return
		}

		b := rl.normal
		if _, ok := rl.strictP[path]; ok {
			b = rl.strict
		}

		if wait, ok := rl.allow(b, ClientIPFrom(r.Context())); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
			Error(w, r, http.StatusTooManyRequests, "rate limit exceeded, retry later")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// allow consumes a token or reports how long until one is available.
func (rl *RateLimiter) allow(b *bucket, ip netip.Addr) (time.Duration, bool) {
	now := rl.now()

	rl.mu.Lock()
	lim := rl.limiterFor(b, ip, now)
	rl.mu.Unlock()

	res := lim.ReserveN(now, 1)
	if !res.OK() {
		return time.Second, false
	}
	if d := res.DelayFrom(now); d > 0 {
		res.CancelAt(now)
		return max(d, time.Second), false
	}
	return 0, true
}

func (rl *RateLimiter) limiterFor(b *bucket, ip netip.Addr, now time.Time) *rate.Limiter {
	if v, ok := b.visitors[ip]; ok {
		v.lastSeen = now
		return v.limiter
	}
	if len(b.visitors) >= maxTrackedClients {
		return b.overflow
	}
	v := &visitor{limiter: rate.NewLimiter(rate.Limit(b.policy.RPS), b.policy.Burst), lastSeen: now}
	b.visitors[ip] = v
	return v.limiter
}

func (rl *RateLimiter) janitor() {
	interval := max(rl.idleTTL/2, time.Second)
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-rl.done:
			return
		case <-t.C:
			rl.sweep()
		}
	}
}

// sweep drops visitors idle for longer than idleTTL. Config validation guarantees idleTTL
// exceeds a full refill, so a forgotten visitor's bucket was full anyway: no extra allowance.
func (rl *RateLimiter) sweep() {
	cutoff := rl.now().Add(-rl.idleTTL)
	rl.mu.Lock()
	defer rl.mu.Unlock()
	for _, b := range []*bucket{rl.normal, rl.strict} {
		for ip, v := range b.visitors {
			if v.lastSeen.Before(cutoff) {
				delete(b.visitors, ip)
			}
		}
	}
}

// Close stops the janitor. It is safe to call more than once.
func (rl *RateLimiter) Close() {
	rl.stopped.Do(func() { close(rl.done) })
}
