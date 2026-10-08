package health_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/health"
)

func ok(name string) health.Checker {
	return health.NewCheck(name, func(context.Context) error { return nil })
}

func failing(name string, err error) health.Checker {
	return health.NewCheck(name, func(context.Context) error { return err })
}

func TestService_PreservesRegistrationOrder(t *testing.T) {
	svc := health.NewService(time.Second, ok("a"), failing("b", errors.New("boom")), ok("c"))

	results := svc.Check(t.Context())

	if len(results) != 3 {
		t.Fatalf("got %d results, want 3", len(results))
	}
	for i, want := range []string{"a", "b", "c"} {
		if results[i].Name != want {
			t.Errorf("results[%d].Name = %q, want %q", i, results[i].Name, want)
		}
	}
	if results[1].Err == nil || results[0].Err != nil || results[2].Err != nil {
		t.Errorf("unexpected errors: %+v", results)
	}
}

func TestService_TimesOutUncooperativeChecker(t *testing.T) {
	block := make(chan struct{})
	t.Cleanup(func() { close(block) })

	stuck := health.NewCheck("stuck", func(context.Context) error {
		<-block // deliberately ignores ctx
		return nil
	})
	svc := health.NewService(20*time.Millisecond, stuck)

	start := time.Now()
	results := svc.Check(t.Context())

	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("Check took %s, timeout was not enforced", elapsed)
	}
	if !errors.Is(results[0].Err, context.DeadlineExceeded) {
		t.Errorf("Err = %v, want context.DeadlineExceeded", results[0].Err)
	}
}

func TestService_RunsChecksConcurrently(t *testing.T) {
	slow := func(name string) health.Checker {
		return health.NewCheck(name, func(ctx context.Context) error {
			select {
			case <-time.After(100 * time.Millisecond):
				return nil
			case <-ctx.Done():
				return ctx.Err()
			}
		})
	}
	svc := health.NewService(time.Second, slow("a"), slow("b"), slow("c"), slow("d"))

	start := time.Now()
	svc.Check(t.Context())

	if elapsed := time.Since(start); elapsed > 300*time.Millisecond {
		t.Errorf("4 x 100ms checks took %s; they are not running concurrently", elapsed)
	}
}

func TestHandler_Liveness(t *testing.T) {
	h := health.NewHandler(health.NewService(0, failing("db", errors.New("down"))), "1.0.0")

	resp, err := h.GetLiveness(t.Context(), api.GetLivenessRequestObject{})
	if err != nil {
		t.Fatalf("GetLiveness() error = %v", err)
	}

	got, isOK := resp.(api.GetLiveness200JSONResponse)
	if !isOK {
		t.Fatalf("response type = %T, want 200 (liveness must ignore dependencies)", resp)
	}
	if got.Status != api.Up || got.Version != "1.0.0" {
		t.Errorf("got %+v", got)
	}
}

func TestHandler_Readiness(t *testing.T) {
	t.Run("all up", func(t *testing.T) {
		h := health.NewHandler(health.NewService(0, ok("db"), ok("storage")), "v")

		resp, err := h.GetReadiness(t.Context(), api.GetReadinessRequestObject{})
		if err != nil {
			t.Fatalf("GetReadiness() error = %v", err)
		}
		got, isOK := resp.(api.GetReadiness200JSONResponse)
		if !isOK {
			t.Fatalf("response type = %T, want 200", resp)
		}
		if got.Status != api.Up || got.Checks == nil || len(*got.Checks) != 2 {
			t.Errorf("got %+v", got)
		}
	})

	t.Run("one down", func(t *testing.T) {
		h := health.NewHandler(health.NewService(0, ok("db"), failing("storage", errors.New("unreachable"))), "v")

		resp, err := h.GetReadiness(t.Context(), api.GetReadinessRequestObject{})
		if err != nil {
			t.Fatalf("GetReadiness() error = %v", err)
		}
		got, isDown := resp.(api.GetReadiness503JSONResponse)
		if !isDown {
			t.Fatalf("response type = %T, want 503", resp)
		}
		if got.Status != api.Down {
			t.Errorf("Status = %q, want down", got.Status)
		}
		storage := (*got.Checks)[1]
		if storage.Status != api.Down || storage.Error == nil || *storage.Error != "unreachable" {
			t.Errorf("storage check = %+v", storage)
		}
		if (*got.Checks)[0].Error != nil {
			t.Errorf("healthy check must not carry an error: %+v", (*got.Checks)[0])
		}
	})

	t.Run("no checks registered", func(t *testing.T) {
		h := health.NewHandler(health.NewService(0), "v")

		resp, err := h.GetReadiness(t.Context(), api.GetReadinessRequestObject{})
		if err != nil {
			t.Fatalf("GetReadiness() error = %v", err)
		}
		if _, isOK := resp.(api.GetReadiness200JSONResponse); !isOK {
			t.Fatalf("response type = %T, want 200", resp)
		}
	})
}
