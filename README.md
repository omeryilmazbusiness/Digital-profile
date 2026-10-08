# Sheraton Makkah — QR Digital Sales Experience

Mobile-first website reached through a printed QR code. It introduces the hotel and its sales
contact to travel agencies, serves approved documents and captures quotation requests.
A protected admin panel manages all content.

See [`docs/TASKS.md`](docs/TASKS.md) for the architecture and delivery plan.

## Architecture

A single deployable monolith split into two self-contained projects:

| Project | Role                                                                  | Stack                                                     |
| ------- | --------------------------------------------------------------------- | --------------------------------------------------------- |
| `be/`   | Go modular monolith. **Owns** the HTTP contract and its infrastructure | Go 1.27, chi, oapi-codegen, slog, PostgreSQL 16, S3       |
| `fe/`   | Next.js app (public site + `/admin`). **Consumes** the contract        | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Vitest   |

Dependency direction is one-way: `fe → be/api/openapi.yaml`. The backend never depends on the
frontend, and the frontend only touches the backend through the generated, typed client.

```
be/                       Go backend
  api/openapi.yaml          HTTP contract — single source of truth
  cmd/api/                  API server entrypoint
  cmd/cli/                  operational commands (migrations)
  db/migrations/            SQL migrations, embedded into the binaries
  db/queries/               SQL for sqlc (shared/platform queries)
  internal/api/             generated server interface + models (do not edit)
  internal/app/             wiring, lifecycle, contract tests
  internal/apperr/          transport-agnostic application errors
  internal/httpx/           problem+json errors, middleware, router
  internal/validation/      business-rule validation with field errors
  internal/modules/<name>/  one package per bounded context
  internal/platform/        infrastructure adapters (logger, database, storage, mail…)
  deploy/                   local infrastructure (docker compose)
  tools/                    pinned developer tools (separate go.mod)
  .env.example              backend configuration
fe/                       Next.js frontend
  src/app/                  routes (public + /admin)
  src/lib/api/              generated types + typed client
docs/                     architecture & task plan
Makefile                  orchestration only — delegates to be/ and fe/
```

Both projects expose the **same make targets** — `setup`, `dev`, `generate`, `drift-check`,
`fmt`, `lint`, `test`, `build`, `check`, `clean` — so they can be driven individually
(`make -C be test`) or together from the root (`make test`).

## Prerequisites

- Go **1.27+**
- Node.js **24** (see `fe/.nvmrc`)
- Docker with Compose v2 (backend infrastructure only)
- GNU Make

## Getting started

```bash
make setup   # be/.env, pinned tools, npm ci, git hooks
make dev     # postgres + storage + mailpit, API on :8080 (hot reload), web on :3000
```

| Service         | URL                           |
| --------------- | ----------------------------- |
| Web             | http://localhost:3000         |
| API liveness    | http://localhost:8080/healthz |
| API readiness   | http://localhost:8080/readyz  |
| Mailpit         | http://localhost:8025         |
| Storage console | http://localhost:9001         |

## Everyday commands

Run `make help` (root), `make -C be help` or `make -C fe help` for the full lists.

| Command                 | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `make generate`         | Regenerate Go server and TS client after editing the contract |
| `make drift-check`      | Fail if generated code is stale (also runs on `git push`)     |
| `make lint`             | Contract + Go + TS lint and format checks                     |
| `make test`             | Go tests (race detector) + Vitest                             |
| `make build`            | Versioned static Go binary + Next.js standalone build         |
| `make check`            | Everything CI runs                                            |
| `make -C be infra-reset`| Wipe local Postgres/storage data                              |
| `make -C be migrate-create name=x` | New up/down migration pair                         |
| `make -C be migrate-up` / `migrate-down` / `migrate-version` | Manage the schema by hand |

## Database

- Schema changes are SQL migrations in `be/db/migrations`, embedded into the binaries.
  In development the API applies them on startup (`DATABASE_AUTO_MIGRATE=true`); in production
  run `cli migrate up` as a release step. `/readyz` reports 503 while the schema does not match
  the version the binary expects.
- Queries are plain SQL compiled to type-safe Go by sqlc (`make generate`).
- Integration tests run against real PostgreSQL: `TEST_DATABASE_URL` if set, otherwise a
  throwaway container via testcontainers (Docker). Each test gets its own migrated database.

## Changing the API

1. Edit `be/api/openapi.yaml`.
2. `make generate` — the Go build now fails until every new operation is implemented.
3. Implement the operation in the owning module and embed its handler in `be/internal/app/server.go`.
4. Add the endpoint to `be/internal/app/contract_test.go`; it validates real responses against the spec.
5. Use the regenerated types in `fe/` through `fe/src/lib/api/client.ts`.

## Conventions

- Every error response is RFC 9457 `application/problem+json` with a `requestId`.
  Contract violations answer 400, business-rule violations 422, both with field-level `errors`.
- Configuration comes only from environment variables and is validated at startup (fail fast).
- Generated files (`*.gen.go`, `*.gen.ts`) are committed and never edited by hand.
- Commits run format + lint on staged files; pushes run the contract drift check.
