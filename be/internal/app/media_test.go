package app_test

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

func init() {
	openapi3filter.RegisterBodyDecoder("image/webp", openapi3filter.FileBodyDecoder)
}

func testPNG(t *testing.T, w, h int, seed uint8) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.SetNRGBA(x, y, color.NRGBA{R: uint8(x), G: uint8(y), B: seed, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func (b *browser) upload(field, filename string, data []byte) *httptest.ResponseRecorder {
	b.t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	if field != "" {
		fw, err := mw.CreateFormFile(field, filename)
		if err != nil {
			b.t.Fatal(err)
		}
		_, _ = fw.Write(data)
	}
	_ = mw.Close()
	req := httptest.NewRequestWithContext(b.t.Context(), http.MethodPost, "http://localhost/api/v1/admin/media", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return b.send(req)
}

func decodeMedia(t *testing.T, rec *httptest.ResponseRecorder) api.Media {
	t.Helper()
	var m api.Media
	if err := json.Unmarshal(rec.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode media: %v", err)
	}
	return m
}

func TestMediaHTTP_Lifecycle(t *testing.T) {
	env := newAuthEnv(t)
	admin := env.browser(t)

	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/media", ""), http.StatusUnauthorized)
	wantStatus(t, admin.upload("file", "a.png", testPNG(t, 64, 64, 1)), http.StatusUnauthorized)
	wantStatus(t, admin.login(adminPassword), http.StatusOK)

	rec := admin.upload("file", "Sunset.png", testPNG(t, 1000, 500, 1))
	wantStatus(t, rec, http.StatusCreated)
	m := decodeMedia(t, rec)
	if m.Width != 1000 || m.Height != 500 || len(m.Variants) != 3 || m.CreatedAt.Location() != time.UTC || m.OriginalFilename != "Sunset.png" {
		t.Fatalf("media = %+v", m)
	}
	wantStatus(t, admin.upload("file", "again.png", testPNG(t, 1000, 500, 1)), http.StatusOK)

	rec = admin.do(http.MethodPut, "/api/v1/admin/media/"+m.Id.String()+"/alt-text", `{"en":"Sunset over the sea","ar":"غروب الشمس"}`)
	wantStatus(t, rec, http.StatusOK)
	if got := decodeMedia(t, rec).AltText; got.En == nil || *got.En != "Sunset over the sea" || got.Id != nil {
		t.Errorf("alt text = %+v", got)
	}

	rec = admin.do(http.MethodGet, "/api/v1/admin/media?limit=1", "")
	wantStatus(t, rec, http.StatusOK)
	var page api.MediaPage
	_ = json.Unmarshal(rec.Body.Bytes(), &page)
	if len(page.Items) != 1 || page.NextCursor != nil {
		t.Errorf("page = %+v", page)
	}
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/media/"+m.Id.String(), ""), http.StatusOK)

	visitor := env.browser(t)
	visitor.headers = map[string]string{}
	url := m.Variants[0].Url
	rec = visitor.do(http.MethodGet, url, "")
	wantStatus(t, rec, http.StatusOK)
	h := rec.Header()
	etag := `"` + strings.TrimSuffix(url[strings.LastIndex(url, "/")+1:], ".webp") + `"`
	for name, want := range map[string]string{
		"Content-Type":                 "image/webp",
		"Content-Length":               strconv.FormatInt(m.Variants[0].ByteSize, 10),
		"Cache-Control":                "public, max-age=31536000, immutable",
		"ETag":                         etag,
		"Cross-Origin-Resource-Policy": "cross-origin",
		"X-Content-Type-Options":       "nosniff",
	} {
		if got := h.Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}

	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://localhost"+url, http.NoBody)
	req.Header.Set("If-None-Match", `W/"other", `+etag)
	rec = visitor.send(req)
	wantStatus(t, rec, http.StatusNotModified)
	if rec.Body.Len() != 0 || rec.Header().Get("Cache-Control") == "" {
		t.Errorf("304 body = %d bytes, cache-control = %q", rec.Body.Len(), rec.Header().Get("Cache-Control"))
	}

	wantStatus(t, admin.do(http.MethodDelete, "/api/v1/admin/media/"+m.Id.String(), ""), http.StatusNoContent)
	wantStatus(t, visitor.do(http.MethodGet, url, ""), http.StatusNotFound)
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/media/"+m.Id.String(), ""), http.StatusNotFound)
}

func TestMediaHTTP_RejectsBadUploads(t *testing.T) {
	env := newAuthEnvWith(t, map[string]string{"MEDIA_MAX_UPLOAD_BYTES": strconv.Itoa(1 << 20)})
	admin := env.browser(t)
	wantStatus(t, admin.login(adminPassword), http.StatusOK)

	rec := admin.upload("file", "cv.pdf", []byte("<html><body onload=alert(1)>"))
	wantStatus(t, rec, http.StatusUnprocessableEntity)
	if !strings.Contains(rec.Body.String(), `"field":"file"`) {
		t.Errorf("body = %s", rec.Body)
	}
	wantStatus(t, admin.upload("", "", nil), http.StatusBadRequest)
	wantStatus(t, admin.upload("image", "a.png", testPNG(t, 8, 8, 1)), http.StatusBadRequest)

	// Just over the file limit: rejected while streaming the part.
	wantStatus(t, admin.upload("file", "big.png", make([]byte, 1<<20+1)), http.StatusRequestEntityTooLarge)
	// Far over: the request body limit cuts the connection short.
	wantStatus(t, admin.upload("file", "huge.png", make([]byte, 3<<20)), http.StatusRequestEntityTooLarge)

	csrfless := env.browser(t)
	csrfless.cookies = admin.cookies
	csrfless.headers = map[string]string{"Origin": appOrigin}
	wantStatus(t, csrfless.upload("file", "a.png", testPNG(t, 8, 8, 1)), http.StatusForbidden)

	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/media?cursor=not-a-cursor", ""), http.StatusBadRequest)
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/media?limit=500", ""), http.StatusBadRequest)
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/public/media/"+strings.Repeat("0", 64)+".webp", ""), http.StatusNotFound)
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/media/00000000-0000-0000-0000-000000000000/alt-text", `{"en":""}`), http.StatusBadRequest)
}
