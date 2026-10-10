package app_test

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strconv"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

func init() {
	openapi3filter.RegisterBodyDecoder("application/pdf", openapi3filter.FileBodyDecoder)
}

func testPDF(pages int, marker string) []byte {
	var b strings.Builder
	b.WriteString("%PDF-1.7\n% " + marker + "\n")
	for range pages {
		b.WriteString("<< /Type /Page >>\n")
	}
	b.WriteString("%%EOF\n")
	return []byte(b.String())
}

// multipartTo sends metadata (when not empty) and a PDF to path.
func (b *browser) multipartTo(method, path, metadata, filename string, data []byte) *httptest.ResponseRecorder {
	b.t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	if metadata != "" {
		h := textproto.MIMEHeader{}
		h.Set("Content-Disposition", `form-data; name="metadata"`)
		h.Set("Content-Type", "application/json")
		pw, _ := mw.CreatePart(h)
		_, _ = pw.Write([]byte(metadata))
	}
	if data != nil {
		fw, _ := mw.CreateFormFile("file", filename)
		_, _ = fw.Write(data)
	}
	_ = mw.Close()
	req := httptest.NewRequestWithContext(b.t.Context(), method, "http://localhost"+path, &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	return b.send(req)
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %T: %v; body = %s", v, err, rec.Body)
	}
	return v
}

