package httpx

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/netip"

	"github.com/go-chi/chi/v5"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

// RouterConfig carries everything NewRouter needs; zero values disable optional features.
type RouterConfig struct {
	Log            *slog.Logger
	Server         api.StrictServerInterface
	TrustedProxies []netip.Prefix
	CORSOrigins    []string
	HSTS           bool
	MaxBodyBytes   int64
	// CSRFOrigins are the origins allowed to make state-changing requests to CSRFPrefixes.
	CSRFOrigins  []string
	CSRFPrefixes []string
	// StrictMiddlewares wrap every generated operation handler (e.g. authentication).
	StrictMiddlewares []api.StrictMiddlewareFunc
	// RateLimiter is optional; nil disables rate limiting.
	RateLimiter *RateLimiter
}

// NewRouter mounts the generated OpenAPI handlers behind the shared middleware stack.
// Every error path — routing, contract violation, handler failure, panic — answers with problem+json.
//
// Order matters: identity and logging wrap everything so even rejected requests are traced;
// cheap rejections (CORS preflight, rate limit, oversize body) run before schema validation.
func NewRouter(cfg RouterConfig) (http.Handler, error) {
	if cfg.Log == nil || cfg.Server == nil {
		return nil, errors.New("router: Log and Server are required")
	}
	if cfg.MaxBodyBytes <= 0 {
		return nil, errors.New("router: MaxBodyBytes must be positive")
	}

	ew := NewErrorWriter(cfg.Log)

	spec, err := api.GetSpec()
	if err != nil {
		return nil, fmt.Errorf("load openapi spec: %w", err)
	}
	validate, err := RequestValidator(spec, ew)
	if err != nil {
		return nil, err
	}

	r := chi.NewRouter()
	r.Use(RequestID)
	r.Use(ClientIP(cfg.TrustedProxies))
	r.Use(RequestLogger(cfg.Log))
	r.Use(Recoverer(cfg.Log))
	r.Use(SecurityHeaders(cfg.HSTS))
	r.Use(CORS(cfg.CORSOrigins))
	if cfg.RateLimiter != nil {
		r.Use(cfg.RateLimiter.Middleware)
	}
	r.Use(BodyLimit(cfg.MaxBodyBytes))
	r.Use(CSRF(cfg.CSRFOrigins, cfg.CSRFPrefixes))
	r.Use(validate)

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		Error(w, r, http.StatusNotFound, "")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		Error(w, r, http.StatusMethodNotAllowed, "")
	})

	strict := api.NewStrictHandlerWithOptions(cfg.Server, cfg.StrictMiddlewares, api.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			ew.Write(w, r, decodeError(err))
		},
		ResponseErrorHandlerFunc: ew.Write,
	})

	return api.HandlerWithOptions(strict, api.ChiServerOptions{
		BaseRouter: r,
		ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			ew.Write(w, r, apperr.BadRequest(err.Error()))
		},
	}), nil
}

// decodeError classifies failures while decoding a request body in the generated handlers.
func decodeError(err error) error {
	if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
		return err
	}
	return apperr.BadRequest("malformed request body").Wrap(err)
}
