SHELL := /usr/bin/env bash

BUN := bun
BIOME := bunx biome
SOLHINT := bunx solhint
BIOME_CONFIG := --config-path .biome.json
SOLIDITY_FILES := $(shell find packages -type f -name '*.sol' \
	-not -name '*.t.sol' \
	-not -path '*/test/*' 2>/dev/null)

AZTEC_CONTRACT_DIRS := packages/protocols/generic/aztec
FMT_TARGETS := $(shell find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.cjs" -o -name "*.mjs" \) -not -path "./node_modules/*" -not -path "./.git/*" -not -name ".biome.json")
CORE_SOL_TESTS := $(shell find packages/core/solidity -type f -name "*.t.sol" 2>/dev/null)
GENERIC_SOL_TESTS := $(shell find packages/protocols/generic/solidity -type f -name "*.t.sol" 2>/dev/null)

.PHONY: help install verify-toolchain fmt fmt-check lint typecheck test test-core test-e2e-fast build build-aztec check clean

help:
	@printf "Available targets:\n"
	@printf "  make install         Verify toolchain + install dependencies\n"
	@printf "  make verify-toolchain Check required local tooling\n"
	@printf "  make fmt             Format supported files\n"
	@printf "  make fmt-check       Check formatting without writing\n"
	@printf "  make lint            Run biome + solhint\n"
	@printf "  make typecheck       Run TypeScript type checks\n"
	@printf "  make test            Run core + generic flow tests\n"
	@printf "  make test-core       Run core Solidity unit tests\n"
	@printf "  make test-e2e-fast   Run minimal generic flow verification\n"
	@printf "  make build-aztec     Compile Aztec protocol contracts\n"
	@printf "  make build           Build Solidity + Aztec artifacts\n"
	@printf "  make check           Run fmt-check + lint + typecheck + test-core\n"
	@printf "  make clean           Clean build artifacts\n"

verify-toolchain:
	@echo "Checking required toolchain..."
	@missing=0; \
	for tool in bun node aztec forge cast; do \
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
		echo "  - Foundry (forge/cast): https://book.getfoundry.sh/getting-started/installation"; \
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
	@$(MAKE) test-core
	@$(MAKE) test-e2e-fast

test-core:
	@echo "Running core Solidity tests..."
	@if [ -n "$(CORE_SOL_TESTS)" ]; then \
		(cd packages/core/solidity && forge test); \
	else \
		echo "No core Solidity tests found."; \
	fi

test-e2e-fast:
	@echo "Running minimal generic flow verification..."
	@if [ -n "$(GENERIC_SOL_TESTS)" ]; then \
		forge test --root . --contracts packages/protocols/generic/solidity; \
	else \
		echo "No generic protocol tests found."; \
	fi

build-aztec:
	@echo "Compiling Aztec protocol contracts..."
	@for dir in $(AZTEC_CONTRACT_DIRS); do \
		echo "Compiling $$dir"; \
		bash scripts/compile-aztec-contract.sh $$dir; \
	done

build:
	@echo "Building protocol artifacts..."
	@forge build --root . --contracts packages/core/solidity
	@forge build --root . --contracts packages/protocols/generic/solidity
	@$(MAKE) build-aztec
	@mkdir -p target
	@echo "Build complete."

check:
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) typecheck
	@$(MAKE) test-core

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf target
	@rm -rf cache out
	@rm -rf packages/core/solidity/cache packages/core/solidity/out
	@rm -rf packages/protocols/generic/solidity/cache packages/protocols/generic/solidity/out
	@rm -rf coverage .turbo .nyc_output