func TestDiscoverHTTP_Lifecycle(t *testing.T) {
	env := newAuthEnvWith(t, map[string]string{"DOCUMENTS_MAX_UPLOAD_BYTES": strconv.Itoa(1 << 20)})
	admin := env.browser(t)
	visitor := env.browser(t)
	visitor.headers = map[string]string{}

	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/discover/sections", ""), http.StatusUnauthorized)
	wantStatus(t, admin.do(http.MethodPost, "/api/v1/admin/discover/sections", `{"translations":{"en":{"title":"x"}}}`), http.StatusUnauthorized)
	wantStatus(t, admin.login(adminPassword), http.StatusOK)

	// Topics: a title in some language is required.
	wantStatus(t, admin.do(http.MethodPost, "/api/v1/admin/discover/sections", `{"translations":{}}`), http.StatusUnprocessableEntity)
	wantStatus(t, admin.do(http.MethodPost, "/api/v1/admin/discover/sections", `{"translations":{"fr":{"title":"x"}}}`), http.StatusBadRequest)

	rec := admin.do(http.MethodPost, "/api/v1/admin/discover/sections", `{"translations":{
		"en":{"eyebrow":"Groups","title":"Umrah groups","body":"Rooms for groups.\n\nAll year."},
		"ar":{"title":"مجموعات العمرة"}}}`)
	wantStatus(t, rec, http.StatusCreated)
	groups := decode[api.DiscoverSection](t, rec)
	rec = admin.do(http.MethodPost, "/api/v1/admin/discover/sections", `{"translations":{"en":{"title":"Weddings"}}}`)
	wantStatus(t, rec, http.StatusCreated)
	weddings := decode[api.DiscoverSection](t, rec)
	if groups.Position != 0 || weddings.Position != 1 || len(groups.Documents) != 0 {
		t.Fatalf("positions = %d, %d", groups.Position, weddings.Position)
	}

	// Documents: metadata and a real PDF are required.
	docs := "/api/v1/admin/discover/sections/" + groups.Id.String() + "/documents"
	meta := `{"language":"en","translations":{"en":{"title":"Group rates 2026"},"ar":{"title":"أسعار المجموعات"}}}`
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, "", "a.pdf", testPDF(1, "a")), http.StatusBadRequest)
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, meta, "", nil), http.StatusBadRequest)
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, `{"language":"en"}`, "a.pdf", testPDF(1, "a")), http.StatusUnprocessableEntity)
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, `{"language":"en","x":1}`, "a.pdf", testPDF(1, "a")), http.StatusBadRequest)
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, meta, "evil.pdf", []byte("<html>%%EOF")), http.StatusUnprocessableEntity)
	wantStatus(t, admin.multipartTo(http.MethodPost, docs, meta, "big.pdf", bytes.Repeat([]byte("%PDF-"), 1<<19)), http.StatusRequestEntityTooLarge)
	wantStatus(t, admin.multipartTo(http.MethodPost, "/api/v1/admin/discover/sections/00000000-0000-4000-8000-000000000000/documents", meta, "a.pdf", testPDF(1, "a")), http.StatusNotFound)

	rec = admin.multipartTo(http.MethodPost, docs, meta, `C:\fakepath\Group Rates 2026.pdf`, testPDF(3, "v1"))
	wantStatus(t, rec, http.StatusCreated)
	doc := decode[api.Document](t, rec)
	if doc.FileName != "Group Rates 2026.pdf" || doc.PageCount == nil || *doc.PageCount != 3 || doc.Language != "en" ||
		doc.Url != "/api/v1/public/documents/"+doc.Id.String() || doc.DownloadUrl != doc.Url+"?download=true" {
		t.Fatalf("document = %+v", doc)
	}

	// Public delivery: inline by default, attachment on request, cacheable by content.
	rec = visitor.do(http.MethodGet, doc.Url, "")
	wantStatus(t, rec, http.StatusOK)
	h := rec.Header()
	for name, want := range map[string]string{
		"Content-Type":            "application/pdf",
		"Content-Disposition":     `inline; filename="Group-Rates-2026.pdf"; filename*=UTF-8''Group%20Rates%202026.pdf`,
		"Content-Security-Policy": "sandbox",
		"X-Content-Type-Options":  "nosniff",
	} {
		if got := h.Get(name); got != want {
			t.Errorf("%s = %q, want %q", name, got, want)
		}
	}
	if !bytes.Equal(rec.Body.Bytes(), testPDF(3, "v1")) {
		t.Error("served bytes differ from the upload")
	}
	etag := h.Get("ETag")
	if !strings.HasPrefix(rec2(visitor, doc.DownloadUrl).Header().Get("Content-Disposition"), "attachment;") {
		t.Error("download=true must be an attachment")
	}
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "http://localhost"+doc.Url, http.NoBody)
	req.Header.Set("If-None-Match", etag)
	wantStatus(t, visitor.send(req), http.StatusNotModified)

	// A new version keeps the link and changes the ETag; the old file is gone.
	rec = admin.multipartTo(http.MethodPut, "/api/v1/admin/documents/"+doc.Id.String()+"/file", "", "Rates v2.pdf", testPDF(2, "v2"))
	wantStatus(t, rec, http.StatusOK)
	if d := decode[api.Document](t, rec); d.FileName != "Rates v2.pdf" || *d.PageCount != 2 || d.Id != doc.Id {
		t.Errorf("replaced = %+v", d)
	}
	rec = visitor.do(http.MethodGet, doc.Url, "")
	if rec.Header().Get("ETag") == etag || !bytes.Equal(rec.Body.Bytes(), testPDF(2, "v2")) {
		t.Error("the new version is not served")
	}

	// Titles and language.
	rec = admin.do(http.MethodPut, "/api/v1/admin/documents/"+doc.Id.String(), `{"language":"ar","translations":{"id":{"title":"Tarif grup"}}}`)
	wantStatus(t, rec, http.StatusOK)
	if d := decode[api.Document](t, rec); d.Language != "ar" || d.Translations.En != nil || d.Translations.Id.Title != "Tarif grup" {
		t.Errorf("updated = %+v", d)
	}

	// Order: every topic exactly once.
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/discover/section-order", `{"ids":["`+weddings.Id.String()+`"]}`), http.StatusUnprocessableEntity)
	rec = admin.do(http.MethodPut, "/api/v1/admin/discover/section-order", `{"ids":["`+weddings.Id.String()+`","`+groups.Id.String()+`"]}`)
	wantStatus(t, rec, http.StatusOK)
	if list := decode[api.DiscoverSectionList](t, rec); list.Items[0].Id != weddings.Id || len(list.Items[1].Documents) != 1 {
		t.Errorf("order = %+v", list.Items)
	}

	// Settings and the public site.
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/settings", `{"tourUrl":"http://tour.example.com"}`), http.StatusUnprocessableEntity)
	rec = admin.do(http.MethodPut, "/api/v1/admin/settings", `{"tourUrl":"https://my.matterport.com/show/?m=abc"}`)
	wantStatus(t, rec, http.StatusOK)
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/settings", ""), http.StatusOK)

	rec = visitor.do(http.MethodGet, "/api/v1/public/site?locale=ar", "")
	wantStatus(t, rec, http.StatusOK)
	site := decode[api.PublicSite](t, rec)
	if site.Locale != "ar" || site.Profile != nil || site.Tour == nil || site.Tour.Url != "https://my.matterport.com/show/?m=abc" {
		t.Errorf("site = %+v", site)
	}
	if len(site.Sections) != 2 || site.Sections[0].Title != "Weddings" || site.Sections[1].Title != "مجموعات العمرة" ||
		len(site.Sections[1].Documents) != 1 || site.Sections[1].Documents[0].Title != "Tarif grup" {
		t.Errorf("sections = %+v", site.Sections)
	}

	// Deleting a topic removes its documents and their files.
	wantStatus(t, admin.do(http.MethodDelete, "/api/v1/admin/discover/sections/"+groups.Id.String(), ""), http.StatusNoContent)
	wantStatus(t, visitor.do(http.MethodGet, doc.Url, ""), http.StatusNotFound)
	wantStatus(t, admin.do(http.MethodDelete, "/api/v1/admin/discover/sections/"+groups.Id.String(), ""), http.StatusNotFound)
	wantStatus(t, admin.do(http.MethodDelete, "/api/v1/admin/documents/"+doc.Id.String(), ""), http.StatusNotFound)

	rec = admin.multipartTo(http.MethodPost, "/api/v1/admin/discover/sections/"+weddings.Id.String()+"/documents",
		`{"language":"id","translations":{"id":{"title":"Paket"}}}`, "paket.pdf", testPDF(1, "w"))
	wantStatus(t, rec, http.StatusCreated)
	wd := decode[api.Document](t, rec)
	wantStatus(t, admin.do(http.MethodDelete, "/api/v1/admin/documents/"+wd.Id.String(), ""), http.StatusNoContent)
	wantStatus(t, visitor.do(http.MethodGet, wd.Url, ""), http.StatusNotFound)
}

