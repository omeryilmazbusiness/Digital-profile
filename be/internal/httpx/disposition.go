package httpx

import (
	"strings"
	"unicode/utf8"
)

// ContentDisposition returns a Content-Disposition value ("inline" or "attachment") naming
// the file base+ext: an ASCII fallback (fallback+ext when nothing ASCII is left) plus the
// exact UTF-8 name (RFC 6266), so Arabic and accented names survive the download.
func ContentDisposition(disposition, base, ext, fallback string) string {
	ascii := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		case r == ' ':
			return '-'
		default:
			return -1
		}
	}, strings.TrimSpace(base))
	ascii = strings.Trim(ascii, "-")
	if ascii == "" {
		ascii = fallback
	}
	v := disposition + `; filename="` + ascii + ext + `"`
	if n := strings.TrimSpace(base); n != "" && n != ascii {
		v += "; filename*=UTF-8''" + encodeExtValue(n+ext)
	}
	return v
}

// encodeExtValue percent-encodes every octet outside RFC 5987 attr-char.
func encodeExtValue(s string) string {
	const hex = "0123456789ABCDEF"
	var b strings.Builder
	for i := range len(s) {
		c := s[i]
		if c < utf8.RuneSelf && (c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' ||
			strings.IndexByte("!#$&+-.^_`|~", c) >= 0) {
			b.WriteByte(c)
			continue
		}
		b.WriteByte('%')
		b.WriteByte(hex[c>>4])
		b.WriteByte(hex[c&0xF])
	}
	return b.String()
}
