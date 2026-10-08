package database_test

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbtest"
)

var discard = slog.New(slog.DiscardHandler)

func dbConfig(url string) config.DB {
	return config.DB{
		URL:             url,
		MaxConns:        4,
		MinConns:        0,
		MaxConnLifetime: time.Hour,
		MaxConnIdleTime: time.Minute,
		ConnectTimeout:  5 * time.Second,
	}
}

func TestOpen(t *testing.T) {
	t.Parallel()
	url := dbtest.NewURL(t)

	pool, err := database.Open(t.Context(), dbConfig(url), discard)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer pool.Close()

	var app, tz string
	if err := pool.QueryRow(t.Context(), "SELECT current_setting('application_name'), current_setting('TimeZone')").Scan(&app, &tz); err != nil {
		t.Fatal(err)
	}
	if app != "digital-profile-api" || tz != "UTC" {
		t.Errorf("session = (%q, %q), want (digital-profile-api, UTC)", app, tz)
	}
	if got := pool.Config().MaxConns; got != 4 {
		t.Errorf("MaxConns = %d, want 4", got)
	}
}

func TestOpenFailsFast(t *testing.T) {
	t.Parallel()

	cfg := dbConfig("postgres://nobody@127.0.0.1:1/none?sslmode=disable")
	cfg.ConnectTimeout = time.Second
	start := time.Now()
	if _, err := database.Open(t.Context(), cfg, discard); err == nil {
		t.Fatal("Open succeeded against a closed port")
	}
	if d := time.Since(start); d > 5*time.Second {
		t.Errorf("Open took %v, want to fail within the connect timeout", d)
	}

	if _, err := database.Open(t.Context(), dbConfig("://bad"), discard); err == nil {
		t.Fatal("Open accepted a malformed URL")
	}
}

func newTable(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(t.Context(), `CREATE TABLE items (
		id   int PRIMARY KEY,
		name citext NOT NULL UNIQUE CHECK (length(name) > 1),
		parent int REFERENCES items(id)
	)`)
	if err != nil {
		t.Fatal(err)
	}
}

func count(t *testing.T, pool *pgxpool.Pool) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM items").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func insert(ctx context.Context, pool *pgxpool.Pool, id int) error {
	_, err := database.Executor(ctx, pool).Exec(ctx, "INSERT INTO items (id, name) VALUES ($1, $2)", id, fmt.Sprintf("item-%d", id))
	return err
}

func TestTxManager(t *testing.T) {
	t.Parallel()
	pool := dbtest.New(t)
	newTable(t, pool)
	tm := database.NewTxManager(pool)
	errBoom := errors.New("boom")

	t.Run("commit", func(t *testing.T) {
		err := tm.WithinTx(t.Context(), func(ctx context.Context) error {
			return errors.Join(insert(ctx, pool, 1), insert(ctx, pool, 2))
		})
		if err != nil {
			t.Fatal(err)
		}
		if n := count(t, pool); n != 2 {
			t.Fatalf("rows = %d, want 2", n)
		}
	})

	t.Run("rollback on error", func(t *testing.T) {
		err := tm.WithinTx(t.Context(), func(ctx context.Context) error {
			if err := insert(ctx, pool, 3); err != nil {
				return err
			}
			return errBoom
		})
		if !errors.Is(err, errBoom) {
			t.Fatalf("err = %v, want boom", err)
		}
		if n := count(t, pool); n != 2 {
			t.Fatalf("rows = %d, want 2 after rollback", n)
		}
	})

	t.Run("nested joins outer transaction", func(t *testing.T) {
		err := tm.WithinTx(t.Context(), func(ctx context.Context) error {
			if err := tm.WithinTx(ctx, func(ctx context.Context) error { return insert(ctx, pool, 4) }); err != nil {
				return err
			}
			return errBoom
		})
		if !errors.Is(err, errBoom) {
			t.Fatalf("err = %v, want boom", err)
		}
		if n := count(t, pool); n != 2 {
			t.Fatalf("rows = %d, want inner write rolled back with outer", n)
		}
	})

	t.Run("rollback on panic", func(t *testing.T) {
		func() {
			defer func() {
				if recover() == nil {
					t.Fatal("panic was swallowed")
				}
			}()
			_ = tm.WithinTx(t.Context(), func(ctx context.Context) error {
				if err := insert(ctx, pool, 5); err != nil {
					return err
				}
				panic("kaboom")
			})
		}()
		if n := count(t, pool); n != 2 {
			t.Fatalf("rows = %d, want 2 after panic", n)
		}
		if s := pool.Stat(); s.AcquiredConns() != 0 {
			t.Fatalf("leaked %d connections", s.AcquiredConns())
		}
	})

	t.Run("cancelled context", func(t *testing.T) {
		ctx, cancel := context.WithCancel(t.Context())
		err := tm.WithinTx(ctx, func(ctx context.Context) error {
			if err := insert(ctx, pool, 6); err != nil {
				return err
			}
			cancel()
			return ctx.Err()
		})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err = %v, want context.Canceled", err)
		}
		if n := count(t, pool); n != 2 {
			t.Fatalf("rows = %d, want 2", n)
		}
	})
}

