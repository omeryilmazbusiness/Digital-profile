SHELL := /bin/bash
.DEFAULT_GOAL := help

GOLANGCI_LINT_VERSION := v2.14.0
REDOCLY               := npx --yes @redocly/cli@2.60.0
TOOL                  := go tool -modfile=tools/go.mod
COMPOSE               := docker compose -f deploy/docker-compose.dev.yml --env-file .env
LOAD_ENV              := set -a && source ./.env && set +a
GENERATED             := internal/api internal/platform/database/dbgen
MIGRATIONS            := db/migrations
VERSION               ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS               := -s -w -X github.com/omeryilmazbusiness/digital-profile/be/internal/buildinfo.Version=$(VERSION)

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- Setup -------------------------------------------------------------------

.env:
	cp .env.example .env
	@echo "Created be/.env from be/.env.example"

.PHONY: setup
setup: .env tools ## One-time setup: env file and pinned tools

.PHONY: tools
tools: ## Install pinned developer tools
	@command -v golangci-lint >/dev/null && golangci-lint version | grep -q "$(GOLANGCI_LINT_VERSION:v%=%)" || \
		curl -sSfL https://golangci-lint.run/install.sh | sh -s -- -b $$(go env GOPATH)/bin $(GOLANGCI_LINT_VERSION)
	go mod download
	cd tools && go mod download

# --- Local development ---------------------------------------------------------

.PHONY: dev
dev: .env ## Run the API with hot reload (loads .env)
	$(LOAD_ENV) && $(TOOL) air -c .air.toml

.PHONY: run
run: .env ## Run the API once (loads .env)
	$(LOAD_ENV) && go run ./cmd/api

.PHONY: infra-up
infra-up: .env ## Start Postgres, object storage and mail catcher
	$(COMPOSE) up -d --wait postgres storage mailpit
	$(COMPOSE) up storage-init --no-log-prefix

.PHONY: infra-down
infra-down: ## Stop infrastructure (data is kept)
	$(COMPOSE) down

.PHONY: infra-reset
infra-reset: ## Stop infrastructure and DELETE all local data
	$(COMPOSE) down -v

.PHONY: infra-logs
infra-logs: ## Follow infrastructure logs
	$(COMPOSE) logs -f

# --- Database ------------------------------------------------------------------
# The API applies migrations itself when DATABASE_AUTO_MIGRATE=true (development default).
# Production runs `cli migrate up` as an explicit release step.

.PHONY: migrate-up
migrate-up: .env ## Apply all pending migrations
	$(LOAD_ENV) && go run ./cmd/cli migrate up

.PHONY: migrate-down
migrate-down: .env ## Roll back migrations (steps=N, default 1)
	$(LOAD_ENV) && go run ./cmd/cli migrate down -steps $(or $(steps),1)

.PHONY: migrate-version
migrate-version: .env ## Show applied vs expected schema version
	$(LOAD_ENV) && go run ./cmd/cli migrate version

.PHONY: migrate-force
migrate-force: .env ## Clear a dirty state after a manual fix (version=N)
	@test -n "$(version)" || { echo "usage: make migrate-force version=N"; exit 2; }
	$(LOAD_ENV) && go run ./cmd/cli migrate force -version $(version)

# --- Admin account -------------------------------------------------------------
# The password is prompted for (no echo), never passed as an argument.

.PHONY: admin-create
admin-create: .env ## Create the single admin account (email=...)
	@test -n "$(email)" || { echo "usage: make admin-create email=you@example.com"; exit 2; }
	@$(LOAD_ENV) && go run ./cmd/cli admin create -email "$(email)"

.PHONY: admin-reset-password
admin-reset-password: .env ## Set a new admin password, unlock and sign out everywhere (email=...)
	@test -n "$(email)" || { echo "usage: make admin-reset-password email=you@example.com"; exit 2; }
	@$(LOAD_ENV) && go run ./cmd/cli admin reset-password -email "$(email)"

.PHONY: jwt-key
jwt-key: ## Print a new AUTH_JWT_KEYS entry
	@go run ./cmd/cli jwt-key

.PHONY: migrate-create
migrate-create: ## Create an empty up/down migration pair (name=snake_case_name)
	@[[ "$(name)" =~ ^[a-z0-9_]+$$ ]] || { echo "usage: make migrate-create name=snake_case_name"; exit 2; }
	@last=$$(ls $(MIGRATIONS) | sed -nE 's/^([0-9]+)_.*\.up\.sql$$/\1/p' | sort -n | tail -1); \
	next=$$(printf '%06d' $$((10#$${last:-0} + 1))); \
	for dir in up down; do \
		f="$(MIGRATIONS)/$${next}_$(name).$${dir}.sql"; \
		printf -- '-- %s migration: %s\n' "$$dir" "$(name)" > "$$f"; \
		echo "created $$f"; \
	done

# --- API contract --------------------------------------------------------------

.PHONY: api-lint
api-lint: ## Lint api/openapi.yaml
	$(REDOCLY) lint --format=stylish

.PHONY: generate
generate: ## Regenerate code from api/openapi.yaml (oapi-codegen) and db/queries (sqlc)
	go generate ./...

.PHONY: drift-check
drift-check: generate ## Fail if generated server code is stale
	@untracked="$$(git ls-files --others --exclude-standard -- $(GENERATED))"; \
	if ! git diff --quiet -- $(GENERATED) || [ -n "$$untracked" ]; then \
		echo "be: generated code is out of date. Run 'make generate' and commit the result."; \
		git --no-pager diff --stat -- $(GENERATED); \
		[ -z "$$untracked" ] || printf 'untracked:\n%s\n' "$$untracked"; \
		exit 1; \
	fi
	@echo "be: generated code is in sync with api/openapi.yaml and db/queries"

# --- Quality gates -------------------------------------------------------------

.PHONY: fmt
fmt: ## Format code
	golangci-lint fmt ./...

.PHONY: lint
lint: api-lint ## Lint contract and Go code, verify formatting
	golangci-lint run ./...
	@test -z "$$(golangci-lint fmt --diff ./... 2>&1)" || { golangci-lint fmt --diff ./...; exit 1; }

.PHONY: tidy-check
tidy-check: ## Fail if go.mod/go.sum are not tidy
	go mod tidy -diff
	cd tools && go mod tidy -diff

# Integration tests use TEST_DATABASE_URL when set, otherwise start PostgreSQL via Docker
# (testcontainers). Without either they are skipped locally and fail under CI.
.PHONY: test
test: ## Run tests with the race detector
	go test -race -count=1 ./...

.PHONY: cover
cover: ## Run tests and print coverage
	go test -race -count=1 -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -func=coverage.out | tail -1

.PHONY: build
build: ## Build static, versioned binaries (api, cli) into ./bin
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/api ./cmd/api
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/cli ./cmd/cli

.PHONY: check
check: tidy-check lint test build ## Everything CI runs for the backend

.PHONY: tidy
tidy: ## Tidy module files
	go mod tidy
	cd tools && go mod tidy

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf bin tmp coverage.out
