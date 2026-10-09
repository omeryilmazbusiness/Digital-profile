package profile

import (
	"slices"
	"strings"
	"testing"
)

func TestNormalizePhone(t *testing.T) {
	t.Parallel()
	valid := map[string]string{
		"+966 12 545 6789":    "+966125456789",
		"00966 50 123 4567":   "+966501234567",
		" +90 (532) 123-4567": "+905321234567",
		"+62 812-3456-7890":   "+6281234567890",
		"":                    "",
	}
	for in, want := range valid {
		got, err := NormalizePhone(in)
		if err != nil || got != want {
			t.Errorf("NormalizePhone(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"050 123 4567", "+1 23", "+966 abc", "+999 123456789"} {
		if got, err := NormalizePhone(in); err == nil {
			t.Errorf("NormalizePhone(%q) = %q, want an error", in, got)
		}
	}
}

func TestDisplayPhone(t *testing.T) {
	t.Parallel()
	if got := DisplayPhone("+966125456789"); got != "+966 12 545 6789" {
		t.Errorf("DisplayPhone = %q", got)
	}
}

func TestNormalizeEmail(t *testing.T) {
	t.Parallel()
	if got, err := NormalizeEmail(" Momen.Hassan@Marriott.COM "); err != nil || got != "Momen.Hassan@marriott.com" {
		t.Errorf("NormalizeEmail = %q, %v", got, err)
	}
	for _, in := range []string{"momen", "Momen <m@example.com>", "a@b", "a b@example.com", strings.Repeat("a", 250) + "@x.com"} {
		if got, err := NormalizeEmail(in); err == nil {
			t.Errorf("NormalizeEmail(%q) = %q, want an error", in, got)
		}
	}
}

func TestWhatsAppURL(t *testing.T) {
	t.Parallel()
	if got := WhatsAppURL("+966501234567", ""); got != "https://wa.me/966501234567" {
		t.Errorf("no message: %q", got)
	}
	got := WhatsAppURL("+966501234567", "السلام عليكم & hi+")
	want := "https://wa.me/966501234567?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85%20%26%20hi%2B"
	if got != want {
		t.Errorf("WhatsAppURL = %q\nwant %q", got, want)
	}
}

func TestNormalize(t *testing.T) {
	t.Parallel()
	in := Input{
		FirstName: "  Momen ", LastName: "Hassan", Phone: "+966 12 545 6789",
		Languages: []string{"tr", "ar", "tr"},
		Translations: map[string]Translation{
			"ar": {Title: " مدير المبيعات ", Bio: "سطر\r\nسطر"},
		},
	}
	out, fields := normalize(in)
	if len(fields) > 0 {
		t.Fatalf("unexpected errors: %+v", fields)
	}
	if out.FirstName != "Momen" || out.Phone != "+966125456789" {
		t.Errorf("not normalized: %+v", out)
	}
	if !slices.Equal(out.Languages, []string{"tr", "ar"}) {
		t.Errorf("languages = %v, want deduplicated in order", out.Languages)
	}
	if tr := out.Translations["ar"]; tr.Title != "مدير المبيعات" || tr.Bio != "سطر\nسطر" {
		t.Errorf("translation = %+v", tr)
	}

	if out, _ := normalize(Input{FirstName: "A"}); !slices.Equal(out.Languages, DefaultLanguages) {
		t.Errorf("nil languages = %v, want defaults", out.Languages)
	}
	if out, _ := normalize(Input{FirstName: "A", Languages: []string{}}); len(out.Languages) != 0 {
		t.Errorf("empty languages = %v, want none", out.Languages)
	}
}

func TestNormalize_ReportsEveryField(t *testing.T) {
	t.Parallel()
	_, fields := normalize(Input{
		FirstName: " ", LastName: "a\nb", Phone: "0501234567", WhatsApp: "+1", Email: "x",
		Languages: []string{"xx"},
		Translations: map[string]Translation{
			"en": {Title: "", Tagline: strings.Repeat("a", 161)},
			"fr": {Title: "x"},
		},
	})
	got := map[string]bool{}
	for _, f := range fields {
		got[f.Field] = true
	}
	for _, want := range []string{
		"firstName", "lastName", "phone", "whatsapp", "email", "languages",
		"translations.en.title", "translations.en.tagline", "translations",
	} {
		if !got[want] {
			t.Errorf("missing error for %s (got %+v)", want, fields)
		}
	}
}

func TestProfile_MissingAndLocalized(t *testing.T) {
	t.Parallel()
	p := Profile{FirstName: "Momen"}
	if got := p.Missing(); !slices.Equal(got, []string{MissingTitle, MissingContact}) {
		t.Errorf("Missing = %v", got)
	}
	p.Email = "m@example.com"
	p.Translations = map[string]Translation{"ar": {Title: "مدير"}, "id": {Title: "Direktur"}}
	if !p.Complete() {
		t.Errorf("profile with a title and an e-mail must be complete, missing %v", p.Missing())
	}
	if loc, tr := p.Localized("ar"); loc != "ar" || tr.Title != "مدير" {
		t.Errorf("Localized(ar) = %s %+v", loc, tr)
	}
	// English is absent: fall back to the next locale in order (id before ar).
	if loc, tr := p.Localized("en"); loc != "id" || tr.Title != "Direktur" {
		t.Errorf("Localized(en) = %s %+v", loc, tr)
	}
}
