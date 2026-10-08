package httpx_test

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

func TestClientIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8"), netip.MustParsePrefix("::1/128")}

	tests := []struct {
		name   string
		remote string
		xff    []string
		want   string
	}{
		{"direct client, no header", "203.0.113.7:5000", nil, "203.0.113.7"},
		{"untrusted peer cannot spoof", "203.0.113.7:5000", []string{"1.2.3.4"}, "203.0.113.7"},
		{"trusted proxy forwards client", "10.0.0.2:80", []string{"198.51.100.9"}, "198.51.100.9"},
		{"spoofed left-most entry ignored", "10.0.0.2:80", []string{"6.6.6.6, 198.51.100.9"}, "198.51.100.9"},
		{"proxy chain skips trusted hops", "10.0.0.2:80", []string{"198.51.100.9, 10.0.0.5"}, "198.51.100.9"},
		{"multiple header lines", "10.0.0.2:80", []string{"6.6.6.6", "198.51.100.9, 10.0.0.5"}, "198.51.100.9"},
		{"garbage stops the walk", "10.0.0.2:80", []string{"198.51.100.9, not-an-ip"}, "10.0.0.2"},
		{"all hops trusted", "10.0.0.2:80", []string{"10.1.1.1"}, "10.1.1.1"},
		{"ipv6 loopback proxy", "[::1]:80", []string{"2001:db8::1"}, "2001:db8::1"},
		{"ipv4-mapped ipv6 is unmapped", "[::ffff:203.0.113.7]:1", nil, "203.0.113.7"},
		{"unparseable remote", "bogus", nil, "invalid IP"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var got netip.Addr
			h := httpx.ClientIP(trusted)(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
				got = httpx.ClientIPFrom(r.Context())
			}))
			req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
			req.RemoteAddr = tt.remote
			for _, v := range tt.xff {
				req.Header.Add("X-Forwarded-For", v)
			}
			h.ServeHTTP(httptest.NewRecorder(), req)
			if got.String() != tt.want {
				t.Errorf("client IP = %s, want %s", got, tt.want)
			}
		})
	}
}
