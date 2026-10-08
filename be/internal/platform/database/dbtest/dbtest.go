// Package dbtest gives integration tests an isolated, fully migrated PostgreSQL database.
//
// A server is resolved once per test binary: TEST_DATABASE_URL if set, otherwise a
// testcontainers PostgreSQL. Migrations run once into a template database whose name is
// derived from the migration contents; each test then gets a cheap CREATE DATABASE … TEMPLATE
// clone that is dropped on cleanup. Tests can therefore run in parallel without sharing state.
//
// Without Docker or TEST_DATABASE_URL tests are skipped locally and fail when CI is set.
package dbtest

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
)

const (
	// EnvURL points at an existing server; the user needs CREATEDB.
	EnvURL = "TEST_DATABASE_URL"

	image          = "postgres:16.15-alpine"
	setupTimeout   = 2 * time.Minute
	templateLockID = 727_001
	codeInUse      = "55006" // object_in_use: template still has a connection
)

var (
	serverOnce sync.Once
	serverURL  string
	errServer  error

	templateOnce sync.Once
	templateName string
	errTemplate  error
)

// New returns a pool connected to a fresh migrated database, closed and dropped on cleanup.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	return connect(t, NewURL(t))
}

// NewURL is New for code that opens its own connections, such as app bootstrap tests.
func NewURL(t testing.TB) string {
	t.Helper()
	tpl := template(t)
	return createDatabase(t, tpl)
}

// NewEmptyURL returns a fresh database without migrations, for testing the migrator itself.
func NewEmptyURL(t testing.TB) string {
	t.Helper()
	return createDatabase(t, "template0")
}

func server(t testing.TB) string {
	t.Helper()
	serverOnce.Do(func() { serverURL, errServer = resolveServer() })
	if errServer != nil {
		unavailable(t, errServer)
	}
	return serverURL
}

func resolveServer() (string, error) {
	if u := os.Getenv(EnvURL); u != "" {
		return u, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), setupTimeout)
	defer cancel()

	// The container lives for the whole test binary; testcontainers' reaper removes it on exit.
	c, err := tcpostgres.Run(ctx, image,
		tcpostgres.WithDatabase("postgres"),
		tcpostgres.WithUsername("postgres"),
		tcpostgres.WithPassword("postgres"),
		tcpostgres.BasicWaitStrategies(),
		testcontainers.WithLogger(nopLogger{}),
	)
	if err != nil {
		return "", fmt.Errorf("start postgres container (set %s to use an existing server): %w", EnvURL, err)
	}
	return c.ConnectionString(ctx, "sslmode=disable")
}

func template(t testing.TB) string {
	t.Helper()
	base := server(t)
	templateOnce.Do(func() { templateName, errTemplate = buildTemplate(base) })
	if errTemplate != nil {
		t.Fatalf("dbtest: build template: %v", errTemplate)
	}
	return templateName
}

// buildTemplate is idempotent across concurrent test binaries (go test ./... runs packages
// in parallel): an advisory lock serialises creation and the content hash in the name means
// a template is reused only while the migrations are unchanged.
func buildTemplate(base string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), setupTimeout)
	defer cancel()

	name, err := templateNameFor(db.Migrations, db.MigrationsDir)
	if err != nil {
		return "", err
	}

	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		return "", fmt.Errorf("connect admin: %w", err)
	}
	defer func() { _ = admin.Close(context.WithoutCancel(ctx)) }()

	if _, err := admin.Exec(ctx, "SELECT pg_advisory_lock($1)", templateLockID); err != nil {
		return "", fmt.Errorf("lock: %w", err)
	}
	defer func() { _, _ = admin.Exec(context.WithoutCancel(ctx), "SELECT pg_advisory_unlock($1)", templateLockID) }()

	var exists bool
	if err := admin.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1)", name).Scan(&exists); err != nil {
		return "", fmt.Errorf("lookup template: %w", err)
	}
	if exists {
		return name, nil
	}

	// Build under a scratch name and rename at the end, so an interrupted run never leaves
	// a half-migrated database behind under the final name.
	scratch := name + "_build"
	if _, err := admin.Exec(ctx, "DROP DATABASE IF EXISTS "+ident(scratch)+" WITH (FORCE)"); err != nil {
		return "", fmt.Errorf("drop stale scratch: %w", err)
	}
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+ident(scratch)+" TEMPLATE template0"); err != nil {
		return "", fmt.Errorf("create scratch: %w", err)
	}
	if err := migrate(ctx, withDatabase(base, scratch)); err != nil {
		_, _ = admin.Exec(context.WithoutCancel(ctx), "DROP DATABASE IF EXISTS "+ident(scratch)+" WITH (FORCE)")
		return "", err
	}
	if _, err := admin.Exec(ctx, "ALTER DATABASE "+ident(scratch)+" RENAME TO "+ident(name)); err != nil {
		return "", fmt.Errorf("finalise template: %w", err)
	}
	return name, nil
}

