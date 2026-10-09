package media_test

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/media"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/imaging"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/storage"
)

const gpsSecret = "GPS-48.8584N-2.2945E"

type env struct {
	svc   *media.Service
	pool  *pgxpool.Pool
	store *storage.Local
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
	return &env{svc: media.NewService(pool, st, proc, "", slog.New(slog.DiscardHandler)), pool: pool, store: st}
}

func gradient(w, h int, seed uint8) image.Image {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.SetNRGBA(x, y, color.NRGBA{R: uint8(x * 255 / w), G: uint8(y * 255 / h), B: seed, A: 255})
		}
	}
	return img
}

// photo returns a JPEG carrying an EXIF segment with a recognizable GPS marker.
func photo(t *testing.T, w, h int, seed uint8) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, gradient(w, h, seed), &jpeg.Options{Quality: 85}); err != nil {
		t.Fatal(err)
	}
	payload := append([]byte("Exif\x00\x00MM\x00\x2a\x00\x00\x00\x08\x00\x00"), gpsSecret...)
	seg := make([]byte, 4, 4+len(payload))
	seg[0], seg[1] = 0xFF, 0xE1
	binary.BigEndian.PutUint16(seg[2:], uint16(len(payload)+2))
	seg = append(seg, payload...)
	data := buf.Bytes()
	return append(append(append([]byte{}, data[:2]...), seg...), data[2:]...)
}

func pngImage(t *testing.T, w, h int, seed uint8) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, gradient(w, h, seed)); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func wantKind(t *testing.T, err error, kind apperr.Kind) {
	t.Helper()
	if got := apperr.KindOf(err); got != kind {
		t.Fatalf("error kind = %v, want %v (err: %v)", got, kind, err)
	}
}

func fileName(url string) string { return url[strings.LastIndex(url, "/")+1:] }

func TestUpload_RendersVariantsWithoutMetadata(t *testing.T) {
	e := newEnv(t)
	src := photo(t, 2000, 1000, 1)
	m, created, err := e.svc.Upload(t.Context(), "../../holiday photo.jpg", src)
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if !created {
		t.Error("created = false for a new image")
	}
	if m.Width != 2000 || m.Height != 1000 || m.SourceType != imaging.TypeJPEG || m.SourceBytes != int64(len(src)) {
		t.Errorf("media = %+v", m)
	}
	if m.OriginalFilename != "holiday photo.jpg" {
		t.Errorf("filename = %q, want directories stripped", m.OriginalFilename)
	}
	if !strings.HasPrefix(m.Placeholder, "data:image/webp;base64,") {
		t.Errorf("placeholder = %.40q", m.Placeholder)
	}
	wantWidths := []int{480, 960, 1600}
	if len(m.Variants) != len(wantWidths) {
		t.Fatalf("variants = %+v", m.Variants)
	}
	for i, v := range m.Variants {
		if v.Width != wantWidths[i] || v.Height != wantWidths[i]/2 {
			t.Errorf("variant %d = %dx%d", i, v.Width, v.Height)
		}
		if !strings.HasPrefix(v.URL, media.PublicPath) || !strings.HasSuffix(v.URL, ".webp") {
			t.Errorf("url = %q", v.URL)
		}
		rc, obj, err := e.svc.OpenVariant(t.Context(), fileName(v.URL))
		if err != nil {
			t.Fatalf("OpenVariant: %v", err)
		}
		data, _ := io.ReadAll(rc)
		_ = rc.Close()
		if obj.Size != v.ByteSize || int64(len(data)) != v.ByteSize || obj.ContentType != "image/webp" {
			t.Errorf("object = %+v, %d bytes, want %d", obj, len(data), v.ByteSize)
		}
		if bytes.Contains(data, []byte("EXIF")) || bytes.Contains(data, []byte(gpsSecret)) {
			t.Errorf("variant %d still carries EXIF/GPS metadata", i)
		}
		if cfg, format, err := image.DecodeConfig(bytes.NewReader(data)); err != nil || format != "webp" || cfg.Width != v.Width {
			t.Errorf("variant %d decodes as %s %dx%d (%v)", i, format, cfg.Width, cfg.Height, err)
		}
	}
}

