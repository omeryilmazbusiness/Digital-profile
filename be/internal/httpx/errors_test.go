package httpx_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/httpx"
)

func TestErrorWriter(t *testing.T) {
	cause := errors.New("pq: password=hunter2 rejected")

	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantDetail string
		wantFields int
		wantLogged bool
	}{
		{"invalid with fields", apperr.Invalid("request validation failed", apperr.FieldError{Field: "email", Message: "is required"}), 422, "request validation failed", 1, false},
		{"bad request", apperr.BadRequest("malformed request"), 400, "malformed request", 0, false},
		{"unauthorized", apperr.Unauthorized("invalid credentials"), 401, "invalid credentials", 0, false},
		{"forbidden", apperr.Forbidden("nope"), 403, "nope", 0, false},
		{"not found", apperr.NotFound("pdf not found"), 404, "pdf not found", 0, false},
		{"conflict wrapped", fmt.Errorf("repo: %w", apperr.Conflict("slug taken").Wrap(cause)), 409, "slug taken", 0, false},
		{"too large", apperr.New(apperr.KindTooLarge, "file too large"), 413, "file too large", 0, false},
		{"rate limited", apperr.New(apperr.KindRateLimited, "slow down"), 429, "slow down", 0, false},
		{"unavailable", apperr.Unavailable("storage down").Wrap(cause), 503, "storage down", 0, true},
		{"internal is opaque", apperr.Internal(cause), 500, "", 0, true},
		{"plain error is opaque", cause, 500, "", 0, true},
		{"max bytes", fmt.Errorf("decode: %w", &http.MaxBytesError{Limit: 10}), 413, "request body too large", 0, false},
		{"deadline", fmt.Errorf("query: %w", context.DeadlineExceeded), 503, "request timed out", 0, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			ew := httpx.NewErrorWriter(slog.New(slog.NewJSONHandler(&logs, nil)))

			rec := httptest.NewRecorder()
			ew.Write(rec, httptest.NewRequest(http.MethodGet, "/x", http.NoBody), tt.err)
			res := rec.Result()
			defer res.Body.Close()

			if res.StatusCode != tt.wantStatus {
				t.Fatalf("status = %d, want %d", res.StatusCode, tt.wantStatus)
			}
			body, _ := io.ReadAll(res.Body)
			if strings.Contains(string(body), "hunter2") {
				t.Fatalf("cause leaked to client: %s", body)
			}
			res.Body = io.NopCloser(bytes.NewReader(body))
			p := decodeProblemNoID(t, res)
			got := ""
			if p.Detail != nil {
				got = *p.Detail
			}
			if got != tt.wantDetail {
				t.Errorf("detail = %q, want %q", got, tt.wantDetail)
			}
			n := 0
			if p.Errors != nil {
				n = len(*p.Errors)
			}
			if n != tt.wantFields {
				t.Errorf("errors = %d, want %d", n, tt.wantFields)
			}
			if logged := strings.Contains(logs.String(), "request failed"); logged != tt.wantLogged {
				t.Errorf("logged = %v, want %v: %s", logged, tt.wantLogged, logs.String())
			}
		})
	}
}

func TestErrorWriter_ClientCancelIsNotAnError(t *testing.T) {
	var logs bytes.Buffer
	ew := httpx.NewErrorWriter(slog.New(slog.NewJSONHandler(&logs, nil)))

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	req := httptest.NewRequestWithContext(ctx, http.MethodGet, "/x", http.NoBody)
	ew.Write(httptest.NewRecorder(), req, fmt.Errorf("query: %w", context.Canceled))

	if strings.Contains(logs.String(), `"level":"ERROR"`) {
		t.Errorf("client cancellation logged as error: %s", logs.String())
	}
}

func TestStatusOf_CoversEveryKind(t *testing.T) {
	seen := map[int]apperr.Kind{}
	for k := apperr.KindInternal; k <= apperr.KindUnavailable; k++ {
		s := httpx.StatusOf(k)
		if prev, dup := seen[s]; dup {
			t.Errorf("kinds %v and %v both map to %d", prev, k, s)
		}
		seen[s] = k
	}
}
