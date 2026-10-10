package profile_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
)

func (e *env) square(t *testing.T, shade uint8) uuid.UUID {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 600, 600))
	for y := range 600 {
		for x := range 600 {
			img.SetNRGBA(x, y, color.NRGBA{R: shade, G: uint8(x / 3), B: uint8(y / 3), A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	m, _, err := e.media.Upload(context.Background(), "card.png", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	return m.ID
}

func detailedInput(portrait, cardPhoto *uuid.UUID) profile.Input {
	in := fullInput(portrait)
	in.VCardPhotoMediaID = cardPhoto
	in.PostalCode = " 24231 "
	in.MapURL = "https://maps.app.goo.gl/sheraton"
	in.LinkedInURL = "https://www.linkedin.com/in/momen"
	in.Translations["en"] = profile.Translation{
		Title: "Director of Sales",
		Address: profile.Address{
			Street: "Ibrahim Al Khalil Street", City: "Makkah", Country: "Saudi Arabia",
		},
	}
	in.Translations["ar"] = profile.Translation{Title: "مدير المبيعات", DisplayName: "مؤمن توفيق الكسواني"}
	return in
}

func TestUpdate_DetailsRoundTrip(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid, cid := e.portrait(t), e.square(t, 200)

	p, err := e.svc.Update(ctx, detailedInput(&pid, &cid))
	if err != nil {
		t.Fatal(err)
	}
	if p.VCardPhoto == nil || p.VCardPhoto.ID != cid || p.CardPhoto().ID != cid {
		t.Errorf("card photo = %+v", p.VCardPhoto)
	}
	if p.PostalCode != "24231" || p.MapURL == "" || p.LinkedInURL != "https://www.linkedin.com/in/momen" {
		t.Errorf("details = %q %q %q", p.PostalCode, p.MapURL, p.LinkedInURL)
	}
	if got := p.NameIn(p.Translations["ar"]); got != "مؤمن توفيق الكسواني" {
		t.Errorf("arabic name = %q", got)
	}
	if got := p.NameIn(p.Translations["en"]); got != "Momen Hassan" {
		t.Errorf("english name = %q", got)
	}
	// Arabic has no address of its own: the English one stands in.
	if got := p.AddressIn(p.Translations["ar"]); got.City != "Makkah" {
		t.Errorf("arabic address = %+v", got)
	}

	// The card photo is in use like the portrait.
	wantKind(t, e.media.Delete(ctx, cid), apperr.KindConflict)

	// Without a card photo the portrait is used.
	p, err = e.svc.Update(ctx, detailedInput(&pid, nil))
	if err != nil {
		t.Fatal(err)
	}
	if p.VCardPhoto != nil || p.CardPhoto().ID != pid {
		t.Errorf("card photo after clearing = %+v", p.VCardPhoto)
	}
	if err := e.media.Delete(ctx, cid); err != nil {
		t.Errorf("delete the unused image: %v", err)
	}
}

func TestUpdate_DetailsValidation(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid := e.portrait(t)
	missing := uuid.New()

	in := detailedInput(&pid, &missing)
	in.MapURL = "http://maps.example.com"
	in.LinkedInURL = "https://evil.example.com/linkedin.com"
	in.PostalCode = strings.Repeat("9", 21)
	tr := in.Translations["en"]
	tr.Address.City = "Mak\nkah"
	in.Translations["en"] = tr

	_, err := e.svc.Update(ctx, in)
	wantKind(t, err, apperr.KindInvalid)
	ae, _ := apperr.As(err)
	got := map[string]bool{}
	for _, f := range ae.Fields {
		got[f.Field] = true
	}
	for _, field := range []string{"mapUrl", "linkedinUrl", "postalCode", "translations.en.address.city", "vcardPhotoMediaId"} {
		if !got[field] {
			t.Errorf("no error for %s (got %v)", field, ae.Fields)
		}
	}
}

func TestVCard_DetailsAndCardPhoto(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid, cid := e.portrait(t), e.square(t, 10)
	if _, err := e.svc.Update(ctx, detailedInput(&pid, &cid)); err != nil {
		t.Fatal(err)
	}
	_, card, err := e.svc.VCard(ctx, "ar")
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ReplaceAll(string(card), "\r\n ", "")
	for _, want := range []string{
		"\r\nN:Hassan;Momen;;;\r\n",
		"\r\nFN:مؤمن توفيق الكسواني\r\n",
		"\r\nADR;TYPE=WORK:;;Ibrahim Al Khalil Street;Makkah;;24231;Saudi Arabia\r\n",
		"\r\nX-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/momen\r\n",
		"\r\nPHOTO;ENCODING=b;TYPE=JPEG:",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("card lacks %q:\n%s", want, text)
		}
	}
}
