package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is satisfied by *pgxpool.Pool and pgx.Tx, and matches sqlc's generated DBTX.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

type txKey struct{}

// Executor returns the transaction bound to ctx by TxManager, or the pool otherwise.
// Repositories call it for every statement so they work both inside and outside a transaction.
func Executor(ctx context.Context, pool *pgxpool.Pool) DBTX {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return tx
	}
	return pool
}

// TxManager runs units of work atomically. Services depend on the Transactor interface,
// keeping them free of pgx types.
type TxManager struct {
	pool *pgxpool.Pool
}

// Transactor is the service-facing abstraction over TxManager.
type Transactor interface {
	WithinTx(ctx context.Context, fn func(ctx context.Context) error) error
}

var _ Transactor = (*TxManager)(nil)

func NewTxManager(pool *pgxpool.Pool) *TxManager { return &TxManager{pool: pool} }

// WithinTx commits if fn returns nil and rolls back on error or panic.
// Nested calls join the outer transaction, so composed services stay atomic as a whole.
func (m *TxManager) WithinTx(ctx context.Context, fn func(ctx context.Context) error) (err error) {
	if _, ok := ctx.Value(txKey{}).(pgx.Tx); ok {
		return fn(ctx)
	}

	tx, err := m.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
			panic(p)
		}
		if err != nil {
			if rbErr := tx.Rollback(context.WithoutCancel(ctx)); rbErr != nil && !errors.Is(rbErr, pgx.ErrTxClosed) {
				err = errors.Join(err, fmt.Errorf("rollback: %w", rbErr))
			}
		}
	}()

	if fnErr := fn(context.WithValue(ctx, txKey{}, tx)); fnErr != nil {
		return fnErr
	}
	if commitErr := tx.Commit(ctx); commitErr != nil {
		return fmt.Errorf("commit transaction: %w", commitErr)
	}
	return nil
}
