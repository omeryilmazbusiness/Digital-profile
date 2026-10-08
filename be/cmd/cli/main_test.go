package main

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"testing"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
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
		{"admin"},
		{"admin", "create"},
		{"admin", "delete", "-email", "a@example.com"},
		{"admin", "reset-password", "-email", " "},
	} {
		// Usage errors must be reported before any connection attempt.
		t.Setenv("DATABASE_URL", "postgres://unused@127.0.0.1:1/x")
		if err := run(t.Context(), args, stdio{in: strings.NewReader(""), out: &bytes.Buffer{}, err: &bytes.Buffer{}}); !errors.Is(err, errUsage) {
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
		// Every migration must be reversible: roll all the way back and re-apply.
		{[]string{"migrate", "down", "-steps", strconv.FormatUint(uint64(latest), 10)}, fmt.Sprintf("version=0 expected=%d dirty=false", latest)},
		{[]string{"migrate", "up"}, clean},
		{[]string{"migrate", "down", "-steps", "1"}, oneBack},
		{[]string{"migrate", "force", "-version", strconv.FormatUint(uint64(latest), 10)}, clean},
	}
	for _, s := range steps {
		var out bytes.Buffer
		if err := run(t.Context(), s.args, stdio{in: strings.NewReader(""), out: &out, err: &bytes.Buffer{}}); err != nil {
			t.Fatalf("%v: %v", s.args, err)
		}
		if !strings.Contains(out.String(), s.want) {
			t.Fatalf("%v: output %q, want %q", s.args, out.String(), s.want)
		}
	}
}

func cliIO(stdin string, out *bytes.Buffer) stdio {
	return stdio{in: strings.NewReader(stdin), out: out, err: &bytes.Buffer{}}
}

func TestRun_Admin(t *testing.T) {
	t.Setenv("DATABASE_URL", dbtest.NewURL(t))
	t.Setenv("LOG_LEVEL", "error")
	ctx := t.Context()

	var out bytes.Buffer
	if err := run(ctx, []string{"admin", "create", "-email", "Admin@Example.com"}, cliIO("correct horse battery staple\n", &out)); err != nil {
		t.Fatalf("create: %v", err)
	}
	if !strings.Contains(out.String(), "admin created: admin@example.com") {
		t.Errorf("output = %q", out.String())
	}

	err := run(ctx, []string{"admin", "create", "-email", "other@example.com"}, cliIO("another long password\n", &out))
	if err == nil || !strings.Contains(err.Error(), "already exists") {
		t.Errorf("second create err = %v", err)
	}
	err = run(ctx, []string{"admin", "reset-password", "-email", "admin@example.com"}, cliIO("short\n", &out))
	if err == nil || !strings.Contains(err.Error(), "password: must be at least") {
		t.Errorf("weak reset err = %v", err)
	}
	err = run(ctx, []string{"admin", "reset-password", "-email", "admin@example.com"}, cliIO("", &out))
	if err == nil || !strings.Contains(err.Error(), "no password") {
		t.Errorf("empty stdin err = %v", err)
	}

	out.Reset()
	if err := run(ctx, []string{"admin", "reset-password", "-email", "ADMIN@example.com"}, cliIO("a brand new passphrase", &out)); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if !strings.Contains(out.String(), "password reset") {
		t.Errorf("output = %q", out.String())
	}
}

func TestRun_JWTKey(t *testing.T) {
	var out bytes.Buffer
	if err := run(t.Context(), []string{"jwt-key"}, cliIO("", &out)); err != nil {
		t.Fatal(err)
	}
	keys, err := config.Auth{JWTKeys: []string{strings.TrimSpace(out.String())}}.SigningKeys()
	if err != nil || len(keys) != 1 || len(keys[0].Secret) != 32 {
		t.Fatalf("generated key %q unusable: %v", out.String(), err)
	}
}
