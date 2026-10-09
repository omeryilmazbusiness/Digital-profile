package profile

import (
	"bytes"
	"encoding/base64"
	"strings"
	"time"
	"unicode/utf8"
)

// maxLineOctets is the vCard line length limit, excluding the CRLF (RFC 2425 §5.8.1).
const maxLineOctets = 75

// Card holds the contact fields of a vCard. Empty fields are left out.
type Card struct {
	FirstName    string
	LastName     string
	FullName     string
	Organization string
	Title        string
	Note         string
	// Phone and WhatsApp are E.164; WhatsApp is listed separately only when it differs.
	Phone    string
	WhatsApp string
	Email    string
	URL      string
	// Photo is a JPEG, embedded inline so the card is self-contained.
	Photo    []byte
	Revision time.Time
}

// Encode renders a vCard 3.0 (RFC 2426): UTF-8, CRLF line endings, folded lines. Version
// 3.0 rather than 4.0 because it is the version iOS and Android both import, photo included.
func (c *Card) Encode() []byte {
	var b bytes.Buffer
	line := func(s string) { writeFolded(&b, s) }

	line("BEGIN:VCARD")
	line("VERSION:3.0")
	line("PRODID:-//Sheraton Makkah//Digital Profile//EN")
	line("N:" + escape(c.LastName) + ";" + escape(c.FirstName) + ";;;")
	line("FN:" + escape(c.FullName))
	if c.Organization != "" {
		line("ORG:" + escape(c.Organization))
	}
	if c.Title != "" {
		line("TITLE:" + escape(c.Title))
	}
	if c.Phone != "" {
		line("TEL;TYPE=CELL,VOICE,PREF:" + c.Phone)
	}
	if c.WhatsApp != "" && c.WhatsApp != c.Phone {
		// Grouped label: iOS shows "WhatsApp"; other apps show a mobile number.
		line("item1.TEL;TYPE=CELL:" + c.WhatsApp)
		line("item1.X-ABLabel:WhatsApp")
	}
	if c.Email != "" {
		line("EMAIL;TYPE=INTERNET,WORK:" + escape(c.Email))
	}
	if c.URL != "" {
		line("URL:" + escape(c.URL))
	}
	if c.Note != "" {
		line("NOTE:" + escape(c.Note))
	}
	if len(c.Photo) > 0 {
		line("PHOTO;ENCODING=b;TYPE=JPEG:" + base64.StdEncoding.EncodeToString(c.Photo))
	}
	if !c.Revision.IsZero() {
		line("REV:" + c.Revision.UTC().Format("2006-01-02T15:04:05Z"))
	}
	line("END:VCARD")
	return b.Bytes()
}

// escape encodes a text value: backslash, comma, semicolon and line breaks.
var escaper = strings.NewReplacer(`\`, `\\`, ",", `\,`, ";", `\;`, "\r\n", `\n`, "\n", `\n`, "\r", `\n`)

func escape(s string) string { return escaper.Replace(s) }

// writeFolded writes s as one logical line: physical lines of at most 75 octets, each
// continuation starting with a space, never splitting a UTF-8 character.
func writeFolded(b *bytes.Buffer, s string) {
	limit := maxLineOctets
	for len(s) > limit {
		cut := limit
		for cut > 0 && !utf8.RuneStart(s[cut]) {
			cut--
		}
		b.WriteString(s[:cut])
		b.WriteString("\r\n ")
		s = s[cut:]
		limit = maxLineOctets - 1 // the leading space counts
	}
	b.WriteString(s)
	b.WriteString("\r\n")
}

// Filename returns a Content-Disposition value for a card named after name: an ASCII
// fallback plus the exact UTF-8 name (RFC 6266), e.g. for Arabic names.
func Filename(name string) string {
	ascii := strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			return r
		case r == ' ':
			return '-'
		default:
			return -1
		}
	}, strings.TrimSpace(name))
	ascii = strings.Trim(ascii, "-")
	if ascii == "" {
		ascii = "contact"
	}
	v := `attachment; filename="` + ascii + `.vcf"`
	if n := strings.TrimSpace(name); n != "" && n != ascii {
		v += "; filename*=UTF-8''" + encodeExtValue(n+".vcf")
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