func rec2(b *browser, path string) *httptest.ResponseRecorder {
	b.t.Helper()
	rec := b.do(http.MethodGet, path, "")
	wantStatus(b.t, rec, http.StatusOK)
	return rec
}

func TestPublicSiteHTTP_WithProfile(t *testing.T) {
	env := newAuthEnv(t)
	admin := env.browser(t)
	visitor := env.browser(t)
	visitor.headers = map[string]string{}
	wantStatus(t, admin.login(adminPassword), http.StatusOK)

	rec := visitor.do(http.MethodGet, "/api/v1/public/site", "")
	wantStatus(t, rec, http.StatusOK)
	if site := decode[api.PublicSite](t, rec); site.Locale != "en" || site.Profile != nil || site.Tour != nil || len(site.Sections) != 0 {
		t.Errorf("empty site = %+v", site)
	}

	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/profile", `{
		"firstName": "Momen", "lastName": "Alkiswani", "email": "momen@example.com",
		"postalCode": "24231", "mapUrl": "https://maps.app.goo.gl/x", "linkedinUrl": "https://www.linkedin.com/in/momen",
		"translations": {
			"en": {"title": "Director of Sales", "address": {"street": "Ibrahim Al Khalil Street", "city": "Makkah", "country": "Saudi Arabia"}},
			"ar": {"title": "مدير المبيعات", "displayName": "مؤمن الكسواني", "address": {"city": "مكة المكرمة"}}
		}
	}`), http.StatusOK)
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"Momen","linkedinUrl":"https://example.com/in/momen","translations":{}}`), http.StatusUnprocessableEntity)

	rec = visitor.do(http.MethodGet, "/api/v1/public/site?locale=ar", "")
	wantStatus(t, rec, http.StatusOK)
	p := decode[api.PublicSite](t, rec).Profile
	if p == nil || p.DisplayName != "مؤمن الكسواني" || p.FullName != "Momen Alkiswani" || p.Title != "مدير المبيعات" {
		t.Fatalf("profile = %+v", p)
	}
	if p.Address == nil || p.Address.City != "مكة المكرمة" || p.Address.PostalCode != "24231" || p.Address.Street != "" {
		t.Errorf("address = %+v", p.Address)
	}
	if p.LinkedinUrl == nil || p.MapUrl == nil {
		t.Errorf("links = %v %v", p.LinkedinUrl, p.MapUrl)
	}
}
