package profile

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
	"time"
	"unicode/utf8"
)

// unfold reverses line folding and splits the card into logical lines.
func unfold(t *testing.T, card []byte) []string {
	t.Helper()
	s := string(card)
	if !strings.HasSuffix(s, "\r\n") {
		t.Fatal("card must end with CRLF")
	}
	if strings.Contains(strings.ReplaceAll(s, "\r\n", ""), "\n") {
		t.Fatal("bare LF line ending")
	}
	return strings.Split(strings.TrimSuffix(strings.ReplaceAll(s, "\r\n ", ""), "\r\n"), "\r\n")
}

func TestCardEncode(t *testing.T) {
	t.Parallel()
	photo := bytes.Repeat([]byte{0xFF, 0xD8, 0x01}, 400)
	c := Card{
		FirstName: "مؤمن", LastName: "Hassan; Jr.", FullName: "مؤمن Hassan; Jr.",
		Organization: "Sheraton Makkah Jabal Al Kaaba Hotel", Title: "مدير المبيعات, الحج والعمرة",
		Note: "line one\nline two \\ end", Phone: "+966125456789", WhatsApp: "+966501234567",
		Email: "m@example.com", URL: "https://profile.example.com", Photo: photo,
		Revision: time.Date(2026, 10, 9, 8, 30, 0, 0, time.FixedZone("AST", 3*3600)),
	}
	card := c.Encode()

	for i, l := range strings.Split(strings.TrimSuffix(string(card), "\r\n"), "\r\n") {
		if len(l) > maxLineOctets {
			t.Errorf("physical line %d has %d octets", i, len(l))
		}
		if !utf8.ValidString(l) {
			t.Errorf("physical line %d splits a UTF-8 character: %q", i, l)
		}
	}

	lines := unfold(t, card)
	want := []string{
		"BEGIN:VCARD",
		"VERSION:3.0",
		"PRODID:-//Sheraton Makkah//Digital Profile//EN",
		`N:Hassan\; Jr.;مؤمن;;;`,
		`FN:مؤمن Hassan\; Jr.`,
		"ORG:Sheraton Makkah Jabal Al Kaaba Hotel",
		`TITLE:مدير المبيعات\, الحج والعمرة`,
		"TEL;TYPE=CELL,VOICE,PREF:+966125456789",
		"item1.TEL;TYPE=CELL:+966501234567",
		"item1.X-ABLabel:WhatsApp",
		"EMAIL;TYPE=INTERNET,WORK:m@example.com",
		"URL:https://profile.example.com",
		`NOTE:line one\nline two \\ end`,
		"PHOTO;ENCODING=b;TYPE=JPEG:" + base64.StdEncoding.EncodeToString(photo),
		"REV:2026-10-09T05:30:00Z",
		"END:VCARD",
	}
	if strings.Join(lines, "\n") != strings.Join(want, "\n") {
		t.Errorf("card:\n%s\nwant:\n%s", strings.Join(lines, "\n"), strings.Join(want, "\n"))
	}
}

func TestCardEncode_OmitsEmptyFieldsAndDuplicateWhatsApp(t *testing.T) {
	t.Parallel()
	c := Card{FirstName: "Momen", FullName: "Momen", Phone: "+966125456789", WhatsApp: "+966125456789"}
	got := strings.Join(unfold(t, c.Encode()), "\n")
	want := "BEGIN:VCARD\nVERSION:3.0\nPRODID:-//Sheraton Makkah//Digital Profile//EN\nN:;Momen;;;\nFN:Momen\nTEL;TYPE=CELL,VOICE,PREF:+966125456789\nEND:VCARD"
	if got != want {
		t.Errorf("card:\n%s\nwant:\n%s", got, want)
	}
}

func TestWriteFolded_UTF8Boundaries(t *testing.T) {
	t.Parallel()
	// Two-byte Arabic letters after an odd prefix force cuts that would split a character.
	s := "TITLE:" + strings.Repeat("م", 200)
	var b bytes.Buffer
	writeFolded(&b, s)
	physical := strings.Split(strings.TrimSuffix(b.String(), "\r\n"), "\r\n")
	if len(physical) < 5 {
		t.Fatalf("expected folding, got %d lines", len(physical))
	}
	for i, l := range physical {
		if len(l) > maxLineOctets || !utf8.ValidString(l) {
			t.Errorf("line %d: %d octets, valid=%v", i, len(l), utf8.ValidString(l))
		}
		if i > 0 && !strings.HasPrefix(l, " ") {
			t.Errorf("continuation line %d must start with a space", i)
		}
	}
	if got := strings.ReplaceAll(strings.TrimSuffix(b.String(), "\r\n"), "\r\n ", ""); got != s {
		t.Error("unfolding does not restore the line")
	}
}

func TestFilename(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"Momen Hassan": `attachment; filename="Momen-Hassan.vcf"; filename*=UTF-8''Momen%20Hassan.vcf`,
		"Momen":        `attachment; filename="Momen.vcf"`,
		"مؤمن حسن":     `attachment; filename="contact.vcf"; filename*=UTF-8''%D9%85%D8%A4%D9%85%D9%86%20%D8%AD%D8%B3%D9%86.vcf`,
		`a"b\c`:        `attachment; filename="abc.vcf"; filename*=UTF-8''a%22b%5Cc.vcf`,
	}
	for in, want := range cases {
		if got := Filename(in); got != want {
			t.Errorf("Filename(%q) = %s\nwant %s", in, got, want)
		}
	}
}
