# Phase 0 Baseline Contract Lock

This document locks the current (pre-migration) output contract for
`create-aztec-privacy-template`.

It is the authoritative baseline for `MIGRATION_PLAN.md` Phase 0.

## Scope

Generator package:

- `packages/create-aztec-privacy-template`

Contract applies to the current CLI behavior and scaffold output before
internal architecture refactors.

## Supported Inputs

Package managers (`--pm`):

1. `bun`
2. `npm`
3. `pnpm`
4. `yarn`

Example selection (`--example`):

1. `none`
2. `aave`
3. `lido`
4. `uniswap`
5. `all`

## Output Invariants

For every supported package manager/example combination:

1. Scaffold succeeds in an empty target directory.
2. `README.md` title is replaced with project name (no unresolved `__TOKEN__` placeholders).
3. `README.md` contains the correct install command for the selected package manager.
4. Generated `package.json` has `name` equal to scaffolded project name.
5. File tree matches the committed baseline structure snapshot for the selected `--example` value.

## Baseline Fixture Snapshots

Committed fixtures:

- `packages/create-aztec-privacy-template/test/fixtures/baseline-structure/none.json`
- `packages/create-aztec-privacy-template/test/fixtures/baseline-structure/aave.json`
- `packages/create-aztec-privacy-template/test/fixtures/baseline-structure/lido.json`
- `packages/create-aztec-privacy-template/test/fixtures/baseline-structure/uniswap.json`
- `packages/create-aztec-privacy-template/test/fixtures/baseline-structure/all.json`

These files are used to detect output-structure regressions during migration.

## CI Enforcement

CI matrix coverage for baseline verification is defined in:

- `.github/workflows/ci.yml` (`generator-baseline-matrix` job)

Matrix dimensions:

1. package manager: `bun`, `npm`, `pnpm`, `yarn`
2. example: `none`, `aave`, `lido`, `uniswap`, `all`

## Change Policy

If output structure or baseline behavior changes intentionally:

1. update fixture snapshots
2. update this contract doc
3. include migration notes in the same PR
