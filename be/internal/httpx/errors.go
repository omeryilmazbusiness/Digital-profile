package httpx

import (
	"context"
	"errors"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

// StatusOf maps an application error kind to its HTTP status.
func StatusOf(k apperr.Kind) int {
	switch k {
	case apperr.KindBadRequest:
		return http.StatusBadRequest
	case apperr.KindInvalid:
		return http.StatusUnprocessableEntity
	case apperr.KindUnauthorized:
		return http.StatusUnauthorized
	case apperr.KindForbidden:
		return http.StatusForbidden
	case apperr.KindNotFound:
		return http.StatusNotFound
	case apperr.KindConflict:
		return http.StatusConflict
	case apperr.KindTooLarge:
		return http.StatusRequestEntityTooLarge
	case apperr.KindRateLimited:
		return http.StatusTooManyRequests
	case apperr.KindUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

// ErrorWriter renders any error as problem+json. Application errors expose their safe
// message and field errors; everything else becomes an opaque 500 whose cause is only logged.
type ErrorWriter struct {
	log *slog.Logger
}

func NewErrorWriter(log *slog.Logger) *ErrorWriter { return &ErrorWriter{log: log} }

func (ew *ErrorWriter) Write(w http.ResponseWriter, r *http.Request, err error) {
	WriteProblem(w, ew.problem(r, err))
}

func (ew *ErrorWriter) problem(r *http.Request, err error) api.Problem {
	ctx := r.Context()

	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		return NewProblem(r, http.StatusRequestEntityTooLarge, "request body too large")
	}

	ae, ok := apperr.As(err)
	if !ok {
		switch {
		case errors.Is(err, context.Canceled) && ctx.Err() != nil:
			// Client went away; nobody reads the response, so don't raise an error-level log.
			ew.log.DebugContext(ctx, "request cancelled by client", "request_id", middleware.GetReqID(ctx))
			return NewProblem(r, http.StatusServiceUnavailable, "")
		case errors.Is(err, context.DeadlineExceeded):
			ew.log.WarnContext(ctx, "request deadline exceeded", "error", err, "request_id", middleware.GetReqID(ctx))
			return NewProblem(r, http.StatusServiceUnavailable, "request timed out")
		}
		ae = apperr.Internal(err)
	}

	status := StatusOf(ae.Kind)
	if status >= http.StatusInternalServerError {
		ew.log.ErrorContext(ctx, "request failed",
			"error", err,
			"kind", ae.Kind.String(),
			"request_id", middleware.GetReqID(ctx),
		)
	}

	detail := ae.Message
	if ae.Kind == apperr.KindInternal {
		detail = ""
	}
	p := NewProblem(r, status, detail)
	if len(ae.Fields) > 0 {
		fields := make([]api.FieldError, len(ae.Fields))
		for i, f := range ae.Fields {
			fields[i] = api.FieldError{Field: f.Field, Message: f.Message}
		}
		p.Errors = &fields
	}
	return p
}
