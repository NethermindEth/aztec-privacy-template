SHELL := /usr/bin/env bash

NPM := npm
BUN := bun
PNPM := pnpm
YARN := yarn
BIOME := npx biome
SOLHINT := npx solhint
SOLIDITY_FILES := $(shell find packages tests -type f -name '*.sol' 2>/dev/null)

WORKDIRS := packages/core packages/protocols/aave packages/protocols/uniswap packages/protocols/lido tests tests/e2e tests/e2e/specs docs docs/appendix scripts

.PHONY: help install fmt fmt-check lint test test-unit test-e2e build clean check test-core lint-core protocol-aave protocol-uniswap protocol-lido dev-sandbox-up dev-sandbox-down

help:
	@printf "Available targets:\n"
	@printf "  make install         Install dependencies\n"
	@printf "  make fmt             Format supported files\n"
	@printf "  make fmt-check       Check formatting without writing\n"
	@printf "  make lint            Run biome + solhint\n"
	@printf "  make test            Run test suite (unit + e2e placeholders)\n"
	@printf "  make test-unit       Run fast unit tests\n"
	@printf "  make test-e2e        Run E2E tests\n"
	@printf "  make build           Build generated artifacts\n"
	@printf "  make clean           Clean build artifacts\n"
	@printf "  make check           Run fmt-check + lint + test-unit\n"
	@printf "  make protocol-aave   Build/run Aave reference package\n"
	@printf "  make protocol-uniswap Build/run Uniswap reference package\n"
	@printf "  make protocol-lido   Build/run Lido reference package\n"
	@printf "  make dev-sandbox-up  Start local E2E services\n"
	@printf "  make dev-sandbox-down Stop local E2E services\n"

install:
	@echo "Installing workspace dependencies..."
	@if [ -f bun.lockb ] && command -v $(BUN) >/dev/null 2>&1; then \
		$(BUN) install; \
	elif [ -f pnpm-lock.yaml ] && command -v $(PNPM) >/dev/null 2>&1; then \
		$(PNPM) install; \
	elif [ -f yarn.lock ] && command -v $(YARN) >/dev/null 2>&1; then \
		$(YARN) install; \
	else \
		$(NPM) install; \
	fi
	@echo "Install complete."

fmt:
	@$(BIOME) format --write .

fmt-check:
	@$(BIOME) format --write=false .

lint:
	@echo "Running biome lints..."
	@$(BIOME) lint .
	@echo "Running solhint..."
	@if [ -n "$(SOLIDITY_FILES)" ]; then \
		$(SOLHINT) $(SOLIDITY_FILES); \
	else \
		echo "No solidity files found; skipping solhint."; \
	fi

test:
	@$(MAKE) test-unit
	@$(MAKE) test-e2e

test-unit:
	@echo "Running unit test suite..."
	@if [ -d "tests/unit" ]; then \
		$(NPM) test -- tests/unit; \
	else \
		echo "No unit tests yet. Placeholder target."; \
	fi

test-e2e:
	@echo "Running E2E test suite..."
	@if [ -d "tests/e2e" ]; then \
		$(NPM) test -- tests/e2e; \
	else \
		echo "No E2E harness yet. Placeholder target."; \
	fi

build:
	@echo "Building generated artifacts..."
	@mkdir -p target
	@echo "Build pipeline not implemented yet; placeholder target."

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf target
	@rm -rf coverage .turbo .nyc_output

check:
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) test-unit

test-core:
	@$(MAKE) test-unit

lint-core:
	@$(MAKE) lint

protocol-aave:
	@echo "Aave reference protocol flow is Phase 1+."

protocol-uniswap:
	@echo "Uniswap reference protocol flow is Phase 2+."

protocol-lido:
	@echo "Lido reference protocol flow is Phase 3+."

dev-sandbox-up:
	@echo "Sandbox bootstrap is deferred to Phase 6."

dev-sandbox-down:
	@echo "Sandbox shutdown is deferred to Phase 6."
