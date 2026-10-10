package httpx

import "strings"

// ETagMatches reports whether an If-None-Match header names etag (or "*"); weak validators
// match too, as RFC 9110 requires for GET.
func ETagMatches(header, etag string) bool {
	for c := range strings.SplitSeq(header, ",") {
		c = strings.TrimPrefix(strings.TrimSpace(c), "W/")
		if c == etag || c == "*" {
			return true
		}
	}
	return false
}
