SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

BUN := bun
SOLHINT := ./node_modules/.bin/solhint
SOLIDITY_FILES := $(shell find contracts/l1 -type f -name '*.sol' \
	-not -name '*.t.sol' \
	-not -path '*/test/*' 2>/dev/null)
SOLIDITY_FMT_FILES := $(shell find contracts/l1 -type f -name '*.sol' -not -path '*/cache/*' -not -path '*/out/*' 2>/dev/null)

AZTEC_CONTRACT_DIRS := contracts/aztec

.PHONY: help install verify-toolchain fmt fmt-check lint test _test-core _test-flow build build-aztec check clean

help:
	@printf "Aztec Privacy Starter Make Targets\n\n"
	@printf "Setup\n"
	@printf "  make install          Verify toolchain + install dependencies\n"
	@printf "  make verify-toolchain Check required local tooling\n\n"
	@printf "Quality\n"
	@printf "  make fmt              Format Solidity + Noir files\n"
	@printf "  make fmt-check        Check formatting (Solidity + Noir)\n"
	@printf "  make lint             Run Solhint\n"
	@printf "  make check            Run fmt-check + lint + test\n\n"
	@printf "Tests\n"
	@printf "  make test             Run all starter tests\n"
	@printf "\n"
	@printf "Build\n"
	@printf "  make build            Build Solidity + Aztec artifacts\n"
	@printf "  make build-aztec      Compile Aztec Noir contract\n\n"
	@printf "Cleanup\n"
	@printf "  make clean            Remove build artifacts\n"

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
	@echo "Formatting Solidity files with forge fmt..."
	@if [ -n "$(SOLIDITY_FMT_FILES)" ]; then \
		forge fmt $(SOLIDITY_FMT_FILES); \
	else \
		echo "No Solidity files found; skipping forge fmt."; \
	fi
	@echo "Formatting Noir files..."
	@noir_fmt_cmd=""; \
	if aztec --help 2>/dev/null | grep -Eq '^[[:space:]]+fmt([[:space:]]|:)' ; then \
		noir_fmt_cmd="aztec fmt"; \
	elif command -v nargo >/dev/null 2>&1; then \
		noir_fmt_cmd="nargo fmt"; \
	fi; \
	if [ -z "$$noir_fmt_cmd" ]; then \
		echo "No Noir formatter available (aztec fmt or nargo fmt); skipping Noir format."; \
	else \
		for dir in $(AZTEC_CONTRACT_DIRS); do \
			echo "Formatting $$dir with $$noir_fmt_cmd"; \
			(cd $$dir && $$noir_fmt_cmd); \
		done; \
	fi

fmt-check:
	@echo "Checking Solidity formatting with forge fmt --check..."
	@if [ -n "$(SOLIDITY_FMT_FILES)" ]; then \
		forge fmt --check $(SOLIDITY_FMT_FILES); \
	else \
		echo "No Solidity files found; skipping forge fmt --check."; \
	fi
	@echo "Checking Noir formatting..."
	@noir_fmt_check_cmd=""; \
	if aztec --help 2>/dev/null | grep -Eq '^[[:space:]]+fmt([[:space:]]|:)' ; then \
		noir_fmt_check_cmd="aztec fmt --check"; \
	elif command -v nargo >/dev/null 2>&1 && nargo fmt --help 2>/dev/null | grep -q -- '--check'; then \
		noir_fmt_check_cmd="nargo fmt --check"; \
	fi; \
	if [ -z "$$noir_fmt_check_cmd" ]; then \
		echo "No Noir format checker available (aztec fmt --check or nargo fmt --check); skipping Noir format check."; \
	else \
		for dir in $(AZTEC_CONTRACT_DIRS); do \
			echo "Checking $$dir with $$noir_fmt_check_cmd"; \
			(cd $$dir && $$noir_fmt_check_cmd); \
		done; \
	fi

lint:
	@echo "Running solhint..."
	@if [ ! -x "$(SOLHINT)" ]; then \
		echo "solhint is missing; installing workspace dependencies first..."; \
		$(BUN) install; \
	fi
	@if [ -n "$(SOLIDITY_FILES)" ]; then \
		$(SOLHINT) --disc $(SOLIDITY_FILES); \
	else \
		echo "No solidity files found; skipping solhint."; \
	fi

test:
	@$(MAKE) _test-core
	@$(MAKE) _test-flow

_test-core:
	@echo "Running core Solidity tests..."
	@if [ -f "contracts/l1/test/BasePortal.t.sol" ] && [ -f "contracts/l1/test/EscapeHatch.t.sol" ]; then \
		(cd contracts/l1 && forge test --match-path test/BasePortal.t.sol); \
		(cd contracts/l1 && forge test --match-path test/EscapeHatch.t.sol); \
	else \
		echo "No core Solidity tests found."; \
	fi

_test-flow:
	@echo "Running minimal generic flow verification..."
	@if [ -f "contracts/l1/test/GenericPortal.t.sol" ]; then \
		(cd contracts/l1 && forge test --match-path test/GenericPortal.t.sol); \
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
	@(cd contracts/l1 && forge build)
	@$(MAKE) build-aztec
	@mkdir -p target
	@echo "Build complete."

check:
	@$(MAKE) fmt-check
	@$(MAKE) lint
	@$(MAKE) test

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf target
	@rm -rf cache out
	@rm -rf contracts/l1/cache contracts/l1/out
	@rm -rf coverage .turbo .nyc_output
