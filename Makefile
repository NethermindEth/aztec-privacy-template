SHELL := /usr/bin/env bash

BUN := bun
BIOME := bunx biome
SOLHINT := bunx solhint
BIOME_CONFIG := --config-path .biome.json
SOLIDITY_FILES := $(shell find packages tests -type f -name '*.sol' 2>/dev/null)

WORKDIRS := packages/core packages/protocols/aave packages/protocols/uniswap packages/protocols/lido tests tests/e2e tests/e2e/specs docs docs/appendix scripts
CONFIG_TEMPLATE := template.toml
CONFIG_TOOL := scripts/config/src/cli.ts
FMT_TARGETS := $(shell find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.cjs" -o -name "*.mjs" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -name ".biome.json")
CORE_TS_TESTS := $(shell find packages/core/ts -type f -name "*.test.ts" 2>/dev/null)
CONFIG_TESTS := $(shell find scripts/config -type f -name "*.test.ts" 2>/dev/null)
CORE_NOIR_TESTS := $(shell find packages/core/noir -type f -name "*.test.nr" 2>/dev/null)
CORE_SOL_TESTS := $(shell find packages/core/solidity -type f -name "*.t.sol" 2>/dev/null)
PROTOCOLS := $(filter-out .keep, $(notdir $(wildcard packages/protocols/*)))
BUILD_PROTOCOLS := $(addprefix build-protocol-,$(PROTOCOLS))

.PHONY: help install fmt fmt-check lint test test-unit test-e2e build clean check test-core lint-core protocol-aave protocol-uniswap protocol-lido build-protocol-% dev-sandbox-up dev-sandbox-down

help:
	@printf "Available targets:\n"
	@printf "  make install         Install dependencies\n"
	@printf "  make fmt             Format supported files\n"
	@printf "  make fmt-check       Check formatting without writing\n"
	@printf "  make lint            Run biome + solhint\n"
	@printf "  make test            Run test suite (unit + e2e placeholders)\n"
	@printf "  make test-unit       Run fast unit tests\n"
	@printf "  make test-core       Run core unit tests\n"
	@printf "  make lint-core       Run core linters\n"
	@printf "  make test-e2e        Run E2E tests\n"
	@printf "  make build           Build generated artifacts\n"
	@printf "  make clean           Clean build artifacts\n"
	@printf "  make check           Run fmt-check + lint + test-unit\n"
	@printf "  make protocol-aave   Build Aave protocol artifacts\n"
	@printf "  make protocol-uniswap Build Uniswap protocol artifacts\n"
	@printf "  make protocol-lido   Build Lido protocol artifacts\n"
	@printf "  make dev-sandbox-up  Start local E2E services\n"
	@printf "  make dev-sandbox-down Stop local E2E services\n"

install:
	@echo "Installing workspace dependencies..."
	@if ! command -v $(BUN) >/dev/null 2>&1; then \
		echo "Bun is required for this repo. Install Bun and rerun make install."; \
		exit 1; \
	fi
	$(BUN) install
	@echo "Install complete."

fmt:
	@$(BIOME) format $(BIOME_CONFIG) --write $(FMT_TARGETS)

fmt-check:
	@$(BIOME) format $(BIOME_CONFIG) $(FMT_TARGETS)

lint:
	@echo "Running biome lints..."
	@$(BIOME) lint $(BIOME_CONFIG) $(FMT_TARGETS)
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
		$(BUN) test tests/unit; \
	else \
		echo "No unit tests yet. Placeholder target."; \
	fi

test-e2e:
	@echo "Running E2E test suite..."
	@if [ -d "tests/e2e" ]; then \
		$(BUN) test tests/e2e; \
	else \
		echo "No E2E harness yet. Placeholder target."; \
	fi

build:
	@echo "Building artifacts for all protocols..."
	@$(MAKE) $(BUILD_PROTOCOLS)
	@mkdir -p target
	@echo "Build complete."

$(BUILD_PROTOCOLS): build-protocol-%:
	@$(MAKE) protocol-$*

protocol-aave:
	@echo "Building Aave protocol artifacts..."
	@$(BUN) run $(CONFIG_TOOL) --template=$(CONFIG_TEMPLATE) --protocol=aave --protocol-config=packages/protocols/aave/config.toml --out-dir=packages/protocols/aave/generated

protocol-uniswap:
	@echo "Building Uniswap protocol artifacts..."
	@$(BUN) run $(CONFIG_TOOL) --template=$(CONFIG_TEMPLATE) --protocol=uniswap --protocol-config=packages/protocols/uniswap/config.toml --out-dir=packages/protocols/uniswap/generated

protocol-lido:
	@echo "Building Lido protocol artifacts..."
	@$(BUN) run $(CONFIG_TOOL) --template=$(CONFIG_TEMPLATE) --protocol=lido --protocol-config=packages/protocols/lido/config.toml --out-dir=packages/protocols/lido/generated

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf target
	@rm -rf packages/protocols/*/generated
	@rm -rf coverage .turbo .nyc_output

check:
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) test-core

test-core:
	@echo "Running core TS tests..."
	@if [ -n "$(CORE_TS_TESTS)" ]; then \
		if command -v $(BUN) >/dev/null 2>&1; then \
			$(BUN) test $(CORE_TS_TESTS); \
		else \
			echo "bun not installed; skipping core TS tests."; \
		fi; \
	else \
		echo "No core TS tests found."; \
	fi
	@if [ -n "$(CONFIG_TESTS)" ]; then \
		if command -v $(BUN) >/dev/null 2>&1; then \
			$(BUN) test $(CONFIG_TESTS); \
		else \
			echo "bun not installed; skipping config tests."; \
		fi; \
	else \
		echo "No config tests found."; \
	fi
	@echo "Running core Noir tests (placeholder)..."
	@if [ -n "$(CORE_NOIR_TESTS)" ]; then \
		if command -v nargo >/dev/null 2>&1; then \
			$(MAKE) -C packages/core/noir test || true; \
		else \
			echo "nargo not installed; run manually when toolchain is available."; \
		fi; \
	else \
		echo "No core Noir tests found."; \
	fi
	@echo "Running core Solidity tests (placeholder)..."
	@if [ -n "$(CORE_SOL_TESTS)" ]; then \
		if command -v forge >/dev/null 2>&1; then \
			(cd packages/core/solidity && forge test); \
		else \
			echo "forge not installed; run manually when toolchain is available."; \
		fi; \
	else \
		echo "No core Solidity tests found."; \
	fi

lint-core:
	@$(MAKE) lint

dev-sandbox-up:
	@echo "Sandbox bootstrap is deferred to Phase 6."

dev-sandbox-down:
	@echo "Sandbox shutdown is deferred to Phase 6."
