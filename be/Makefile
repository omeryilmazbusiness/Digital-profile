SHELL := /bin/bash
.DEFAULT_GOAL := help

GOLANGCI_LINT_VERSION := v2.14.0
REDOCLY               := npx --yes @redocly/cli@2.60.0
TOOL                  := go tool -modfile=tools/go.mod
COMPOSE               := docker compose -f deploy/docker-compose.dev.yml --env-file .env
LOAD_ENV              := set -a && source ./.env && set +a
GENERATED             := internal/api
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

# --- API contract --------------------------------------------------------------

.PHONY: api-lint
api-lint: ## Lint api/openapi.yaml
	$(REDOCLY) lint --format=stylish

.PHONY: generate
generate: ## Regenerate server code from api/openapi.yaml
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
	@echo "be: generated code is in sync with api/openapi.yaml"

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

.PHONY: test
test: ## Run tests with the race detector
	go test -race -count=1 ./...

.PHONY: cover
cover: ## Run tests and print coverage
	go test -race -count=1 -coverprofile=coverage.out -covermode=atomic ./...
	go tool cover -func=coverage.out | tail -1

.PHONY: build
build: ## Build a static, versioned binary into ./bin
	CGO_ENABLED=0 go build -trimpath -ldflags "$(LDFLAGS)" -o bin/api ./cmd/api

.PHONY: check
check: tidy-check lint test build ## Everything CI runs for the backend

.PHONY: tidy
tidy: ## Tidy module files
	go mod tidy
	cd tools && go mod tidy

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf bin tmp coverage.out