func TestMapError(t *testing.T) {
	t.Parallel()
	pool := dbtest.New(t)
	newTable(t, pool)
	ctx := t.Context()
	if err := insert(ctx, pool, 1); err != nil {
		t.Fatal(err)
	}

	exec := func(sql string, args ...any) error {
		_, err := pool.Exec(ctx, sql, args...)
		return err
	}
	var scratch int

	tests := []struct {
		name       string
		err        error
		kind       apperr.Kind
		constraint string
	}{
		{"no rows", pool.QueryRow(ctx, "SELECT id FROM items WHERE id = 99").Scan(&scratch), apperr.KindNotFound, ""},
		{"unique (case-insensitive citext)", exec("INSERT INTO items (id, name) VALUES (2, 'ITEM-1')"), apperr.KindConflict, "items_name_key"},
		{"foreign key", exec("INSERT INTO items (id, name, parent) VALUES (3, 'child', 42)"), apperr.KindConflict, "items_parent_fkey"},
		{"not null", exec("INSERT INTO items (id) VALUES (4)"), apperr.KindInvalid, ""},
		{"check", exec("INSERT INTO items (id, name) VALUES (5, 'x')"), apperr.KindInvalid, "items_name_check"},
		{"invalid text", exec("SELECT $1::uuid", "not-a-uuid"), apperr.KindInvalid, ""},
		{"syntax error is internal", exec("SELEC 1"), apperr.KindInternal, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.err == nil {
				t.Fatal("statement unexpectedly succeeded")
			}
			mapped := database.MapError(tt.err)
			if got := apperr.KindOf(mapped); got != tt.kind {
				t.Errorf("kind = %v, want %v (err: %v)", got, tt.kind, tt.err)
			}
			if !errors.Is(mapped, tt.err) {
				t.Error("original error not preserved in chain")
			}
			if got := database.ConstraintName(mapped); got != tt.constraint {
				t.Errorf("constraint = %q, want %q", got, tt.constraint)
			}
		})
	}

	t.Run("nil and already mapped pass through", func(t *testing.T) {
		if database.MapError(nil) != nil {
			t.Error("nil not preserved")
		}
		ae := apperr.Forbidden("nope")
		if got, _ := apperr.As(database.MapError(ae)); got == nil || got.Kind != apperr.KindForbidden || got.Message != "nope" {
			t.Error("apperr was re-wrapped")
		}
	})

	t.Run("sanitised messages", func(t *testing.T) {
		mapped := database.MapError(&pgconn.PgError{Code: "23505", Detail: "Key (email)=(secret@x.io) already exists."})
		ae, _ := apperr.As(mapped)
		if ae.Message != "resource already exists" {
			t.Errorf("message leaks driver detail: %q", ae.Message)
		}
	})
}

