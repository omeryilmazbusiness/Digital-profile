package apperr_test

import (
	"errors"
	"fmt"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

func TestWrap_KeepsKindAndChain(t *testing.T) {
	cause := errors.New("pq: duplicate key")
	base := apperr.Conflict("email already registered")

	err := fmt.Errorf("create admin: %w", base.Wrap(cause))

	got, ok := apperr.As(err)
	if !ok {
		t.Fatal("As() did not find *Error in chain")
	}
	if got.Kind != apperr.KindConflict || got.Message != "email already registered" {
		t.Errorf("got %+v", got)
	}
	if !errors.Is(err, cause) {
		t.Error("cause is not reachable via errors.Is")
	}
	if base.Unwrap() != nil {
		t.Error("Wrap mutated the original error")
	}
}

func TestKindOf(t *testing.T) {
	tests := []struct {
		err  error
		want apperr.Kind
	}{
		{apperr.NotFound("x"), apperr.KindNotFound},
		{fmt.Errorf("ctx: %w", apperr.Forbidden("x")), apperr.KindForbidden},
		{apperr.Invalid("x", apperr.FieldError{Field: "a", Message: "b"}), apperr.KindInvalid},
		{apperr.Internal(errors.New("boom")), apperr.KindInternal},
		{errors.New("plain"), apperr.KindInternal},
	}
	for _, tt := range tests {
		if got := apperr.KindOf(tt.err); got != tt.want {
			t.Errorf("KindOf(%v) = %s, want %s", tt.err, got, tt.want)
		}
	}
}

func TestInternal_HidesCauseFromMessage(t *testing.T) {
	err := apperr.Internal(errors.New("dial tcp 10.0.0.5:5432: refused"))
	if err.Message != "internal error" {
		t.Errorf("Message = %q leaks the cause", err.Message)
	}
	if err.Error() == err.Message {
		t.Error("Error() should include the cause for logs")
	}
}

func TestKind_String(t *testing.T) {
	for k := apperr.KindInternal; k <= apperr.KindUnavailable; k++ {
		if k.String() == "" {
			t.Errorf("Kind(%d).String() is empty", k)
		}
	}
}
