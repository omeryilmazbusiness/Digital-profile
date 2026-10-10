package auth

import (
	"maps"
	"slices"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/api"
)

// TestGuard_PublicOperations pins the set of unauthenticated operations, so making an
// operation public is always a deliberate, reviewed change to this list.
func TestGuard_PublicOperations(t *testing.T) {
	spec, err := api.GetSpec()
	if err != nil {
		t.Fatal(err)
	}
	g := NewGuard(spec, nil, Cookies{})

	want := []string{
		"GetLiveness", "GetProfileBusinessCard", "GetProfileVCard", "GetPublicDocument", "GetPublicMedia", "GetPublicProfile",
		"GetPublicSite", "GetReadiness", "Login", "Logout", "RefreshSession",
	}
	if got := slices.Sorted(maps.Keys(g.public)); !slices.Equal(got, want) {
		t.Fatalf("public operations = %v, want %v", got, want)
	}
	for _, op := range []string{"GetCurrentAdmin", "ChangePassword", "UploadDocument", "UpdateSettings", "SomethingNew", ""} {
		if g.IsPublic(op) {
			t.Errorf("%q must be protected", op)
		}
	}
}