func migrate(ctx context.Context, dsn string) error {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect template: %w", err)
	}
	defer pool.Close()

	m, err := database.NewMigrator(pool, db.Migrations, db.MigrationsDir, slog.New(slog.DiscardHandler))
	if err != nil {
		return err
	}
	defer func() { _ = m.Close() }()
	return m.Up(ctx)
}

func createDatabase(t testing.TB, tpl string) string {
	t.Helper()
	base := server(t)
	ctx, cancel := context.WithTimeout(t.Context(), setupTimeout)
	defer cancel()

	admin, err := pgx.Connect(ctx, base)
	if err != nil {
		t.Fatalf("dbtest: connect admin: %v", err)
	}
	defer func() { _ = admin.Close(context.WithoutCancel(ctx)) }()

	name := "test_" + randomSuffix(t)
	stmt := "CREATE DATABASE " + ident(name) + " TEMPLATE " + ident(tpl)
	for attempt := 0; ; attempt++ {
		_, err = admin.Exec(ctx, stmt)
		var pgErr *pgconn.PgError
		if err == nil || !errors.As(err, &pgErr) || pgErr.Code != codeInUse || attempt == 20 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("dbtest: create database: %v", err)
	}

	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		conn, err := pgx.Connect(ctx, base)
		if err != nil {
			t.Errorf("dbtest: cleanup connect: %v", err)
			return
		}
		defer func() { _ = conn.Close(ctx) }()
		if _, err := conn.Exec(ctx, "DROP DATABASE IF EXISTS "+ident(name)+" WITH (FORCE)"); err != nil {
			t.Errorf("dbtest: drop %s: %v", name, err)
		}
	})

	return withDatabase(base, name)
}

func connect(t testing.TB, dsn string) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(t.Context(), dsn)
	if err != nil {
		t.Fatalf("dbtest: connect: %v", err)
	}
	// Registered after createDatabase's cleanup, so it runs first (LIFO) and the drop sees no connections.
	t.Cleanup(pool.Close)
	return pool
}

func templateNameFor(fsys fs.FS, dir string) (string, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return "", fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	slices.Sort(names)

	h := sha256.New()
	for _, n := range names {
		f, err := fsys.Open(dir + "/" + n)
		if err != nil {
			return "", err
		}
		_, _ = io.WriteString(h, n)
		_, err = io.Copy(h, f)
		_ = f.Close()
		if err != nil {
			return "", err
		}
	}
	return "tpl_" + hex.EncodeToString(h.Sum(nil))[:16], nil
}

func withDatabase(dsn, name string) string {
	u, err := url.Parse(dsn)
	if err != nil {
		panic(fmt.Sprintf("dbtest: invalid server url: %v", err))
	}
	u.Path = "/" + name
	return u.String()
}

func ident(name string) string { return pgx.Identifier{name}.Sanitize() }

func randomSuffix(t testing.TB) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		t.Fatalf("dbtest: random: %v", err)
	}
	return hex.EncodeToString(b)
}

func unavailable(t testing.TB, err error) {
	t.Helper()
	if os.Getenv("CI") != "" {
		t.Fatalf("dbtest: database unavailable in CI: %v", err)
	}
	t.Skipf("dbtest: skipping, no database (%s or Docker): %s", EnvURL, firstLine(err.Error()))
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

type nopLogger struct{}

func (nopLogger) Printf(string, ...any) {}
