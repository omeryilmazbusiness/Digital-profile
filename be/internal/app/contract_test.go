package app_test

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers"
	"github.com/getkin/kin-openapi/routers/gorillamux"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/app"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

// TestContract validates that real responses from the assembled app conform to the
// embedded OpenAPI document, so the implementation cannot silently drift from the spec.
func TestContract(t *testing.T) {
	spec, err := api.GetSpec()
	if err != nil {
		t.Fatalf("load embedded spec: %v", err)
	}
	if err := spec.Validate(t.Context()); err != nil {
		t.Fatalf("embedded spec is invalid: %v", err)
	}
	spec.Servers = nil // match any host

	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		t.Fatalf("build spec router: %v", err)
	}

	pool := dbtest.New(t)
	a, err := app.Build(t.Context(), testConfig(t, nil), discardLogger(), "1.0.0", pool, app.WithArgon2Params(fastArgon2))
	if err != nil {
		t.Fatalf("Build: %v", err)
	}
	t.Cleanup(a.Close)
	handler := a.Handler()

	tests := []struct {
		method, path string
		wantStatus   int
	}{
		{http.MethodGet, "/healthz", http.StatusOK},
		{http.MethodGet, "/readyz", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.method+" "+tt.path, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), tt.method, "http://localhost"+tt.path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body = %s", rec.Code, tt.wantStatus, rec.Body)
			}
			validate(t, router, req, rec)
		})
	}
}

func validate(t *testing.T, router routers.Router, req *http.Request, rec *httptest.ResponseRecorder) {
	t.Helper()

	route, params, err := router.FindRoute(req)
	if err != nil {
		t.Fatalf("route not in spec: %v", err)
	}

	input := &openapi3filter.ResponseValidationInput{
		RequestValidationInput: &openapi3filter.RequestValidationInput{
			Request:    req,
			PathParams: params,
			Route:      route,
		},
		Status: rec.Code,
		Header: rec.Header(),
		Body:   io.NopCloser(bytes.NewReader(rec.Body.Bytes())),
		Options: &openapi3filter.Options{
			IncludeResponseStatus: true,
			MultiError:            true,
		},
	}
	if err := openapi3filter.ValidateResponse(t.Context(), input); err != nil {
		t.Errorf("response violates OpenAPI contract: %v\nbody: %s", err, rec.Body)
	}
}
