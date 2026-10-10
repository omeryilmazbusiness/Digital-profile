package validation_test

import (
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

func TestHTTPSURL(t *testing.T) {
	t.Parallel()
	ok := map[string]string{
		"": "",
		"\thttps://my.matterport.com/show/?m=x\n": "https://my.matterport.com/show/?m=x",
		"https://maps.app.goo.gl/abc":             "https://maps.app.goo.gl/abc",
	}
	for in, want := range ok {
		if got, err := validation.HTTPSURL(in); err != nil || got != want {
			t.Errorf("HTTPSURL(%q) = %q, %v", in, got, err)
		}
	}
	for _, in := range []string{
		"http://example.com", "javascript:alert(1)", "https://", "//example.com", "example.com",
		"https://user:pw@example.com", "https://exa mple.com", "https://x.com/" + strings.Repeat("a", 500),
	} {
		if _, err := validation.HTTPSURL(in); err == nil {
			t.Errorf("HTTPSURL(%q) accepted", in)
		}
	}
}

func TestFields(t *testing.T) {
	t.Parallel()
	var v validation.Fields
	if got := v.SingleLine("a", "  x  ", 1, 5); got != "x" {
		t.Errorf("SingleLine = %q", got)
	}
	if got := v.MultiLine("b", "1\r\n2", 10); got != "1\n2" {
		t.Errorf("MultiLine = %q", got)
	}
	if v.Err() != nil {
		t.Fatalf("unexpected errors: %v", v.List())
	}
	v.SingleLine("c", "", 1, 5)
	v.SingleLine("d", "two\nlines", 0, 50)
	v.MultiLine("e", "toolong", 3)
	v.MultiLine("f", "bell\a", 30)
	v.HTTPSURL("g", "http://x")
	err := v.Err()
	if apperr.KindOf(err) != apperr.KindInvalid || len(v.List()) != 5 {
		t.Errorf("err = %v, fields = %+v", err, v.List())
	}
}
