package httpx

import "testing"

func TestETagMatches(t *testing.T) {
	for _, tc := range []struct {
		header string
		want   bool
	}{
		{`"a"`, true},
		{`W/"a"`, true},
		{`"b", "a"`, true},
		{`*`, true},
		{`"b"`, false},
		{``, false},
	} {
		if got := ETagMatches(tc.header, `"a"`); got != tc.want {
			t.Errorf("ETagMatches(%q) = %v, want %v", tc.header, got, tc.want)
		}
	}
}
