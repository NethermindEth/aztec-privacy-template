SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

BUN := bun
BIOME := ./node_modules/.bin/biome
BIOME_CONFIG := --config-path .biome.json
SOLHINT := ./node_modules/.bin/solhint
SOLHINT_CONFIG := .solhint.json
GENERATOR_DIR := generator
GENERATOR_SCAFFOLD_DIR := $(GENERATOR_DIR)/scaffold
AZTEC_CONTRACT_DIRS := packages/protocols/aave/aztec packages/protocols/uniswap/aztec packages/protocols/lido/aztec
NOIR_FMT_DIRS := $(AZTEC_CONTRACT_DIRS) $(GENERATOR_SCAFFOLD_DIR)/contracts/aztec
SOLIDITY_FILES := $(shell find packages -type f -name '*.sol' -not -name '*.t.sol' -not -path '*/test/*' -not -path '*/mocks/*' 2>/dev/null)
SOLIDITY_FMT_FILES := $(shell find packages tests -type f -name '*.sol' -not -path '*/cache/*' -not -path '*/out/*' 2>/dev/null)

ADAPTER_MESSAGE_READY_TIMEOUT_MS ?= 90000
ADAPTER_FINALIZE_RETRY_TIMEOUT_MS ?= 90000
ADAPTER_POLL_INTERVAL_MS ?= 500
ADAPTER_FAIL_FAST ?= 1

.PHONY: help install verify-toolchain fmt fmt-check lint typecheck check clean \
	test test-core test-e2e test-e2e-adapters test-e2e-full build build-aztec \
	generator-install generator-build generator-typecheck generator-test generator-lint generator-check \
	generator-e2e-case generator-published-artifact-smoke generator-release-check \
	scaffold-help scaffold-check scaffold-test scaffold-build

help:
	@printf "Main Commands\n"
	@printf "  make install    Install dependencies (with toolchain check)\n"
	@printf "  make check      Run full quality gates (fmt/lint/typecheck/core/generator)\n"
	@printf "  make test       Run core + fast E2E tests\n"
	@printf "  make build      Build Aztec artifacts\n"
	@printf "  make clean      Remove generated artifacts\n"
	@printf "\nQuality\n"
	@printf "  make fmt        Format TS/Solidity/Noir files\n"
	@printf "  make fmt-check  Check formatting\n"
	@printf "  make lint       Run biome + solhint\n"
	@printf "  make typecheck  Type-check repo TS + generator TS\n"
	@printf "\nTests\n"
	@printf "  make test-core         Run core Solidity tests\n"
	@printf "  make test-e2e          Run fast E2E flows (aave/lido/uniswap)\n"
	@printf "  make test-e2e-adapters Run adapter E2E suite\n"
	@printf "  make test-e2e-full     Run all E2E tests\n"
	@printf "\nGenerator\n"
	@printf "  make generator-check                    Run generator quality + tests\n"
	@printf "  make generator-e2e-case                 Run one generator matrix case (CAPT_E2E_* env)\n"
	@printf "  make generator-published-artifact-smoke Run npm-pack smoke scaffold\n"
	@printf "  make generator-release-check            Run release-validation checks\n"
	@printf "\nScaffold Template Source\n"
	@printf "  make scaffold-help|scaffold-check|scaffold-test|scaffold-build\n"

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
		echo "  - Foundry: https://book.getfoundry.sh/getting-started/installation"; \
		exit 1; \
	fi

install: verify-toolchain
	@$(BUN) install

fmt:
	@if [ ! -x "$(BIOME)" ]; then $(BUN) install; fi
	@$(BIOME) format $(BIOME_CONFIG) --write .
	@if [ -n "$(SOLIDITY_FMT_FILES)" ]; then forge fmt $(SOLIDITY_FMT_FILES); fi
	@noir_fmt_cmd=""; \
	if aztec --help 2>/dev/null | grep -Eq '^[[:space:]]+fmt([[:space:]]|:)' ; then \
		noir_fmt_cmd="aztec fmt"; \
	elif command -v nargo >/dev/null 2>&1; then \
		noir_fmt_cmd="nargo fmt"; \
	fi; \
	if [ -n "$$noir_fmt_cmd" ]; then \
		for dir in $(NOIR_FMT_DIRS); do (cd $$dir && $$noir_fmt_cmd); done; \
	else \
		echo "No Noir formatter found; skipping Noir formatting."; \
	fi

