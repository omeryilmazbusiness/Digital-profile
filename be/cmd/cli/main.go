// Command cli runs operational tasks against the configured database.
//
//	cli migrate up                 apply all pending migrations
//	cli migrate down -steps N      roll back N migrations (default 1)
//	cli migrate version            print the applied and expected schema versions
//	cli migrate force -version N   mark version N as applied and clean, after a manual repair
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/logger"
)

const usage = `usage: cli migrate <up | down [-steps N] | version | force -version N>`

var errUsage = errors.New(usage)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := run(ctx, os.Args[1:], os.Stdout)
	stop()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		if errors.Is(err, errUsage) {
			os.Exit(2)
		}
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, out io.Writer) error {
	if len(args) < 2 || args[0] != "migrate" {
		return errUsage
	}
	cmd, rest := args[1], args[2:]

	fs := flag.NewFlagSet("migrate "+cmd, flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	steps := fs.Int("steps", 1, "number of migrations to roll back")
	version := fs.Int("version", -1, "version to force")
	if err := fs.Parse(rest); err != nil {
		return fmt.Errorf("%w: %w", errUsage, err)
	}
	switch {
	case cmd != "up" && cmd != "down" && cmd != "version" && cmd != "force":
		return errUsage
	case cmd == "down" && *steps < 1:
		return fmt.Errorf("%w: -steps must be at least 1", errUsage)
	case cmd == "force" && *version < 0:
		return fmt.Errorf("%w: -version is required", errUsage)
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(os.Stderr, cfg.Log, slog.String("service", "cli"))

	pool, err := database.Open(ctx, cfg.DB, log)
	if err != nil {
		return err
	}
	defer pool.Close()

	m, err := database.NewMigrator(pool, db.Migrations, db.MigrationsDir, log)
	if err != nil {
		return err
	}
	defer func() { _ = m.Close() }()

	switch cmd {
	case "up":
		err = m.Up(ctx)
	case "down":
		err = m.Steps(ctx, -*steps)
	case "force":
		err = m.Force(*version)
	}
	if err != nil {
		return err
	}

	v, dirty, err := m.Version()
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(out, "version=%d expected=%d dirty=%t\n", v, m.Expected(), dirty)
	return err
}
