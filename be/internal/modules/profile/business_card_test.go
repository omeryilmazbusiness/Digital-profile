package profile_test

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/profile"
)

// card uploads a transparent landscape PNG with an opaque navy stripe across the top half.
func (e *env) card(t *testing.T) uuid.UUID {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, 2100, 1200))
	for y := range 600 {
		for x := range 2100 {
			img.SetNRGBA(x, y, color.NRGBA{R: 20, G: 30, B: 90, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	m, _, err := e.media.Upload(context.Background(), "business-card.png", buf.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	return m.ID
}

func withCard(portrait, card *uuid.UUID) profile.Input {
	in := fullInput(portrait)
	in.BusinessCardMediaID = card
	return in
}

func TestBusinessCard_RoundTripAndInUse(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid, cid := e.portrait(t), e.card(t)

	p, err := e.svc.Update(ctx, withCard(&pid, &cid))
	if err != nil {
		t.Fatal(err)
	}
	if p.BusinessCard == nil || p.BusinessCard.ID != cid {
		t.Fatalf("business card = %+v", p.BusinessCard)
	}
	pub := profile.ToPublicAPI(&p, "ar")
	if pub.BusinessCardUrl == nil || *pub.BusinessCardUrl != profile.BusinessCardPath+"?locale=ar" {
		t.Errorf("businessCardUrl = %v", pub.BusinessCardUrl)
	}
	wantKind(t, e.media.Delete(ctx, cid), apperr.KindConflict)

	p, err = e.svc.Update(ctx, withCard(&pid, nil))
	if err != nil {
		t.Fatal(err)
	}
	if p.BusinessCard != nil || profile.ToPublicAPI(&p, "en").BusinessCardUrl != nil {
		t.Errorf("business card after clearing = %+v", p.BusinessCard)
	}
	_, err = e.svc.BusinessCard(ctx)
	wantKind(t, err, apperr.KindNotFound)
	if err := e.media.Delete(ctx, cid); err != nil {
		t.Errorf("delete the unused image: %v", err)
	}
}

func TestBusinessCard_UnknownImage(t *testing.T) {
	e := newEnv(t)
	pid, missing := e.portrait(t), uuid.New()
	_, err := e.svc.Update(context.Background(), withCard(&pid, &missing))
	wantKind(t, err, apperr.KindInvalid)
	ae, _ := apperr.As(err)
	if len(ae.Fields) != 1 || ae.Fields[0].Field != "businessCardMediaId" {
		t.Errorf("fields = %+v", ae.Fields)
	}
}

func TestBusinessCard_NotPublished(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	_, err := e.svc.BusinessCard(ctx)
	wantKind(t, err, apperr.KindNotFound)

	// An incomplete profile stays private, card or not.
	cid := e.card(t)
	if _, err := e.svc.Update(ctx, profile.Input{FirstName: "Momen", BusinessCardMediaID: &cid}); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.BusinessCard(ctx)
	wantKind(t, err, apperr.KindNotFound)
}

func TestGetProfileBusinessCard(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	pid, cid := e.portrait(t), e.card(t)
	if _, err := e.svc.Update(ctx, withCard(&pid, &cid)); err != nil {
		t.Fatal(err)
	}
	h := profile.NewHandler(e.svc)

	res, err := h.GetProfileBusinessCard(ctx, api.GetProfileBusinessCardRequestObject{})
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	if err := res.VisitGetProfileBusinessCardResponse(rec); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	hd := rec.Header()
	if hd.Get("Content-Type") != "image/jpeg" || hd.Get("Cache-Control") != "public, no-cache" {
		t.Errorf("headers = %v", hd)
	}
	if d := hd.Get("Content-Disposition"); !strings.HasPrefix(d, "attachment") ||
		!strings.Contains(d, `filename="Momen-Hassan-business-card.jpg"`) ||
		!strings.Contains(d, "Momen%20Hassan%20business%20card.jpg") {
		t.Errorf("Content-Disposition = %q", d)
	}
	etag := hd.Get("ETag")
	if etag != `"`+cid.String()+`"` {
		t.Errorf("ETag = %q", etag)
	}
	img, err := jpeg.Decode(rec.Body)
	if err != nil {
		t.Fatalf("body is not a JPEG: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 1600 || b.Dy() != 914 {
		t.Errorf("size = %v, want 1600x914", b)
	}
	// Transparency lands on white; the opaque stripe keeps its colour.
	if r, g, b, _ := img.At(800, 800).RGBA(); r>>8 < 245 || g>>8 < 245 || b>>8 < 245 {
		t.Errorf("transparent area = %d,%d,%d, want white", r>>8, g>>8, b>>8)
	}
	if _, _, b, _ := img.At(800, 100).RGBA(); b>>8 < 70 || b>>8 > 110 {
		t.Errorf("stripe blue = %d", b>>8)
	}

	res, err = h.GetProfileBusinessCard(ctx, api.GetProfileBusinessCardRequestObject{
		Params: api.GetProfileBusinessCardParams{IfNoneMatch: &etag},
	})
	if err != nil {
		t.Fatal(err)
	}
	rec = httptest.NewRecorder()
	if err := res.VisitGetProfileBusinessCardResponse(rec); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusNotModified || rec.Body.Len() != 0 {
		t.Errorf("conditional request: status %d, %d bytes", rec.Code, rec.Body.Len())
	}
}
