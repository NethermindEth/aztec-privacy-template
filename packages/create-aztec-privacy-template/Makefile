SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help fmt build typecheck scaffold-help scaffold-check scaffold-test scaffold-build

help:
	@printf "create-aztec-privacy-template\n\n"
	@printf "Generator\n"
	@printf "  make fmt            Format generator + scaffold code\n"
	@printf "  make typecheck      Type-check generator source\n"
	@printf "  make build          Build generator to dist/\n\n"
	@printf "Scaffold\n"
	@printf "  make scaffold-help  Show generated-project Make targets\n"
	@printf "  make scaffold-check Run scaffold checks\n"
	@printf "  make scaffold-test  Run scaffold tests\n"
	@printf "  make scaffold-build Build scaffold artifacts\n"

fmt:
	@echo "Formatting generator TypeScript..."
	@bunx biome format --write src
	@echo "Formatting scaffold code..."
	@$(MAKE) -C scaffold fmt

typecheck:
	@bun run typecheck

build:
	@bun run build

scaffold-help:
	@$(MAKE) -C scaffold help

scaffold-check:
	@$(MAKE) -C scaffold check

scaffold-test:
	@$(MAKE) -C scaffold test

scaffold-build:
	@$(MAKE) -C scaffold build
