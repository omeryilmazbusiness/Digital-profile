// Package health implements liveness and readiness probes.
package health

import (
	"context"
	"sync"
	"time"
)

// Checker reports whether a dependency is usable. Implementations must honour ctx cancellation.
type Checker interface {
	Name() string
	Check(ctx context.Context) error
}

type checkFunc struct {
	name string
	fn   func(context.Context) error
}

func (c checkFunc) Name() string                    { return c.name }
func (c checkFunc) Check(ctx context.Context) error { return c.fn(ctx) }

// NewCheck adapts a function into a Checker.
func NewCheck(name string, fn func(context.Context) error) Checker {
	return checkFunc{name: name, fn: fn}
}

type Result struct {
	Name string
	Err  error
}

// Service runs registered checks concurrently, each bounded by a timeout.
type Service struct {
	checkers []Checker
	timeout  time.Duration
}

const DefaultCheckTimeout = 2 * time.Second

func NewService(timeout time.Duration, checkers ...Checker) *Service {
	if timeout <= 0 {
		timeout = DefaultCheckTimeout
	}
	return &Service{checkers: checkers, timeout: timeout}
}

// Check returns one result per checker, in registration order.
func (s *Service) Check(ctx context.Context) []Result {
	results := make([]Result, len(s.checkers))

	var wg sync.WaitGroup
	for i, c := range s.checkers {
		wg.Go(func() {
			cctx, cancel := context.WithTimeout(ctx, s.timeout)
			defer cancel()
			results[i] = Result{Name: c.Name(), Err: runCheck(cctx, c)}
		})
	}
	wg.Wait()

	return results
}

// runCheck returns as soon as ctx expires, even if the checker ignores cancellation.
func runCheck(ctx context.Context, c Checker) error {
	done := make(chan error, 1)
	go func() { done <- c.Check(ctx) }()

	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}