func TestMigrator(t *testing.T) {
	t.Parallel()
	pool := connect(t, dbtest.NewEmptyURL(t))

	m, err := database.NewMigrator(pool, db.Migrations, db.MigrationsDir, discard)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = m.Close() })
	expected := m.Expected()
	schema := database.SchemaCheck(pool, expected, discard)

	if v, dirty, err := m.Version(); err != nil || v != 0 || dirty {
		t.Fatalf("fresh Version = (%d, %v, %v), want (0, false, nil)", v, dirty, err)
	}
	if err := schema(t.Context()); err == nil {
		t.Fatal("SchemaCheck passed on an unmigrated database")
	}

	if err := m.Up(t.Context()); err != nil {
		t.Fatalf("Up: %v", err)
	}
	if err := m.Up(t.Context()); err != nil {
		t.Fatalf("second Up must be a no-op: %v", err)
	}
	if v, dirty, _ := m.Version(); v != expected || dirty {
		t.Fatalf("Version = (%d, %v), want (%d, false)", v, dirty, expected)
	}
	if err := schema(t.Context()); err != nil {
		t.Fatalf("SchemaCheck after Up: %v", err)
	}
	var hasCitext bool
	if err := pool.QueryRow(t.Context(), "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext')").Scan(&hasCitext); err != nil || !hasCitext {
		t.Fatalf("citext extension missing after Up (err: %v)", err)
	}

	if err := database.SchemaCheck(pool, expected+1, discard)(t.Context()); err == nil {
		t.Fatal("SchemaCheck passed although the binary expects a newer schema")
	}

	if err := m.Force(int(expected)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(t.Context(), "UPDATE schema_migrations SET dirty = true"); err != nil {
		t.Fatal(err)
	}
	if err := schema(t.Context()); err == nil {
		t.Fatal("SchemaCheck passed on a dirty schema")
	}
	if err := m.Force(int(expected)); err != nil {
		t.Fatal(err)
	}

	if err := m.Steps(t.Context(), -int(expected)); err != nil {
		t.Fatalf("down: %v", err)
	}
	if v, _, _ := m.Version(); v != 0 {
		t.Fatalf("Version after full down = %d, want 0", v)
	}
	if err := m.Up(t.Context()); err != nil {
		t.Fatalf("re-Up after down (down migrations must be reversible): %v", err)
	}
}

func TestLatestVersion(t *testing.T) {
	t.Parallel()
	fsys := fstest.MapFS{
		"m/000001_a.up.sql":   {},
		"m/000001_a.down.sql": {},
		"m/000012_b.up.sql":   {},
		"m/000003_c.up.sql":   {},
		"m/README.md":         {},
	}
	if v, err := database.LatestVersion(fsys, "m"); err != nil || v != 12 {
		t.Fatalf("LatestVersion = (%d, %v), want 12", v, err)
	}
	if _, err := database.LatestVersion(fstest.MapFS{"m/x.sql": {}}, "m"); err == nil {
		t.Fatal("expected error for a directory without migrations")
	}
	if v, err := database.LatestVersion(db.Migrations, db.MigrationsDir); err != nil || v < 1 {
		t.Fatalf("embedded migrations: (%d, %v)", v, err)
	}
}

func TestPingCheck(t *testing.T) {
	t.Parallel()
	pool := dbtest.New(t)
	check := database.PingCheck(pool, discard)
	if err := check(t.Context()); err != nil {
		t.Fatalf("PingCheck: %v", err)
	}

	pool.Close()
	err := check(t.Context())
	if err == nil {
		t.Fatal("PingCheck passed on a closed pool")
	}
	if err.Error() != "database query failed" {
		t.Errorf("message leaks driver detail: %q", err)
	}
}

func connect(t *testing.T, url string) *pgxpool.Pool {
	t.Helper()
	pool, err := pgxpool.New(t.Context(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}
