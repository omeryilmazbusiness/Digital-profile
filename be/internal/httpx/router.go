package httpx

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

// NewRouter mounts the generated OpenAPI handlers behind the shared middleware stack.
// Every error path — routing, request decoding, handler failure, panic — answers with problem+json.
func NewRouter(log *slog.Logger, server api.StrictServerInterface) http.Handler {
	r := chi.NewRouter()

	r.Use(RequestID)
	r.Use(RequestLogger(log))
	r.Use(Recoverer(log))

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		Error(w, r, http.StatusNotFound, "")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		Error(w, r, http.StatusMethodNotAllowed, "")
	})

	strict := api.NewStrictHandlerWithOptions(server, nil, api.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			Error(w, r, http.StatusBadRequest, err.Error())
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			log.ErrorContext(r.Context(), "handler failed",
				"error", err,
				"request_id", middleware.GetReqID(r.Context()),
			)
			Error(w, r, http.StatusInternalServerError, "")
		},
	})

	return api.HandlerWithOptions(strict, api.ChiServerOptions{
		BaseRouter: r,
		ErrorHandlerFunc: func(w http.ResponseWriter, r *http.Request, err error) {
			Error(w, r, http.StatusBadRequest, err.Error())
		},
	})
}
