// Package db holds SQL assets: migrations (embedded into the binary) and sqlc queries.
package db

import "embed"

//go:generate go tool -modfile=../tools/go.mod sqlc generate -f ../sqlc.yaml

// Migrations contains golang-migrate files under "migrations/".
//
//go:embed migrations/*.sql
var Migrations embed.FS

// MigrationsDir is the directory inside Migrations that holds the files.
const MigrationsDir = "migrations"
