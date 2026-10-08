package database

import (
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
)

// PostgreSQL SQLSTATE codes translated by MapError.
const (
	codeUniqueViolation     = "23505"
	codeForeignKeyViolation = "23503"
	codeNotNullViolation    = "23502"
	codeCheckViolation      = "23514"
	codeInvalidText         = "22P02"
	codeUndefinedTable      = "42P01"
)

func isUndefinedTable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == codeUndefinedTable
}

// MapError translates driver errors into apperr kinds with client-safe messages.
// The original error stays in the chain for logging. Unknown errors become internal.
func MapError(err error) error {
	if err == nil {
		return nil
	}
	if _, ok := apperr.As(err); ok {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return apperr.NotFound("resource not found").Wrap(err)
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case codeUniqueViolation:
			return apperr.Conflict("resource already exists").Wrap(err)
		case codeForeignKeyViolation:
			return apperr.Conflict("operation conflicts with related data").Wrap(err)
		case codeNotNullViolation, codeCheckViolation, codeInvalidText:
			return apperr.Invalid("value rejected by data constraints").Wrap(err)
		}
	}
	return apperr.Internal(err)
}

// ConstraintName returns the violated constraint, letting repositories map specific
// constraints (e.g. "admin_users_email_key") to precise messages.
func ConstraintName(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.ConstraintName
	}
	return ""
}
