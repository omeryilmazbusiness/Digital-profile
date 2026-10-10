package discover

import (
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

// testPDF is a minimal well-formed PDF with n pages.
func testPDF(n int) []byte {
	var b strings.Builder
	b.WriteString("%PDF-1.7\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n")
	b.WriteString("2 0 obj << /Type /Pages /Count 1 >> endobj\n")
	for range n {
		b.WriteString("3 0 obj << /Type /Page /Parent 2 0 R >> endobj\n")
	}
	b.WriteString("trailer << /Root 1 0 R >>\n%%EOF\n")
	return []byte(b.String())
}

func TestInspectPDF(t *testing.T) {
	t.Parallel()
	if n, err := inspectPDF(testPDF(3)); err != nil || n != 3 {
		t.Errorf("inspectPDF(3 pages) = %d, %v", n, err)
	}
	if n, err := inspectPDF([]byte("%PDF-1.4\n/Type/Page>>\n%%EOF")); err != nil || n != 1 {
		t.Errorf("compact page object = %d, %v", n, err)
	}
	if n, err := inspectPDF([]byte("%PDF-1.5\n<< /Type /ObjStm >>\n%%EOF")); err != nil || n != 0 {
		t.Errorf("compressed objects = %d, %v; want 0 (unknown)", n, err)
	}
	for name, data := range map[string][]byte{
		"html":      []byte("<html><body onload=alert(1)>%%EOF"),
		"empty":     {},
		"truncated": []byte("%PDF-1.7\n1 0 obj << /Type /Page >>"),
	} {
		if _, err := inspectPDF(data); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: err = %v, want invalid", name, err)
		}
	}
}

func TestPDFFileName(t *testing.T) {
	t.Parallel()
	cases := map[string]string{
		"Groups & Umrah.pdf":         "Groups & Umrah",
		"Brochure.PDF":               "Brochure",
		`C:\Users\me\Rates 2026.pdf`: "Rates 2026",
		"../../etc/passwd":           "passwd",
		"a\"b\x00c.pdf":              "abc",
		".pdf":                       "document",
		"":                           "document",
		"عروض رمضان.pdf":             "عروض رمضان",
	}
	for in, want := range cases {
		if got := pdfFileName(in); got != want {
			t.Errorf("pdfFileName(%q) = %q, want %q", in, got, want)
		}
	}
	if got := pdfFileName(strings.Repeat("ğ", 400) + ".pdf"); len([]rune(got)) != maxFileNameLen-4 {
		t.Errorf("long name kept %d runes", len([]rune(got)))
	}
}

func TestNormalizeSection(t *testing.T) {
	t.Parallel()
	out, err := normalizeSection(map[string]SectionText{
		"en": {Eyebrow: " Groups ", Title: " Umrah groups ", Body: "One.\r\n\r\nTwo."},
	})
	if err != nil || out["en"] != (SectionText{Eyebrow: "Groups", Title: "Umrah groups", Body: "One.\n\nTwo."}) {
		t.Errorf("normalizeSection = %+v, %v", out, err)
	}
	for name, in := range map[string]map[string]SectionText{
		"none":        {},
		"blank title": {"ar": {Title: "  "}},
		"bad locale":  {"fr": {Title: "Groupes"}},
		"long body":   {"id": {Title: "Grup", Body: strings.Repeat("a", maxBodyRunes+1)}},
		"two lines":   {"en": {Title: "a\nb"}},
	} {
		if _, err := normalizeSection(in); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: err = %v, want invalid", name, err)
		}
	}
}

func TestNormalizeDocument(t *testing.T) {
	t.Parallel()
	if _, err := normalizeDocument(DocumentInput{Language: "ar", Titles: map[string]string{"en": "Rates"}}); err != nil {
		t.Errorf("valid input: %v", err)
	}
	for name, in := range map[string]DocumentInput{
		"no title":     {Language: "en", Titles: map[string]string{}},
		"bad language": {Language: "fr", Titles: map[string]string{"en": "Rates"}},
		"blank title":  {Language: "en", Titles: map[string]string{"en": " "}},
	} {
		if _, err := normalizeDocument(in); apperr.KindOf(err) != apperr.KindInvalid {
			t.Errorf("%s: err = %v, want invalid", name, err)
		}
	}
}

func TestCheckOrder(t *testing.T) {
	t.Parallel()
	a, b := uuid.New(), uuid.New()
	if err := checkOrder([]uuid.UUID{a, b}, []uuid.UUID{b, a}); err != nil {
		t.Errorf("permutation: %v", err)
	}
	for name, ids := range map[string][]uuid.UUID{
		"missing":   {a},
		"duplicate": {a, a},
		"unknown":   {a, uuid.New()},
	} {
		if err := checkOrder([]uuid.UUID{a, b}, ids); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestLocalizedFallback(t *testing.T) {
	t.Parallel()
	s := Section{Translations: map[string]SectionText{"ar": {Title: "مجموعات"}, "id": {Title: "Grup"}}}
	if got, _ := s.Localized("ar"); got.Title != "مجموعات" {
		t.Errorf("ar = %q", got.Title)
	}
	if got, _ := s.Localized("en"); got.Title != "Grup" {
		t.Errorf("en falls back to id first, got %q", got.Title)
	}
	if _, ok := (&Section{}).Localized("en"); ok {
		t.Error("a topic without text must not be shown")
	}
}
