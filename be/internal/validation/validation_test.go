package validation_test

import (
	"testing"
	"time"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/validation"
)

type stay struct {
	CheckIn  time.Time `json:"checkIn"  validate:"required"`
	CheckOut time.Time `json:"checkOut" validate:"required,gtfield=CheckIn"`
}

type input struct {
	Company  string   `json:"companyName" validate:"required,min=2,max=10"`
	Email    string   `json:"email"       validate:"omitempty,email"`
	Phone    string   `json:"phone"       validate:"omitempty,e164"`
	Rooms    int      `json:"rooms"       validate:"gte=1,lte=500"`
	MealPlan string   `json:"mealPlan"    validate:"oneof=RO BB HB FB"`
	Stay     stay     `json:"stay"`
	Tags     []string `json:"tags"        validate:"max=2"`
	Internal string   `json:"-"           validate:"omitempty,uuid"`
}

func valid() input {
	now := time.Now()
	return input{
		Company:  "Acme",
		Email:    "a@b.co",
		Phone:    "+966500000000",
		Rooms:    3,
		MealPlan: "BB",
		Stay:     stay{CheckIn: now, CheckOut: now.Add(48 * time.Hour)},
	}
}

func fieldMessages(t *testing.T, err error) map[string]string {
	t.Helper()
	e, ok := apperr.As(err)
	if !ok || e.Kind != apperr.KindInvalid {
		t.Fatalf("err = %v, want KindInvalid", err)
	}
	if e.Message != validation.Message {
		t.Errorf("Message = %q", e.Message)
	}
	out := map[string]string{}
	for _, f := range e.Fields {
		out[f.Field] = f.Message
	}
	return out
}

func TestStruct_Valid(t *testing.T) {
	if err := validation.New().Struct(valid()); err != nil {
		t.Fatalf("Struct() = %v, want nil", err)
	}
}

func TestStruct_ReportsEveryFieldWithJSONNames(t *testing.T) {
	in := valid()
	in.Company = "A"
	in.Email = "not-an-email"
	in.Phone = "0500 000 00 00"
	in.Rooms = 0
	in.MealPlan = "XX"
	in.Stay.CheckOut = in.Stay.CheckIn.Add(-time.Hour)
	in.Tags = []string{"a", "b", "c"}

	got := fieldMessages(t, validation.New().Struct(in))

	want := map[string]string{
		"companyName":   "must be at least 2 characters",
		"email":         "must be a valid email address",
		"phone":         "must be a phone number in international format, e.g. +966500000000",
		"rooms":         "must be greater than or equal to 1",
		"mealPlan":      "must be one of: RO, BB, HB, FB",
		"stay.checkOut": "must be after checkIn",
		"tags":          "must contain at most 2 items",
	}
	for field, msg := range want {
		if got[field] != msg {
			t.Errorf("%s: got %q, want %q", field, got[field], msg)
		}
	}
	if len(got) != len(want) {
		t.Errorf("got %d field errors, want %d: %v", len(got), len(want), got)
	}
}

func TestStruct_RequiredAndUnknownTag(t *testing.T) {
	in := valid()
	in.Company = ""
	in.Internal = "nope"

	got := fieldMessages(t, validation.New().Struct(in))

	if got["companyName"] != "is required" {
		t.Errorf("companyName = %q", got["companyName"])
	}
	if got["Internal"] != "must be a valid UUID" {
		t.Errorf("json:\"-\" field should fall back to the Go name; got %v", got)
	}
}

func TestStruct_NonStructIsInternal(t *testing.T) {
	err := validation.New().Struct(42)
	if apperr.KindOf(err) != apperr.KindInternal {
		t.Fatalf("err = %v, want KindInternal", err)
	}
}
