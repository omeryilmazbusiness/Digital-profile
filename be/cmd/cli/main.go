// Command cli runs operational tasks against the configured database.
//
//	cli migrate up                         apply all pending migrations
//	cli migrate down -steps N              roll back N migrations (default 1)
//	cli migrate version                    print the applied and expected schema versions
//	cli migrate force -version N           mark version N as applied and clean, after a manual repair
//	cli admin create -email E              create the admin account (password from prompt or stdin)
//	cli admin reset-password -email E      set a new password, unlock and sign out everywhere
//	cli jwt-key                            print a new AUTH_JWT_KEYS entry
//
// Passwords are never accepted as arguments, so they stay out of shell history and process lists.
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"golang.org/x/term"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/omeryilmazbusiness/digital-profile/be/db"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/apperr"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/config"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/modules/auth"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/database"
	"github.com/omeryilmazbusiness/digital-profile/be/internal/platform/logger"
)

const usage = `usage:
  cli migrate <up | down [-steps N] | version | force -version N>
  cli admin <create | reset-password> -email EMAIL
  cli jwt-key`

var errUsage = errors.New(usage)

// stdio bundles the streams so tests can drive the CLI without a terminal.
type stdio struct {
	in  io.Reader
	out io.Writer
	err io.Writer
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := run(ctx, os.Args[1:], stdio{in: os.Stdin, out: os.Stdout, err: os.Stderr})
	stop()
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		if errors.Is(err, errUsage) {
			os.Exit(2)
		}
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, std stdio) error {
	if len(args) == 0 {
		return errUsage
	}
	switch args[0] {
	case "migrate":
		return runMigrate(ctx, args[1:], std)
	case "admin":
		return runAdmin(ctx, args[1:], std)
	case "jwt-key":
		return printJWTKey(std.out)
	default:
		return errUsage
	}
}

func runMigrate(ctx context.Context, args []string, std stdio) error {
	if len(args) == 0 {
		return errUsage
	}
	cmd, rest := args[0], args[1:]

	fs := flag.NewFlagSet("migrate "+cmd, flag.ContinueOnError)
	fs.SetOutput(nopWriter{})
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

	return withDB(ctx, std, func(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) error {
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
		_, err = fmt.Fprintf(std.out, "version=%d expected=%d dirty=%t\n", v, m.Expected(), dirty)
		return err
	})
}

func runAdmin(ctx context.Context, args []string, std stdio) error {
	if len(args) == 0 {
		return errUsage
	}
	cmd, rest := args[0], args[1:]
	fs := flag.NewFlagSet("admin "+cmd, flag.ContinueOnError)
	fs.SetOutput(nopWriter{})
	email := fs.String("email", "", "admin email")
	if err := fs.Parse(rest); err != nil {
		return fmt.Errorf("%w: %w", errUsage, err)
	}
	if (cmd != "create" && cmd != "reset-password") || strings.TrimSpace(*email) == "" {
		return fmt.Errorf("%w: -email is required", errUsage)
	}

	password, err := readPassword(std)
	if err != nil {
		return err
	}

	return withDB(ctx, std, func(ctx context.Context, pool *pgxpool.Pool, _ *slog.Logger) error {
		accounts := auth.NewAccounts(pool, auth.NewPasswordHasher(auth.DefaultArgon2Params, 1), func() time.Time { return time.Now().UTC() })
		if cmd == "create" {
			admin, err := accounts.Create(ctx, *email, password)
			if err != nil {
				return describe(err)
			}
			_, err = fmt.Fprintf(std.out, "admin created: %s (%s)\n", admin.Email, admin.ID)
			return err
		}
		if err := accounts.ResetPassword(ctx, *email, password); err != nil {
			return describe(err)
		}
		_, err := fmt.Fprintln(std.out, "password reset; all sessions signed out")
		return err
	})
}

// readPassword prompts twice without echo on a terminal, or reads one line from piped stdin
// (for automation: `printf '%s\n' "$PW" | cli admin create -email ...`).
func readPassword(std stdio) (string, error) {
	if f, ok := std.in.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
		fmt.Fprintf(std.err, "New password (%d–%d characters): ", auth.MinPasswordLen, auth.MaxPasswordLen)
		first, err := term.ReadPassword(int(f.Fd()))
		fmt.Fprintln(std.err)
		if err != nil {
			return "", err
		}
		fmt.Fprint(std.err, "Repeat password: ")
		second, err := term.ReadPassword(int(f.Fd()))
		fmt.Fprintln(std.err)
		if err != nil {
			return "", err
		}
		if !bytes.Equal(first, second) {
			return "", errors.New("passwords do not match")
		}
		return string(first), nil
	}
	line, err := bufio.NewReader(std.in).ReadString('\n')
	if err != nil && (!errors.Is(err, io.EOF) || line == "") {
		return "", errors.New("no password on stdin")
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func printJWTKey(out io.Writer) error {
	id := make([]byte, 4)
	secret := make([]byte, 32)
	if _, err := rand.Read(id); err != nil {
		return err
	}
	if _, err := rand.Read(secret); err != nil {
		return err
	}
	_, err := fmt.Fprintf(out, "%s:%s\n", time.Now().UTC().Format("20060102")+"-"+hex.EncodeToString(id), base64.StdEncoding.EncodeToString(secret))
	return err
}

func withDB(ctx context.Context, std stdio, fn func(context.Context, *pgxpool.Pool, *slog.Logger) error) error {
	cfg, err := config.LoadCLI()
	if err != nil {
		return err
	}
	log := logger.New(std.err, cfg.Log, slog.String("service", "cli"))
	pool, err := database.Open(ctx, cfg.DB, log)
	if err != nil {
		return err
	}
	defer pool.Close()
	return fn(ctx, pool, log)
}

// describe turns field errors into a readable CLI message.
func describe(err error) error {
	ae, ok := apperr.As(err)
	if !ok || ae.Kind == apperr.KindInternal {
		return err
	}
	var msg strings.Builder
	msg.WriteString(ae.Message)
	for _, f := range ae.Fields {
		msg.WriteString("; " + f.Field + ": " + f.Message)
	}
	return errors.New(msg.String())
}

type nopWriter struct{}

func (nopWriter) Write(p []byte) (int, error) { return len(p), nil }
