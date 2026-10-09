package profile_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"log/slog"
	"slices"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/imaging"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

const siteURL = "https://profile.example.com"

type env struct {
	svc   *profile.Service
	media *media.Service
}

func newEnv(t *testing.T) *env {
	t.Helper()
	t.Parallel()
	pool := dbtest.New(t)
	st, err := storage.NewLocal(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = st.Close() })
	proc, err := imaging.NewProcessor(imaging.Options{MaxPixels: 20_000_000, Quality: 75, Concurrency: 2})
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.DiscardHandler)
	m := media.NewService(pool, st, proc, "", log)
	return &env{svc: profile.NewService(pool, m, siteURL, log), media: m}
}

func (e *env) portrait(t *testing.T) uuid.UUID {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 1000, 1400))
	for y := range 1400 {
		for x := range 1000 {
			img.SetNRGBA(x, y, color.NRGBA{R: uint8(x / 4), G: uint8(y / 6), B: 90, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
		t.Fatal(err)
	}
	m, _, err := e.media.Upload(context.Background(), "portrait.jpg", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	return m.ID
}

func wantKind(t *testing.T, err error, kind apperr.Kind) {
	t.Helper()
	if got := apperr.KindOf(err); got != kind {
		t.Fatalf("error kind = %v, want %v (err: %v)", got, kind, err)
	}
}

func fullInput(portrait *uuid.UUID) profile.Input {
	return profile.Input{
		FirstName: "Momen", LastName: "Hassan", Organization: "Sheraton Makkah Jabal Al Kaaba Hotel",
		PortraitMediaID: portrait,
		Phone:           "+966 12 545 6789", WhatsApp: "00966 50 123 4567", Email: "momen@example.com",
		Languages: []string{"ar", "en", "tr", "id"},
		Translations: map[string]profile.Translation{
			"en": {Title: "Director of Sales", Tagline: "Your stay, my promise", WhatsAppMessage: "Hello Momen"},
			"ar": {Title: "مدير المبيعات", Bio: "خبرة في الحج والعمرة"},
		},
	}
}

func TestGet_BeforeSetUp(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	_, err := e.svc.Get(ctx)
	wantKind(t, err, apperr.KindNotFound)
	_, err = e.svc.Published(ctx)
	wantKind(t, err, apperr.KindNotFound)
	_, _, err = e.svc.VCard(ctx, "en")
	wantKind(t, err, apperr.KindNotFound)
}

func TestUpdate_IncompleteProfileStaysUnpublished(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	p, err := e.svc.Update(ctx, profile.Input{FirstName: "Momen"})
	if err != nil {
		t.Fatal(err)
	}
	if p.Complete() || !slices.Equal(p.Missing(), []string{profile.MissingTitle, profile.MissingContact}) {
		t.Errorf("missing = %v", p.Missing())
	}
	if !slices.Equal(p.Languages, profile.DefaultLanguages) {
		t.Errorf("languages = %v, want defaults", p.Languages)
	}
	_, err = e.svc.Published(ctx)
	wantKind(t, err, apperr.KindNotFound)
}

func TestUpdate_ReplacesEverything(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid := e.portrait(t)

	p, err := e.svc.Update(ctx, fullInput(&pid))
	if err != nil {
		t.Fatal(err)
	}
	if p.Phone != "+966125456789" || p.WhatsApp != "+966501234567" {
		t.Errorf("numbers not in E.164: %q %q", p.Phone, p.WhatsApp)
	}
	if p.Portrait == nil || p.Portrait.ID != pid || len(p.Portrait.Variants) == 0 {
		t.Fatalf("portrait = %+v", p.Portrait)
	}
	if !p.Complete() || len(p.Translations) != 2 {
		t.Fatalf("profile = %+v", p)
	}
	first := p.UpdatedAt

	// Full replacement: Arabic and the portrait are dropped, the e-mail cleared.
	in := fullInput(nil)
	in.Email = ""
	delete(in.Translations, "ar")
	p, err = e.svc.Update(ctx, in)
	if err != nil {
		t.Fatal(err)
	}
	if p.Portrait != nil || p.Email != "" || len(p.Translations) != 1 {
		t.Errorf("not replaced: %+v", p)
	}
	if p.UpdatedAt.Before(first) {
		t.Errorf("updatedAt went backwards")
	}
	got, err := e.svc.Get(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got.FullName() != "Momen Hassan" || got.Translations["en"].Tagline != "Your stay, my promise" {
		t.Errorf("Get = %+v", got)
	}
}

func TestUpdate_Validation(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	missing := uuid.New()
	in := fullInput(&missing)
	in.Phone = "050 123 4567"
	_, err := e.svc.Update(ctx, in)
	wantKind(t, err, apperr.KindInvalid)
	var ae *apperr.Error
	if !errors.As(err, &ae) {
		t.Fatal("not an apperr")
	}
	fields := map[string]bool{}
	for _, f := range ae.Fields {
		fields[f.Field] = true
	}
	if !fields["portraitMediaId"] || !fields["phone"] {
		t.Errorf("fields = %+v", ae.Fields)
	}
	_, err = e.svc.Get(ctx)
	wantKind(t, err, apperr.KindNotFound)
}

func TestPortraitInUseCannotBeDeleted(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid := e.portrait(t)
	if _, err := e.svc.Update(ctx, fullInput(&pid)); err != nil {
		t.Fatal(err)
	}
	wantKind(t, e.media.Delete(ctx, pid), apperr.KindConflict)

	if _, err := e.svc.Update(ctx, fullInput(nil)); err != nil {
		t.Fatal(err)
	}
	if err := e.media.Delete(ctx, pid); err != nil {
		t.Fatalf("delete after the portrait was removed: %v", err)
	}
}

func TestVCard(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid := e.portrait(t)
	if _, err := e.svc.Update(ctx, fullInput(&pid)); err != nil {
		t.Fatal(err)
	}

	p, card, err := e.svc.VCard(ctx, "ar")
	if err != nil {
		t.Fatal(err)
	}
	if p.FullName() != "Momen Hassan" {
		t.Errorf("profile = %+v", p)
	}
	text := strings.ReplaceAll(string(card), "\r\n ", "")
	for _, want := range []string{
		"\r\nTITLE:مدير المبيعات\r\n",
		"\r\nTEL;TYPE=CELL,VOICE,PREF:+966125456789\r\n",
		"\r\nitem1.TEL;TYPE=CELL:+966501234567\r\n",
		"\r\nEMAIL;TYPE=INTERNET,WORK:momen@example.com\r\n",
		"\r\nURL:" + siteURL + "\r\n",
		"\r\nORG:Sheraton Makkah Jabal Al Kaaba Hotel\r\n",
	} {
		if !strings.Contains(text, want) {
			t.Errorf("card lacks %q:\n%s", want, text)
		}
	}

	_, b64, ok := strings.Cut(text, "PHOTO;ENCODING=b;TYPE=JPEG:")
	if !ok {
		t.Fatal("card has no photo")
	}
	b64, _, _ = strings.Cut(b64, "\r\n")
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(raw))
	if err != nil {
		t.Fatalf("photo is not a JPEG: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 512 || b.Dy() != 512 {
		t.Errorf("photo size = %v, want 512x512", b)
	}

	// English texts when asked, and the cached photo is reused.
	_, card2, err := e.svc.VCard(ctx, "en")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(card2), "TITLE:Director of Sales\r\n") || !strings.Contains(string(card2), "NOTE:Your stay\\, my promise\r\n") {
		t.Errorf("english card:\n%s", card2)
	}
}
