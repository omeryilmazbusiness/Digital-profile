package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres keeps objects in the application database (table storage_objects), for
// deployments with neither a persistent disk nor an object store. Objects are read whole
// into memory, which suits the few images and brochures a site like this holds.
type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(pool *pgxpool.Pool) *Postgres { return &Postgres{pool: pool} }

func (p *Postgres) Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	data, err := io.ReadAll(r)
	if err != nil {
		return fmt.Errorf("storage: read: %w", err)
	}
	if size >= 0 && int64(len(data)) != size {
		return fmt.Errorf("storage: read %d bytes, expected %d", len(data), size)
	}
	_, err = p.pool.Exec(ctx, `
		INSERT INTO storage_objects (key, content_type, data) VALUES ($1, $2, $3)
		ON CONFLICT (key) DO UPDATE
		SET content_type = excluded.content_type, data = excluded.data, updated_at = now()`,
		key, contentType, data)
	if err != nil {
		return fmt.Errorf("storage: put: %w", err)
	}
	return nil
}

func (p *Postgres) Get(ctx context.Context, key string) (io.ReadCloser, Object, error) {
	if err := checkKey(key); err != nil {
		return nil, Object{}, err
	}
	var (
		obj  Object
		data []byte
	)
	err := p.pool.QueryRow(ctx,
		`SELECT content_type, updated_at, data FROM storage_objects WHERE key = $1`, key,
	).Scan(&obj.ContentType, &obj.ModTime, &data)
	if err != nil {
		return nil, Object{}, mapRowError(err)
	}
	obj.Size = int64(len(data))
	return io.NopCloser(bytes.NewReader(data)), obj, nil
}

func (p *Postgres) Stat(ctx context.Context, key string) (Object, error) {
	if err := checkKey(key); err != nil {
		return Object{}, err
	}
	var obj Object
	err := p.pool.QueryRow(ctx,
		`SELECT content_type, updated_at, octet_length(data) FROM storage_objects WHERE key = $1`, key,
	).Scan(&obj.ContentType, &obj.ModTime, &obj.Size)
	if err != nil {
		return Object{}, mapRowError(err)
	}
	return obj, nil
}

func (p *Postgres) Delete(ctx context.Context, key string) error {
	if err := checkKey(key); err != nil {
		return err
	}
	if _, err := p.pool.Exec(ctx, `DELETE FROM storage_objects WHERE key = $1`, key); err != nil {
		return fmt.Errorf("storage: delete: %w", err)
	}
	return nil
}

// Ping checks the table is there, i.e. the schema has been migrated.
func (p *Postgres) Ping(ctx context.Context) error {
	var at time.Time
	err := p.pool.QueryRow(ctx, `SELECT now() FROM storage_objects LIMIT 1`).Scan(&at)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("storage: %w", err)
	}
	return nil
}

func mapRowError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return fmt.Errorf("storage: %w", err)
}
