# Contributing

This repo uses `make` as the single local and CI orchestration entrypoint.

## Required workflow

1. `make install`
2. Implement changes in the relevant package path.
3. `make check`
4. `make test`

`make check` is the required pre-review gate and must pass before PR creation.

## Quality rules

- `biome` is the formatting and linting baseline for TypeScript/JavaScript/JSON/Markdown.
- `solhint` is mandatory for all Solidity files.
- Formatting/lint failures block merges.

## Phased contribution

Phase 0 establishes the repository guardrails and execution contract.
Phase 1+ introduces protocol logic and implementations.

## CI expectations

CI runs `make check` on every pull request and pushes to the default branch.
