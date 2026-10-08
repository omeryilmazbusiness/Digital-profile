// Package apperr defines transport-agnostic application errors.
//
// Services return *Error values (or wrap them); the HTTP layer maps Kind to a status code
// and exposes only Message and Fields. The wrapped cause is for logs and never leaves the server.
package apperr

import (
	"errors"
	"fmt"
)

type Kind uint8

const (
	KindInternal Kind = iota
	KindInvalid
	KindBadRequest
	KindUnauthorized
	KindForbidden
	KindNotFound
	KindConflict
	KindTooLarge
	KindRateLimited
	KindUnavailable
)

func (k Kind) String() string {
	switch k {
	case KindInvalid:
		return "invalid"
	case KindBadRequest:
		return "bad_request"
	case KindUnauthorized:
		return "unauthorized"
	case KindForbidden:
		return "forbidden"
	case KindNotFound:
		return "not_found"
	case KindConflict:
		return "conflict"
	case KindTooLarge:
		return "too_large"
	case KindRateLimited:
		return "rate_limited"
	case KindUnavailable:
		return "unavailable"
	default:
		return "internal"
	}
}

// FieldError describes a problem with a single input field.
type FieldError struct {
	Field   string
	Message string
}

type Error struct {
	Kind Kind
	// Message is safe to show to clients.
	Message string
	Fields  []FieldError
	cause   error
}

func (e *Error) Error() string {
	if e.cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Kind, e.Message, e.cause)
	}
	return fmt.Sprintf("%s: %s", e.Kind, e.Message)
}

func (e *Error) Unwrap() error { return e.cause }

// Wrap attaches an internal cause without exposing it to clients.
func (e *Error) Wrap(cause error) *Error {
	cp := *e
	cp.cause = cause
	return &cp
}

func New(kind Kind, msg string) *Error { return &Error{Kind: kind, Message: msg} }

func Invalid(msg string, fields ...FieldError) *Error {
	return &Error{Kind: KindInvalid, Message: msg, Fields: fields}
}

// BadRequest reports a request that is malformed or violates the API contract, as opposed
// to Invalid, which reports well-formed input rejected by business rules.
func BadRequest(msg string, fields ...FieldError) *Error {
	return &Error{Kind: KindBadRequest, Message: msg, Fields: fields}
}

func Unauthorized(msg string) *Error { return New(KindUnauthorized, msg) }
func Forbidden(msg string) *Error    { return New(KindForbidden, msg) }
func NotFound(msg string) *Error     { return New(KindNotFound, msg) }
func Conflict(msg string) *Error     { return New(KindConflict, msg) }
func Unavailable(msg string) *Error  { return New(KindUnavailable, msg) }

// Internal hides cause behind a generic message.
func Internal(cause error) *Error {
	return &Error{Kind: KindInternal, Message: "internal error", cause: cause}
}

// As extracts the *Error from err's chain.
func As(err error) (*Error, bool) {
	var e *Error
	ok := errors.As(err, &e)
	return e, ok
}

// KindOf returns the Kind of err, or KindInternal for errors that are not *Error.
func KindOf(err error) Kind {
	if e, ok := As(err); ok {
		return e.Kind
	}
	return KindInternal
}
