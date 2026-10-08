package main

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

func TestRun_Usage(t *testing.T) {
	for _, args := range [][]string{
		nil,
		{"migrate"},
		{"seed", "up"},
		{"migrate", "sideways"},
		{"migrate", "up", "-bogus"},
		{"migrate", "down", "-steps", "0"},
		{"migrate", "force"},
	} {
		// Usage errors must be reported before any connection attempt.
		t.Setenv("DATABASE_URL", "postgres://unused@127.0.0.1:1/x")
		if err := run(t.Context(), args, &bytes.Buffer{}); !errors.Is(err, errUsage) {
			t.Errorf("args %v: err = %v, want usage error", args, err)
		}
	}
}

func TestRun_Migrate(t *testing.T) {
	t.Setenv("DATABASE_URL", dbtest.NewEmptyURL(t))
	t.Setenv("LOG_LEVEL", "error")

	latest, err := database.LatestVersion(db.Migrations, db.MigrationsDir)
	if err != nil {
		t.Fatal(err)
	}
	clean := fmt.Sprintf("version=%d expected=%d dirty=false", latest, latest)
	oneBack := fmt.Sprintf("version=%d expected=%d dirty=false", latest-1, latest)

	steps := []struct {
		args []string
		want string
	}{
		{[]string{"migrate", "version"}, fmt.Sprintf("version=0 expected=%d dirty=false", latest)},
		{[]string{"migrate", "up"}, clean},
		{[]string{"migrate", "down", "-steps", "1"}, oneBack},
		{[]string{"migrate", "force", "-version", strconv.FormatUint(uint64(latest), 10)}, clean},
	}
	for _, s := range steps {
		var out bytes.Buffer
		if err := run(t.Context(), s.args, &out); err != nil {
			t.Fatalf("%v: %v", s.args, err)
		}
		if !strings.Contains(out.String(), s.want) {
			t.Fatalf("%v: output %q, want %q", s.args, out.String(), s.want)
		}
	}
}
