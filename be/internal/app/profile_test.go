package app_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

func init() {
	openapi3filter.RegisterBodyDecoder("text/vcard", openapi3filter.FileBodyDecoder)
}

func TestProfileHTTP(t *testing.T) {
	env := newAuthEnv(t)
	admin := env.browser(t)
	visitor := env.browser(t)
	visitor.headers = map[string]string{}

	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/profile", ""), http.StatusUnauthorized)
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"X","translations":{}}`), http.StatusUnauthorized)
	wantStatus(t, admin.login(adminPassword), http.StatusOK)

	// Not set up yet: admin sees 404, visitors the placeholder state.
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/profile", ""), http.StatusNotFound)
	wantStatus(t, visitor.do(http.MethodGet, "/api/v1/public/profile", ""), http.StatusNotFound)
	wantStatus(t, visitor.do(http.MethodGet, "/api/v1/public/profile/vcard", ""), http.StatusNotFound)

	// Contract checks run before the service: unknown language, unknown field.
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"Momen","languages":["xx"],"translations":{}}`), http.StatusBadRequest)
	wantStatus(t, admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"Momen","nickname":"M","translations":{}}`), http.StatusBadRequest)

	rec := admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"Momen","phone":"0501234567","translations":{}}`)
	wantStatus(t, rec, http.StatusUnprocessableEntity)
	if !strings.Contains(rec.Body.String(), `"field":"phone"`) {
		t.Errorf("body = %s", rec.Body)
	}

	rec = admin.do(http.MethodPut, "/api/v1/admin/profile", `{"firstName":"Momen","translations":{}}`)
	wantStatus(t, rec, http.StatusOK)
	var p api.Profile
	_ = json.Unmarshal(rec.Body.Bytes(), &p)
	if p.Complete || len(p.Missing) != 2 || len(p.Languages) != 3 {
		t.Errorf("incomplete profile = %+v", p)
	}
	wantStatus(t, visitor.do(http.MethodGet, "/api/v1/public/profile", ""), http.StatusNotFound)

	rec = admin.do(http.MethodPut, "/api/v1/admin/profile", `{
		"firstName": "Momen", "lastName": "Hassan", "organization": "Sheraton Makkah",
		"whatsapp": "+966 50 123 4567", "email": "momen@example.com", "languages": ["ar", "tr"],
		"translations": {
			"en": {"title": "Director of Sales", "whatsappMessage": "Hello Momen"},
			"ar": {"title": "مدير المبيعات"}
		}
	}`)
	wantStatus(t, rec, http.StatusOK)
	_ = json.Unmarshal(rec.Body.Bytes(), &p)
	if !p.Complete || p.Whatsapp == nil || *p.Whatsapp != "+966501234567" {
		t.Errorf("profile = %+v", p)
	}
	wantStatus(t, admin.do(http.MethodGet, "/api/v1/admin/profile", ""), http.StatusOK)

	rec = visitor.do(http.MethodGet, "/api/v1/public/profile?locale=id", "")
	wantStatus(t, rec, http.StatusOK)
	var pub api.PublicProfile
	_ = json.Unmarshal(rec.Body.Bytes(), &pub)
	if pub.Locale != "en" || pub.Title != "Director of Sales" || pub.FullName != "Momen Hassan" {
		t.Errorf("public profile = %+v", pub)
	}
	if pub.Whatsapp == nil || pub.Whatsapp.Url != "https://wa.me/966501234567?text=Hello%20Momen" || pub.Whatsapp.Display != "+966 50 123 4567" {
		t.Errorf("whatsapp = %+v", pub.Whatsapp)
	}
	wantStatus(t, visitor.do(http.MethodGet, "/api/v1/public/profile?locale=fr", ""), http.StatusBadRequest)

	rec = visitor.do(http.MethodGet, "/api/v1/public/profile/vcard?locale=ar", "")
	wantStatus(t, rec, http.StatusOK)
	h := rec.Header()
	if h.Get("Content-Type") != "text/vcard; charset=utf-8" {
		t.Errorf("Content-Type = %q", h.Get("Content-Type"))
	}
	if want := `attachment; filename="Momen-Hassan.vcf"; filename*=UTF-8''Momen%20Hassan.vcf`; h.Get("Content-Disposition") != want {
		t.Errorf("Content-Disposition = %q", h.Get("Content-Disposition"))
	}
	body := rec.Body.String()
	if !strings.HasPrefix(body, "BEGIN:VCARD\r\nVERSION:3.0\r\n") || !strings.Contains(body, "\r\nTITLE:مدير المبيعات\r\n") {
		t.Errorf("vcard:\n%s", body)
	}
}
