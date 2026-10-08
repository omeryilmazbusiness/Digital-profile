package httpx

import (
	"errors"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// Recoverer turns panics into a logged 500 problem response without leaking internals.
// http.ErrAbortHandler is re-panicked so net/http can abort the connection as intended.
func Recoverer(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer recoverPanic(log, w, r)
			next.ServeHTTP(w, r)
		})
	}
}

// recoverPanic must be invoked directly via defer for recover() to take effect.
func recoverPanic(log *slog.Logger, w http.ResponseWriter, r *http.Request) {
	rec := recover()
	if rec == nil {
		return
	}
	if err, ok := rec.(error); ok && errors.Is(err, http.ErrAbortHandler) {
		panic(rec)
	}
	log.ErrorContext(r.Context(), "panic recovered",
		"panic", rec,
		"request_id", middleware.GetReqID(r.Context()),
		"stack", string(debug.Stack()),
	)
	if r.Header.Get("Connection") != "Upgrade" {
		Error(w, r, http.StatusInternalServerError, "")
	}
}

// RequestLogger emits one structured access log line per request.
func RequestLogger(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			next.ServeHTTP(ww, r)

			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}
			level := slog.LevelInfo
			switch {
			case status >= http.StatusInternalServerError:
				level = slog.LevelError
			case status >= http.StatusBadRequest:
				level = slog.LevelWarn
			}

			log.LogAttrs(r.Context(), level, "http request",
				slog.String("request_id", middleware.GetReqID(r.Context())),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", status),
				slog.Int("bytes", ww.BytesWritten()),
				slog.Float64("duration_ms", float64(time.Since(start).Microseconds())/1000),
				slog.String("user_agent", r.UserAgent()),
			)
		})
	}
}
