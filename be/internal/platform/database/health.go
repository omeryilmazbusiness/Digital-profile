package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database/dbgen"
)

// Health checks return errors that are safe to expose in probe responses;
// underlying driver errors are logged instead.

// PingCheck runs a real statement through the pool.
func PingCheck(pool *pgxpool.Pool, log *slog.Logger) func(context.Context) error {
	q := dbgen.New(pool)
	return func(ctx context.Context) error {
		if _, err := q.Ping(ctx); err != nil {
			log.WarnContext(ctx, "database health check failed", "error", err)
			return errors.New("database query failed")
		}
		return nil
	}
}

// SchemaCheck fails unless the schema is clean and exactly at the version this binary ships.
// It reads golang-migrate's bookkeeping table directly so no migrator stays open at runtime.
func SchemaCheck(pool *pgxpool.Pool, expected uint, log *slog.Logger) func(context.Context) error {
	query := fmt.Sprintf("SELECT version, dirty FROM %s LIMIT 1", pgx.Identifier{migrationsTable}.Sanitize())
	return func(ctx context.Context) error {
		var (
			version int64
			dirty   bool
		)
		err := pool.QueryRow(ctx, query).Scan(&version, &dirty)
		switch {
		case errors.Is(err, pgx.ErrNoRows), isUndefinedTable(err):
			return fmt.Errorf("no migrations applied, binary expects version %d", expected)
		case err != nil:
			log.WarnContext(ctx, "schema health check failed", "error", err)
			return errors.New("cannot read schema version")
		case dirty:
			return fmt.Errorf("schema is dirty at version %d", version)
		case version != int64(expected): //nolint:gosec // migration versions are small positive integers
			return fmt.Errorf("schema at version %d, binary expects %d", version, expected)
		}
		return nil
	}
}
