package httpx

import (
	"context"
	"net"
	"net/http"
	"net/netip"
	"strings"
)

type clientIPKey struct{}

// ClientIP resolves the real client address once per request for rate limiting and logs.
//
// X-Forwarded-For is honoured only when the direct peer is a trusted proxy, and is walked
// right to left: the first hop that is not itself trusted is the client. Taking the left-most
// entry instead would let any caller spoof its address by sending the header themselves.
func ClientIP(trusted []netip.Prefix) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := resolveClientIP(r, trusted)
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), clientIPKey{}, ip)))
		})
	}
}

// ClientIPFrom returns the address resolved by ClientIP, or the zero Addr when absent.
func ClientIPFrom(ctx context.Context) netip.Addr {
	ip, _ := ctx.Value(clientIPKey{}).(netip.Addr)
	return ip
}

func resolveClientIP(r *http.Request, trusted []netip.Prefix) netip.Addr {
	peer := parseIP(r.RemoteAddr)
	if !peer.IsValid() || !isTrusted(peer, trusted) {
		return peer
	}

	hops := r.Header.Values("X-Forwarded-For")
	ip := peer
	for i := len(hops) - 1; i >= 0; i-- {
		parts := strings.Split(hops[i], ",")
		for j := len(parts) - 1; j >= 0; j-- {
			hop := parseIP(strings.TrimSpace(parts[j]))
			if !hop.IsValid() {
				// Garbage in the chain: stop at the last address we could verify.
				return ip
			}
			ip = hop
			if !isTrusted(hop, trusted) {
				return hop
			}
		}
	}
	return ip
}

func parseIP(s string) netip.Addr {
	if host, _, err := net.SplitHostPort(s); err == nil {
		s = host
	}
	ip, err := netip.ParseAddr(s)
	if err != nil {
		return netip.Addr{}
	}
	return ip.Unmap().WithZone("")
}

func isTrusted(ip netip.Addr, trusted []netip.Prefix) bool {
	for _, p := range trusted {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}
