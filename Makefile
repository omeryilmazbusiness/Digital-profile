SHELL := /bin/bash
.DEFAULT_GOAL := help

# Orchestration only. be/ and fe/ each expose the same target interface
# (setup, dev, generate, drift-check, fmt, lint, test, build, check, clean);
# this file never reaches into their internals.
PROJECTS := be fe

.PHONY: help
help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make <target>   (per project: make -C be|fe <target>)\n\n"} /^[a-zA-Z_-]+:.*##/ {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

define each
	@set -e; for p in $(PROJECTS); do echo "==> $$p: $(1)"; $(MAKE) --no-print-directory -C $$p $(1); done
endef

.PHONY: setup
setup: ## One-time setup for both projects + git hooks
	$(call each,setup)
	$(MAKE) hooks

.PHONY: hooks
hooks: ## Install git hooks (lefthook version pinned in be/tools/go.mod)
	cd be/tools && go install github.com/evilmartians/lefthook/v2
	lefthook install

.PHONY: dev
dev: ## Start backend infrastructure, then API and web with hot reload
	$(MAKE) -C be infra-up
	$(MAKE) -j2 dev-be dev-fe

.PHONY: dev-be dev-fe
dev-be:
	$(MAKE) -C be dev
dev-fe:
	$(MAKE) -C fe dev

.PHONY: generate
generate: ## Regenerate server code and client types from be/api/openapi.yaml
	$(call each,generate)

.PHONY: drift-check
drift-check: ## Fail if any generated code is stale
	$(call each,drift-check)

.PHONY: fmt
fmt: ## Format both projects
	$(call each,fmt)

.PHONY: lint
lint: ## Lint both projects
	$(call each,lint)

.PHONY: test
test: ## Test both projects
	$(call each,test)

.PHONY: build
build: ## Build both projects
	$(call each,build)

.PHONY: check
check: ## Everything CI runs, for both projects
	$(call each,check)

.PHONY: clean
clean: ## Remove build artefacts
	$(call each,clean)
