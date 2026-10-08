package httpx_test

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

// A spec with parameters and a body exercises the validator before real endpoints exist.
const validatorSpec = `
openapi: 3.0.3
info: {title: t, version: "1"}
servers: [{url: "https://api.example.com"}]
paths:
  /items/{id}:
    put:
      parameters:
        - {name: id, in: path, required: true, schema: {type: string, format: uuid}}
        - {name: limit, in: query, schema: {type: integer, minimum: 1, maximum: 50}}
      security: [{bearer: []}]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              additionalProperties: false
              required: [name, stay]
              properties:
                name: {type: string, minLength: 2}
                stay:
                  type: object
                  required: [nights]
                  properties:
                    nights: {type: integer, minimum: 1}
      responses:
        "204": {description: ok}
components:
  securitySchemes:
    bearer: {type: http, scheme: bearer}
`

func newValidated(t *testing.T) (http.Handler, *bool) {
	t.Helper()
	spec, err := openapi3.NewLoader().LoadFromData([]byte(validatorSpec))
	if err != nil {
		t.Fatal(err)
	}
	mw, err := httpx.RequestValidator(spec, httpx.NewErrorWriter(slog.New(slog.DiscardHandler)))
	if err != nil {
		t.Fatal(err)
	}
	reached := new(bool)
	return mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*reached = true
		body, _ := io.ReadAll(r.Body)
		if len(body) == 0 && r.Method == http.MethodPut {
			t.Error("handler received an empty body after validation")
		}
		w.WriteHeader(http.StatusNoContent)
	})), reached
}

const validID = "/items/3f2b8c1e-0a4d-4c6e-9b7a-1d2e3f4a5b6c"

func TestRequestValidator(t *testing.T) {
	tests := []struct {
		name        string
		method      string
		path        string
		contentType string
		body        string
		wantStatus  int
		wantFields  []string
	}{
		{"valid request reaches handler (no auth check, no host check)", http.MethodPut, validID + "?limit=5", "application/json", `{"name":"ok","stay":{"nights":2}}`, 204, nil},
		{"bad path param", http.MethodPut, "/items/not-a-uuid", "application/json", `{"name":"ok","stay":{"nights":2}}`, 400, []string{"id"}},
		{"bad query param", http.MethodPut, validID + "?limit=99", "application/json", `{"name":"ok","stay":{"nights":2}}`, 400, []string{"limit"}},
		{"nested and multiple body errors", http.MethodPut, validID, "application/json", `{"name":"x","stay":{"nights":0}}`, 400, []string{"name", "stay.nights"}},
		{"missing required property", http.MethodPut, validID, "application/json", `{"name":"ok"}`, 400, []string{"stay"}},
		{"unknown property", http.MethodPut, validID, "application/json", `{"name":"ok","stay":{"nights":1},"admin":true}`, 400, []string{"admin"}},
		{"malformed json", http.MethodPut, validID, "application/json", `{"name":`, 400, []string{"body"}},
		{"missing body", http.MethodPut, validID, "application/json", ``, 400, []string{"body"}},
		{"wrong content type", http.MethodPut, validID, "text/plain", `hello`, 400, []string{"Content-Type"}},
		{"unknown route passes through to router", http.MethodGet, "/elsewhere", "", ``, 204, nil},
		{"unknown method passes through to router", http.MethodDelete, validID, "", ``, 204, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h, reached := newValidated(t)
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))
			if tt.contentType != "" {
				req.Header.Set("Content-Type", tt.contentType)
			}
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			res := rec.Result()
			defer res.Body.Close()

			if res.StatusCode != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", res.StatusCode, tt.wantStatus, rec.Body)
			}
			if tt.wantStatus == http.StatusNoContent {
				if !*reached {
					t.Fatal("handler not reached")
				}
				return
			}
			if *reached {
				t.Fatal("invalid request reached the handler")
			}
			p := decodeProblemNoID(t, res)
			var fields []string
			if p.Errors != nil {
				for _, f := range *p.Errors {
					if f.Message == "" {
						t.Errorf("field %q has no message", f.Field)
					}
					fields = append(fields, f.Field)
				}
			}
			slices.Sort(fields)
			if !slices.Equal(fields, tt.wantFields) {
				t.Errorf("fields = %v, want %v (problem: %s)", fields, tt.wantFields, rec.Body)
			}
		})
	}
}

func TestRequestValidator_OversizeBodyIs413(t *testing.T) {
	h, _ := newValidated(t)
	h = httpx.BodyLimit(16)(h)
	req := httptest.NewRequest(http.MethodPut, validID, io.NopCloser(strings.NewReader(`{"name":"`+strings.Repeat("a", 64)+`","stay":{"nights":1}}`)))
	req.ContentLength = -1
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413; body = %s", rec.Code, rec.Body)
	}
}

func TestRequestValidator_EmbeddedSpecBuilds(t *testing.T) {
	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := httpx.RequestValidator(spec, httpx.NewErrorWriter(slog.New(slog.DiscardHandler))); err != nil {
		t.Fatal(err)
	}
}
