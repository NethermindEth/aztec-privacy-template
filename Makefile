SHELL := /usr/bin/env bash

BUN := bun
BIOME := bunx biome
SOLHINT := bunx solhint
BIOME_CONFIG := --config-path .biome.json
SOLIDITY_FILES := $(shell find packages -type f -name '*.sol' \
	-not -name '*.t.sol' \
	-not -path '*/test/*' \
	-not -path '*/mocks/*' 2>/dev/null)

WORKDIRS := packages/core packages/protocols/aave packages/protocols/uniswap packages/protocols/lido tests tests/e2e
AZTEC_CONTRACT_DIRS := packages/protocols/aave/aztec packages/protocols/uniswap/aztec packages/protocols/lido/aztec
FMT_TARGETS := $(shell find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.cjs" -o -name "*.mjs" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -name ".biome.json")
CORE_SOL_TESTS := $(shell find packages/core/solidity -type f -name "*.t.sol" 2>/dev/null)
PROTOCOLS := $(filter-out .keep, $(notdir $(wildcard packages/protocols/*)))
BUILD_PROTOCOLS := $(addprefix build-protocol-,$(PROTOCOLS))
ADAPTER_MESSAGE_READY_TIMEOUT_MS ?= 90000
ADAPTER_FINALIZE_RETRY_TIMEOUT_MS ?= 90000
ADAPTER_POLL_INTERVAL_MS ?= 500
ADAPTER_FAIL_FAST ?= 1

.PHONY: help install verify-toolchain fmt fmt-check lint typecheck test test-unit test-e2e test-e2e-fast test-e2e-adapters test-e2e-full build build-aztec clean check test-core lint-core protocol-aave protocol-uniswap protocol-lido build-protocol-% dev-sandbox-up dev-sandbox-down

help:
	@printf "Available targets:\n"
	@printf "  make install         Verify toolchain + install dependencies\n"
	@printf "  make verify-toolchain Check required local tooling\n"
	@printf "  make fmt             Format supported files\n"
	@printf "  make fmt-check       Check formatting without writing\n"
	@printf "  make lint            Run biome + solhint\n"
	@printf "  make typecheck       Run TypeScript type checks\n"
	@printf "  make test            Run test suite (unit + real e2e)\n"
	@printf "  make test-unit       Run fast unit tests\n"
	@printf "  make test-core       Run core unit tests\n"
	@printf "  make lint-core       Run core linters\n"
	@printf "  make test-e2e        Run default fast E2E suite\n"
	@printf "  make test-e2e-fast   Run fast portal E2E suite\n"
	@printf "  make test-e2e-adapters Run adapter cross-chain E2E suite (slow)\n"
	@printf "  make test-e2e-full   Run full E2E suite (fast + adapters)\n"
	@printf "  make build           Build protocol artifacts\n"
	@printf "  make build-aztec     Compile Aztec protocol contracts\n"
	@printf "  make clean           Clean build artifacts\n"
	@printf "  make check           Run fmt-check + lint + typecheck + test-core\n"
	@printf "  make protocol-aave   Build Aave protocol artifacts\n"
	@printf "  make protocol-uniswap Build Uniswap protocol artifacts\n"
	@printf "  make protocol-lido   Build Lido protocol artifacts\n"
	@printf "  make dev-sandbox-up  Start local E2E services\n"
	@printf "  make dev-sandbox-down Stop local E2E services\n"

verify-toolchain:
	@echo "Checking required toolchain..."
	@missing=0; \
	for tool in bun node aztec forge cast anvil; do \
		if ! command -v $$tool >/dev/null 2>&1; then \
			echo "Missing required tool: $$tool"; \
			missing=1; \
		fi; \
	done; \
	if [ $$missing -ne 0 ]; then \
		echo ""; \
		echo "Install prerequisites and rerun:"; \
		echo "  - Bun: https://bun.sh"; \
		echo "  - Aztec CLI: https://docs.aztec.network"; \
		echo "  - Foundry (forge/cast/anvil): https://book.getfoundry.sh/getting-started/installation"; \
		exit 1; \
	fi

install: verify-toolchain
	@echo "Installing workspace dependencies..."
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

typecheck:
	@echo "Running TypeScript type checks..."
	@if [ ! -d "node_modules/typescript" ]; then \
		echo "TypeScript is missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@$(BUN) run typecheck

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
	@$(MAKE) test-e2e-fast

test-e2e-fast:
	@echo "Running E2E test suite..."
	@if [ ! -d "node_modules/@aztec" ]; then \
		echo "Aztec SDK dependencies are missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@if [ ! -d "node_modules/tsx" ]; then \
		echo "tsx is missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@node --import tsx --test --test-concurrency=1 --test-reporter=spec tests/aave.ts tests/lido.ts tests/uniswap.ts

test-e2e-adapters:
	@echo "Running adapter E2E suite (slow)..."
	@if [ ! -d "node_modules/@aztec" ]; then \
		echo "Aztec SDK dependencies are missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@if [ ! -d "node_modules/tsx" ]; then \
		echo "tsx is missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@ADAPTER_MESSAGE_READY_TIMEOUT_MS=$(ADAPTER_MESSAGE_READY_TIMEOUT_MS) \
	ADAPTER_FINALIZE_RETRY_TIMEOUT_MS=$(ADAPTER_FINALIZE_RETRY_TIMEOUT_MS) \
	ADAPTER_POLL_INTERVAL_MS=$(ADAPTER_POLL_INTERVAL_MS) \
	ADAPTER_FAIL_FAST=$(ADAPTER_FAIL_FAST) \
	node --import tsx --test --test-concurrency=1 --test-reporter=spec tests/aztec-adapters.ts

test-e2e-full:
	@$(MAKE) test-e2e-fast
	@$(MAKE) test-e2e-adapters

build:
	@echo "Building artifacts for all protocols..."
	@$(MAKE) $(BUILD_PROTOCOLS)
	@$(MAKE) build-aztec
	@mkdir -p target
	@echo "Build complete."

build-aztec:
	@echo "Compiling Aztec protocol contracts..."
	@if ! command -v aztec >/dev/null 2>&1; then \
		echo "aztec CLI is required to compile protocol Aztec contracts."; \
		exit 1; \
	fi
	@for dir in $(AZTEC_CONTRACT_DIRS); do \
		echo "Compiling $$dir"; \
		bash scripts/compile-aztec-contract.sh $$dir; \
	done

$(BUILD_PROTOCOLS): build-protocol-%:
	@$(MAKE) protocol-$*

protocol-aave:
	@echo "Building Aave protocol artifacts..."
	@bash scripts/compile-aztec-contract.sh packages/protocols/aave/aztec

protocol-uniswap:
	@echo "Building Uniswap protocol artifacts..."
	@bash scripts/compile-aztec-contract.sh packages/protocols/uniswap/aztec

protocol-lido:
	@echo "Building Lido protocol artifacts..."
	@bash scripts/compile-aztec-contract.sh packages/protocols/lido/aztec

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf target
	@rm -rf cache out
	@rm -rf packages/core/solidity/cache packages/core/solidity/out
	@rm -rf coverage .turbo .nyc_output

check:
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) typecheck
	@$(MAKE) test-core

test-core:
	@echo "Running core Solidity tests..."
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