func TestUpload_SmallImageIsNotUpscaled(t *testing.T) {
	e := newEnv(t)
	m, _, err := e.svc.Upload(t.Context(), "icon.png", pngImage(t, 300, 200, 2))
	if err != nil {
		t.Fatalf("Upload: %v", err)
	}
	if len(m.Variants) != 1 || m.Variants[0].Width != 300 || m.Variants[0].Height != 200 {
		t.Errorf("variants = %+v, want a single 300x200 rendition", m.Variants)
	}
}

func TestUpload_SameBytesReturnExistingImage(t *testing.T) {
	e := newEnv(t)
	src := pngImage(t, 640, 480, 3)
	first, _, err := e.svc.Upload(t.Context(), "a.png", src)
	if err != nil {
		t.Fatal(err)
	}
	again, created, err := e.svc.Upload(t.Context(), "b.png", src)
	if err != nil {
		t.Fatal(err)
	}
	if created || again.ID != first.ID || again.OriginalFilename != "a.png" {
		t.Errorf("re-upload = %+v created=%v, want the first image", again, created)
	}
	if items, _, _ := e.svc.List(t.Context(), 10, ""); len(items) != 1 {
		t.Errorf("library has %d images, want 1", len(items))
	}
}

func TestUpload_RejectsNonImages(t *testing.T) {
	e := newEnv(t)
	valid := photo(t, 800, 600, 4)
	for name, data := range map[string][]byte{
		"report.pdf": []byte("<!DOCTYPE html><html><script>alert(1)</script></html>"),
		"real.pdf":   []byte("%PDF-1.7\n1 0 obj <<>> endobj"),
		"logo.svg":   []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`),
		"broken.jpg": valid[:len(valid)/3],
		"empty.png":  {},
	} {
		_, _, err := e.svc.Upload(t.Context(), name, data)
		wantKind(t, err, apperr.KindInvalid)
		ae, _ := apperr.As(err)
		if len(ae.Fields) != 1 || ae.Fields[0].Field != "file" {
			t.Errorf("%s: fields = %+v", name, ae.Fields)
		}
	}
	if items, _, _ := e.svc.List(t.Context(), 10, ""); len(items) != 0 {
		t.Errorf("rejected uploads created %d images", len(items))
	}
}

func TestAltText(t *testing.T) {
	e := newEnv(t)
	m, _, err := e.svc.Upload(t.Context(), "a.png", pngImage(t, 100, 100, 5))
	if err != nil {
		t.Fatal(err)
	}
	got, err := e.svc.UpdateAltText(t.Context(), m.ID, map[string]string{"en": "  A lighthouse at dusk ", "ar": "منارة عند الغسق"})
	if err != nil {
		t.Fatal(err)
	}
	if got.AltText["en"] != "A lighthouse at dusk" || got.AltText["ar"] != "منارة عند الغسق" || len(got.AltText) != 2 {
		t.Errorf("alt text = %v", got.AltText)
	}
	got, err = e.svc.UpdateAltText(t.Context(), m.ID, map[string]string{"id": "Mercusuar"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.AltText) != 1 || got.AltText["id"] != "Mercusuar" {
		t.Errorf("alt text = %v, want a full replacement", got.AltText)
	}

	_, err = e.svc.UpdateAltText(t.Context(), m.ID, map[string]string{"en": "   ", "id": strings.Repeat("ş", 301)})
	wantKind(t, err, apperr.KindInvalid)
	if ae, _ := apperr.As(err); len(ae.Fields) != 2 {
		t.Errorf("fields = %+v", ae.Fields)
	}
	_, err = e.svc.UpdateAltText(t.Context(), uuid.New(), map[string]string{"en": "x"})
	wantKind(t, err, apperr.KindNotFound)
}

func TestList_PagesNewestFirst(t *testing.T) {
	e := newEnv(t)
	ids := make([]uuid.UUID, 0, 5)
	for i := range 5 {
		m, _, err := e.svc.Upload(t.Context(), "p.png", pngImage(t, 64, 64, uint8(10+i)))
		if err != nil {
			t.Fatal(err)
		}
		ids = append(ids, m.ID)
	}
	var seen []uuid.UUID
	cursor := ""
	for pages := 0; ; pages++ {
		if pages > 3 {
			t.Fatal("pagination does not terminate")
		}
		items, next, err := e.svc.List(t.Context(), 2, cursor)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range items {
			seen = append(seen, m.ID)
		}
		if next == "" {
			break
		}
		cursor = next
	}
	if len(seen) != 5 {
		t.Fatalf("listed %d images, want 5", len(seen))
	}
	for i := range seen {
		if seen[i] != ids[len(ids)-1-i] {
			t.Errorf("position %d = %s, want newest first", i, seen[i])
		}
	}
	_, _, err := e.svc.List(t.Context(), 2, "bm90LWEtY3Vyc29y")
	wantKind(t, err, apperr.KindBadRequest)
}

func TestDelete(t *testing.T) {
	e := newEnv(t)
	m, _, err := e.svc.Upload(t.Context(), "a.png", pngImage(t, 1200, 600, 6))
	if err != nil {
		t.Fatal(err)
	}
	// Stands in for content tables (projects, posts) that reference the library.
	if _, err := e.pool.Exec(t.Context(), `CREATE TABLE usage_test (media_id uuid REFERENCES media (id))`); err != nil {
		t.Fatal(err)
	}
	if _, err := e.pool.Exec(t.Context(), `INSERT INTO usage_test VALUES ($1)`, m.ID); err != nil {
		t.Fatal(err)
	}
	wantKind(t, e.svc.Delete(t.Context(), m.ID), apperr.KindConflict)
	if _, err := e.svc.Get(t.Context(), m.ID); err != nil {
		t.Fatalf("image in use was deleted: %v", err)
	}

	if _, err := e.pool.Exec(t.Context(), `DELETE FROM usage_test`); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Delete(t.Context(), m.ID); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	wantKind(t, e.svc.Delete(t.Context(), m.ID), apperr.KindNotFound)
	for _, v := range m.Variants {
		_, _, err := e.store.Get(t.Context(), "media/"+fileName(v.URL))
		if err == nil {
			t.Errorf("%s still stored after delete", v.URL)
		}
	}
}

func TestOpenVariant_OnlyServesRegisteredFiles(t *testing.T) {
	e := newEnv(t)
	stray := strings.Repeat("ab", 32) + ".webp"
	if err := e.store.Put(t.Context(), "media/"+stray, strings.NewReader("x"), 1, "image/webp"); err != nil {
		t.Fatal(err)
	}
	for _, file := range []string{stray, "../secret.webp", "x.webp", ""} {
		_, _, err := e.svc.OpenVariant(t.Context(), file)
		wantKind(t, err, apperr.KindNotFound)
	}
}

func TestSanitizeFilename(t *testing.T) {
	for in, want := range map[string]string{
		`C:\Users\me\IMG_01.HEIC`: "IMG_01.HEIC",
		"a/b/../c.png":            "c.png",
		"tab\there\x00.jpg":       "tabhere.jpg",
		"..":                      "image",
		"   ":                     "image",
		"ürün görseli.webp":       "ürün görseli.webp",
	} {
		if got := media.SanitizeFilename(in); got != want {
			t.Errorf("SanitizeFilename(%q) = %q, want %q", in, got, want)
		}
	}
	if got := media.SanitizeFilename(strings.Repeat("ğ", 300)); len(got) > 255 || !strings.HasPrefix(got, "ğ") {
		t.Errorf("long name not truncated on a rune boundary: %d bytes", len(got))
	}
}
