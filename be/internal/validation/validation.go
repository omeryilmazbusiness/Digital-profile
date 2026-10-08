// Package validation checks domain inputs with struct tags and reports field errors
// using the JSON names clients sent, wrapped in an apperr.KindInvalid error.
//
// Shape and type checks happen earlier, against the OpenAPI document; this layer covers
// rules the contract cannot express (cross-field comparisons, business limits).
package validation

import (
	"errors"
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

const Message = "request validation failed"

type Validator struct {
	v *validator.Validate
}

func New() *Validator {
	v := validator.New(validator.WithRequiredStructEnabled())
	v.RegisterTagNameFunc(jsonName)
	return &Validator{v: v}
}

// Struct returns nil or an *apperr.Error of KindInvalid listing every failing field.
// Programming errors (e.g. passing a non-struct) are returned as internal errors.
func (v *Validator) Struct(s any) error {
	err := v.v.Struct(s)
	if err == nil {
		return nil
	}

	var verrs validator.ValidationErrors
	if !errors.As(err, &verrs) {
		return apperr.Internal(fmt.Errorf("validate %T: %w", s, err))
	}

	fields := make([]apperr.FieldError, 0, len(verrs))
	for _, fe := range verrs {
		fields = append(fields, apperr.FieldError{Field: fieldPath(fe), Message: message(fe)})
	}
	return apperr.Invalid(Message, fields...)
}

func jsonName(f reflect.StructField) string {
	name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
	switch name {
	case "-":
		return ""
	case "":
		return f.Name
	default:
		return name
	}
}

// fieldPath drops the root struct name: "LeadInput.stay.checkOut" -> "stay.checkOut".
func fieldPath(fe validator.FieldError) string {
	ns := fe.Namespace()
	if _, rest, ok := strings.Cut(ns, "."); ok {
		return rest
	}
	return ns
}

func message(fe validator.FieldError) string {
	p := fe.Param()
	switch fe.Tag() {
	case "required", "required_if", "required_with", "required_without":
		return "is required"
	case "email":
		return "must be a valid email address"
	case "url", "http_url":
		return "must be a valid URL"
	case "e164":
		return "must be a phone number in international format, e.g. +966500000000"
	case "uuid", "uuid4":
		return "must be a valid UUID"
	case "oneof":
		return "must be one of: " + strings.ReplaceAll(p, " ", ", ")
	case "min":
		return bound("at least", p, fe)
	case "max":
		return bound("at most", p, fe)
	case "len":
		return bound("exactly", p, fe)
	case "gt":
		return "must be greater than " + p
	case "gte":
		return "must be greater than or equal to " + p
	case "lt":
		return "must be less than " + p
	case "lte":
		return "must be less than or equal to " + p
	case "gtfield":
		return "must be after " + lowerFirst(p)
	case "gtefield":
		return "must not be before " + lowerFirst(p)
	case "ltfield":
		return "must be before " + lowerFirst(p)
	default:
		return "is invalid (" + fe.Tag() + ")"
	}
}

// bound phrases size constraints by kind: characters for strings, items for collections.
func bound(qualifier, p string, fe validator.FieldError) string {
	switch fe.Kind() {
	case reflect.String:
		return fmt.Sprintf("must be %s %s characters", qualifier, p)
	case reflect.Slice, reflect.Array, reflect.Map:
		return fmt.Sprintf("must contain %s %s items", qualifier, p)
	default:
		return fmt.Sprintf("must be %s %s", qualifier, p)
	}
}

// lowerFirst renders a Go field name param (e.g. "CheckIn") like its JSON name ("checkIn").
func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToLower(s[:1]) + s[1:]
}