fmt-check:
	@if [ ! -x "$(BIOME)" ]; then $(BUN) install; fi
	@$(BIOME) format $(BIOME_CONFIG) .
	@if [ -n "$(SOLIDITY_FMT_FILES)" ]; then forge fmt --check $(SOLIDITY_FMT_FILES); fi
	@noir_fmt_check_cmd=""; \
	if aztec --help 2>/dev/null | grep -Eq '^[[:space:]]+fmt([[:space:]]|:)' ; then \
		noir_fmt_check_cmd="aztec fmt --check"; \
	elif command -v nargo >/dev/null 2>&1 && nargo fmt --help 2>/dev/null | grep -q -- '--check'; then \
		noir_fmt_check_cmd="nargo fmt --check"; \
	fi; \
	if [ -n "$$noir_fmt_check_cmd" ]; then \
		for dir in $(NOIR_FMT_DIRS); do (cd $$dir && $$noir_fmt_check_cmd); done; \
	else \
		echo "No Noir format checker found; skipping Noir format checks."; \
	fi

lint:
	@if [ ! -x "$(BIOME)" ]; then $(BUN) install; fi
	@$(BIOME) lint $(BIOME_CONFIG) .
	@if [ ! -x "$(SOLHINT)" ]; then $(BUN) install; fi
	@if [ -n "$(SOLIDITY_FILES)" ]; then $(SOLHINT) --config "$(SOLHINT_CONFIG)" --disc $(SOLIDITY_FILES); fi

typecheck:
	@$(BUN) run typecheck
	@$(MAKE) generator-typecheck

test: test-core test-e2e

test-core:
	@if command -v forge >/dev/null 2>&1; then (cd packages/core/solidity && forge test); else echo "forge not installed"; exit 1; fi

test-e2e:
	@node --import tsx --test --test-concurrency=1 --test-reporter=spec tests/e2e/aave.e2e.ts tests/e2e/lido.e2e.ts tests/e2e/uniswap.e2e.ts

test-e2e-adapters:
	@ADAPTER_MESSAGE_READY_TIMEOUT_MS=$(ADAPTER_MESSAGE_READY_TIMEOUT_MS) \
	ADAPTER_FINALIZE_RETRY_TIMEOUT_MS=$(ADAPTER_FINALIZE_RETRY_TIMEOUT_MS) \
	ADAPTER_POLL_INTERVAL_MS=$(ADAPTER_POLL_INTERVAL_MS) \
	ADAPTER_FAIL_FAST=$(ADAPTER_FAIL_FAST) \
	node --import tsx --test --test-concurrency=1 --test-reporter=spec tests/e2e/adapters.e2e.ts

test-e2e-full: test-e2e test-e2e-adapters

build: build-aztec
	@mkdir -p target

build-aztec:
	@for dir in $(AZTEC_CONTRACT_DIRS); do bash scripts/compile-aztec-contract.sh $$dir; done

check: fmt-check lint typecheck test-core generator-test

clean:
	@find . -type d \( -name node_modules -o -name dist -o -name cache -o -name out -o -name target -o -name coverage -o -name .turbo -o -name .nyc_output \) -prune -exec rm -rf {} +

generator-install:
	@if [ ! -d "$(GENERATOR_DIR)/node_modules" ]; then (cd $(GENERATOR_DIR) && $(BUN) install); fi

generator-build: generator-install
	@(cd $(GENERATOR_DIR) && $(BUN) run build)

generator-typecheck: generator-install
	@(cd $(GENERATOR_DIR) && $(BUN) run typecheck)

generator-test: generator-install
	@(cd $(GENERATOR_DIR) && $(BUN) run test)

generator-lint: generator-install
	@(cd $(GENERATOR_DIR) && $(BUN) run lint)

generator-check: generator-install
	@(cd $(GENERATOR_DIR) && $(BUN) run fmt:check)
	@(cd $(GENERATOR_DIR) && $(BUN) run lint)
	@(cd $(GENERATOR_DIR) && $(BUN) run typecheck)
	@(cd $(GENERATOR_DIR) && $(BUN) run test)

generator-e2e-case: generator-build
	@(cd $(GENERATOR_DIR) && node --test test/generator-e2e-matrix.test.mjs)

generator-published-artifact-smoke: generator-build
	@(cd $(GENERATOR_DIR) && CAPT_RUN_PUBLISHED_ARTIFACT_SMOKE=1 node --test test/published-artifact-smoke.test.mjs)

generator-release-check: generator-check generator-published-artifact-smoke
	@echo "Generator release validation complete."

scaffold-help:
	@$(MAKE) -C $(GENERATOR_SCAFFOLD_DIR) help

scaffold-check:
	@$(MAKE) -C $(GENERATOR_SCAFFOLD_DIR) check

scaffold-test:
	@$(MAKE) -C $(GENERATOR_SCAFFOLD_DIR) test

scaffold-build:
	@$(MAKE) -C $(GENERATOR_SCAFFOLD_DIR) build
