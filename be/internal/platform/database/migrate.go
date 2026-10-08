package database

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"regexp"
	"strconv"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

const migrationsTable = "schema_migrations"

var upFile = regexp.MustCompile(`^(\d+)_.+\.up\.sql$`)

// Migrator applies embedded golang-migrate files. It holds a Postgres advisory lock while
// migrating, so concurrent instances cannot run migrations twice.
type Migrator struct {
	m        *migrate.Migrate
	expected uint
}

// NewMigrator reads migrations from dir inside fsys and targets the pool's database.
func NewMigrator(pool *pgxpool.Pool, fsys fs.FS, dir string, log *slog.Logger) (*Migrator, error) {
	expected, err := LatestVersion(fsys, dir)
	if err != nil {
		return nil, err
	}

	src, err := iofs.New(fsys, dir)
	if err != nil {
		return nil, fmt.Errorf("open migrations: %w", err)
	}
	drv, err := pgxmigrate.WithInstance(stdlib.OpenDBFromPool(pool), &pgxmigrate.Config{MigrationsTable: migrationsTable})
	if err != nil {
		_ = src.Close()
		return nil, fmt.Errorf("init migration driver: %w", err)
	}
	m, err := migrate.NewWithInstance("iofs", src, "pgx5", drv)
	if err != nil {
		_ = src.Close()
		return nil, fmt.Errorf("init migrator: %w", err)
	}
	m.Log = migrateLogger{log: log}

	return &Migrator{m: m, expected: expected}, nil
}

// Expected is the highest version shipped with this binary.
func (mg *Migrator) Expected() uint { return mg.expected }

// Up applies all pending migrations. Cancelling ctx stops after the current migration.
func (mg *Migrator) Up(ctx context.Context) error {
	return mg.run(ctx, mg.m.Up)
}

// Steps migrates n steps up (n > 0) or down (n < 0).
func (mg *Migrator) Steps(ctx context.Context, n int) error {
	return mg.run(ctx, func() error { return mg.m.Steps(n) })
}

// Force sets the version without running migrations, clearing the dirty flag.
// Use only after manually repairing a failed migration.
func (mg *Migrator) Force(version int) error {
	if err := mg.m.Force(version); err != nil {
		return fmt.Errorf("force version %d: %w", version, err)
	}
	return nil
}

// Version reports the applied version; 0 means no migrations have run.
func (mg *Migrator) Version() (version uint, dirty bool, err error) {
	v, d, err := mg.m.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		return 0, false, nil
	}
	if err != nil {
		return 0, false, fmt.Errorf("read schema version: %w", err)
	}
	return v, d, nil
}

// Close releases the source and the dedicated connection the driver holds (not the pool).
// Close the Migrator as soon as migrations are done; it pins one pool connection while open.
func (mg *Migrator) Close() error {
	srcErr, dbErr := mg.m.Close()
	return errors.Join(srcErr, dbErr)
}

func (mg *Migrator) run(ctx context.Context, op func() error) error {
	stop := context.AfterFunc(ctx, func() {
		select {
		case mg.m.GracefulStop <- true:
		default:
		}
	})
	defer stop()

	if err := op(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}

// LatestVersion returns the highest migration version found in dir.
func LatestVersion(fsys fs.FS, dir string) (uint, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return 0, fmt.Errorf("read migrations: %w", err)
	}
	var latest uint64
	for _, e := range entries {
		m := upFile.FindStringSubmatch(e.Name())
		if m == nil {
			continue
		}
		v, err := strconv.ParseUint(m[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("migration %q: %w", e.Name(), err)
		}
		latest = max(latest, v)
	}
	if latest == 0 {
		return 0, fmt.Errorf("no migrations found in %q", dir)
	}
	return uint(latest), nil
}

type migrateLogger struct{ log *slog.Logger }

func (l migrateLogger) Printf(format string, v ...any) {
	l.log.Info("migrate: " + fmt.Sprintf(format, v...))
}

func (migrateLogger) Verbose() bool { return false }
