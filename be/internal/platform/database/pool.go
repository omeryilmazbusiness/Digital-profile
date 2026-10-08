// Package database provides the PostgreSQL connection pool, transaction management,
// migrations and error translation used by every repository.
package database

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
)

const applicationName = "digital-profile-api"

// Open creates a pool and verifies connectivity within cfg.ConnectTimeout.
func Open(ctx context.Context, cfg config.DB, log *slog.Logger) (*pgxpool.Pool, error) {
	pc, err := pgxpool.ParseConfig(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}

	pc.MaxConns = cfg.MaxConns
	pc.MinConns = cfg.MinConns
	pc.MaxConnLifetime = cfg.MaxConnLifetime
	pc.MaxConnLifetimeJitter = cfg.MaxConnLifetime / 10
	pc.MaxConnIdleTime = cfg.MaxConnIdleTime
	pc.ConnConfig.ConnectTimeout = cfg.ConnectTimeout
	if _, ok := pc.ConnConfig.RuntimeParams["application_name"]; !ok {
		pc.ConnConfig.RuntimeParams["application_name"] = applicationName
	}
	pc.ConnConfig.RuntimeParams["timezone"] = "UTC"

	pool, err := pgxpool.NewWithConfig(ctx, pc)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, cfg.ConnectTimeout)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	log.InfoContext(ctx, "database connected",
		"host", pc.ConnConfig.Host,
		"database", pc.ConnConfig.Database,
		"max_conns", pc.MaxConns,
	)
	return pool, nil
}
