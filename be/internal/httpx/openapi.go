package httpx

import (
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"sync"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/getkin/kin-openapi/routers/gorillamux"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

// registerFormats installs format validators kin-openapi leaves opt-in. It must be global:
// per-document SchemaValidationOptions are not applied to parameters (kin-openapi v0.149).
var registerFormats sync.Once

// RequestValidator rejects requests that violate the OpenAPI contract (parameters, content
// type, body schema) before they reach a handler, answering 400 with field-level errors.
//
// Requests matching no operation are passed through so the router answers 404/405 itself.
// Authentication is not checked here; security schemes are enforced by the auth middleware.
func RequestValidator(spec *openapi3.T, errs *ErrorWriter) (func(http.Handler) http.Handler, error) {
	spec.Servers = nil // match on path only, whatever Host the proxy forwards
	router, err := gorillamux.NewRouter(spec)
	if err != nil {
		return nil, fmt.Errorf("build openapi router: %w", err)
	}

	opts := &openapi3filter.Options{
		MultiError:         true,
		AuthenticationFunc: openapi3filter.NoopAuthenticationFunc,
	}
	registerFormats.Do(func() {
		openapi3.DefineStringFormatValidator("uuid", openapi3.NewRegexpFormatValidator(openapi3.FormatOfStringForUUIDOfRFC9562))
	})

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			route, params, err := router.FindRoute(r)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}
			err = openapi3filter.ValidateRequest(r.Context(), &openapi3filter.RequestValidationInput{
				Request:    r,
				PathParams: params,
				Route:      route,
				Options:    opts,
			})
			if err != nil {
				errs.Write(w, r, requestError(err))
				return
			}
			next.ServeHTTP(w, r)
		})
	}, nil
}

// requestError converts kin-openapi errors into a 400 apperr with one entry per violation.
func requestError(err error) error {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		return err
	}

	var fields []apperr.FieldError
	collectFields(err, &fields)
	if len(fields) == 0 {
		return apperr.BadRequest("malformed request")
	}
	return apperr.BadRequest(validation.Message, fields...)
}

// collectFields walks the error tree with type switches rather than errors.As:
// openapi3.MultiError implements As by matching any element, which would skip the
// RequestError layer that carries the parameter/body context.
func collectFields(err error, out *[]apperr.FieldError) {
	switch e := err.(type) { //nolint:errorlint // structural walk, see above
	case openapi3.MultiError:
		for _, inner := range e {
			collectFields(inner, out)
		}
	case *openapi3filter.RequestError:
		requestFields(e, e.Err, out)
	}
}

func requestFields(reqErr *openapi3filter.RequestError, err error, out *[]apperr.FieldError) {
	base := "body"
	if reqErr.Parameter != nil {
		base = reqErr.Parameter.Name
	}

	switch e := err.(type) { //nolint:errorlint // structural walk, see collectFields
	case openapi3.MultiError:
		for _, inner := range e {
			requestFields(reqErr, inner, out)
		}
		return
	case *openapi3.SchemaError:
		*out = append(*out, schemaField(base, reqErr.Parameter == nil, e))
		return
	}

	msg := "is invalid"
	switch {
	case errors.Is(err, openapi3filter.ErrInvalidRequired):
		msg = "is required"
	case errors.Is(err, openapi3filter.ErrInvalidEmptyValue):
		msg = "must not be empty"
	case reqErr.RequestBody != nil && strings.Contains(reqErr.Error(), "header Content-Type"):
		base, msg = "Content-Type", "is not supported"
	case reqErr.RequestBody != nil:
		msg = "is not valid JSON"
	}
	*out = append(*out, apperr.FieldError{Field: base, Message: msg})
}

var propertyReason = regexp.MustCompile(`^property "([^"]+)" is (missing|unsupported)$`)

// schemaField names the offending value as a dotted path ("stay.nights"). Body paths are
// rooted at the body itself; parameter paths are prefixed with the parameter name.
func schemaField(base string, isBody bool, e *openapi3.SchemaError) apperr.FieldError {
	path := e.JSONPointer()
	msg := e.Reason
	if m := propertyReason.FindStringSubmatch(e.Reason); m != nil {
		if len(path) == 0 || path[len(path)-1] != m[1] {
			path = append(slices.Clone(path), m[1])
		}
		msg = "is required"
		if m[2] == "unsupported" {
			msg = "is not allowed"
		}
	}
	if msg == "" {
		msg = "is invalid"
	}

	field := base
	switch {
	case len(path) > 0 && isBody:
		field = strings.Join(path, ".")
	case len(path) > 0:
		field = base + "." + strings.Join(path, ".")
	}
	return apperr.FieldError{Field: field, Message: msg}
}
