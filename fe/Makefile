SHELL := /bin/bash
.DEFAULT_GOAL := help

# The frontend consumes the backend-owned contract; it never edits it.
CONTRACT  := ../be/api/openapi.yaml
GENERATED := src/lib/api

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: setup
setup: ## Install dependencies from the lockfile
	npm ci

.PHONY: dev
dev: ## Run the Next.js dev server
	npm run dev

.PHONY: generate
generate: ## Regenerate API types from the backend contract
	npm run generate:api

.PHONY: drift-check
drift-check: generate ## Fail if generated API types are stale
	@untracked="$$(git ls-files --others --exclude-standard -- $(GENERATED))"; \
	if ! git diff --quiet -- $(GENERATED) || [ -n "$$untracked" ]; then \
		echo "fe: generated API types are out of date. Run 'make generate' and commit the result."; \
		git --no-pager diff --stat -- $(GENERATED); \
		[ -z "$$untracked" ] || printf 'untracked:\n%s\n' "$$untracked"; \
		exit 1; \
	fi
	@echo "fe: generated API types are in sync with $(CONTRACT)"

.PHONY: fmt
fmt: ## Format code
	npm run format

.PHONY: lint
lint: ## Lint and verify formatting
	npm run lint
	npm run format:check

.PHONY: typecheck
typecheck: ## Type-check the project
	npm run typecheck

.PHONY: test
test: ## Run unit tests
	npm test

.PHONY: build
build: ## Production build (standalone output)
	npm run build

.PHONY: audit
audit: ## Fail on high-severity vulnerabilities in production dependencies
	npm audit --omit=dev --audit-level=high

.PHONY: check
check: lint typecheck test build ## Everything CI runs for the frontend

.PHONY: clean
clean: ## Remove build artefacts
	rm -rf .next coverage
