# create-aztec-privacy-template Implementation Plan

## Objective

Deliver a publishable `npx create-aztec-privacy-template` utility that generates:

- a protocol-agnostic Aztec privacy starter repo
- strong instructional docs (inline contract docs + README docs)
- a clean, minimal, non-intimidating project structure

This plan is intentionally incremental: each phase is small, testable, and safe to merge independently.

## Cleanliness Principles (non-negotiable)

1. Keep generator code boring and obvious.
2. Keep generated template minimal by default.
3. Never commit generated artifacts in templates (`node_modules`, `cache`, `out`, `target`, lock/temp logs).
4. Avoid magic codegen. Prefer plain file copy + explicit placeholder replacement.
5. One responsibility per module in generator package.
6. Ship readable docs first, features second.

## Proposed Package Layout

```text
packages/create-aztec-privacy-template/
|-- package.json
|-- tsconfig.json
|-- src/
|   |-- cli.ts
|   |-- scaffold.ts
|   |-- prompts.ts
|   |-- placeholders.ts
|   |-- validate.ts
|   `-- constants.ts
|-- contracts/
|   |-- l1/
|   `-- aztec/
|-- scripts/
|-- Makefile
|-- README.md
`-- overlays/
    `-- examples/
        |-- aave/
        |-- lido/
        `-- uniswap/
|-- test/
    |-- unit/
    `-- smoke/
```

## Phase 0: Scope lock + repo contract **COMPLETE**

### Changes

1. Document what the generated base template must contain.
2. Document what is optional (`--example` overlays).
3. Define strict non-goals (no frontend, no relayer stack, no production bridge claims).

### Testability

1. Team review checklist signoff in PR.
2. No code changes required.

### Exit criteria

1. A single authoritative contract doc for generator output exists.
2. See `CREATE_AZTEC_PRIVACY_TEMPLATE_OUTPUT_CONTRACT.md`.

## Phase 1: Base template extraction (agnostic starter) **COMPLETE**

### Changes

1. Create root scaffold files in `packages/create-aztec-privacy-template` from current repo essentials only.
2. Replace protocol-specific naming with neutral naming where required.
3. Add comprehensive docs:
   - inline NatSpec for contracts
   - top-level README + package README walkthroughs

### Testability

1. Manually copy `packages/create-aztec-privacy-template` to `/tmp` and run:
   - `make install`
   - `make check`
   - `make test-flow` (or minimal base equivalent)

### Exit criteria

1. Base template runs standalone.
2. No example-specific files in base template.

## Phase 1: Base template extraction (agnostic starter) **COMPLETE**

### Changes

1. Create root scaffold files in `packages/create-aztec-privacy-template` from current repo essentials only.
2. Replace protocol-specific naming with neutral naming where required.
3. Add comprehensive docs:
   - inline NatSpec for contracts
   - top-level README + package README walkthroughs

### Testability

1. Manually copy `packages/create-aztec-privacy-template` to `/tmp` and run:
   - `make install`
   - `make check`
   - `make test-flow` (or minimal base equivalent)

### Exit criteria

1. Base template runs standalone.
2. No example-specific files in base template.

## Phase 2: Generator package MVP (base only) **COMPLETE**

### Changes

1. Add `packages/create-aztec-privacy-template` with bin entry.
2. Implement CLI arguments:
   - project name/path
   - `--pm` (`bun` default)
   - `--yes`
3. Implement base template copy into target directory.
4. Add safe validations:
   - target path empty/non-existent
   - valid project name

### Testability

1. Local invocation:
   - `node dist/cli.js my-app`
2. Generated repo boots:
   - `make install`
   - `make check`

### Exit criteria

1. End-to-end base scaffolding works locally with one command.

## Phase 3: Placeholder replacement + project metadata

### Changes

1. Add explicit placeholder map (e.g., `__PROJECT_NAME__`).
2. Replace placeholders in selected text files only.
3. Update generated `README` quick-start commands and title automatically.

### Testability

1. Unit test replacement logic.
2. Smoke test generated repo contains replaced values and no unresolved placeholders.

### Exit criteria

1. Zero `__PLACEHOLDER__` tokens left in generated output.

## Phase 4: Optional example overlays

### Changes

1. Add `overlays/examples/{aave,lido,uniswap}`.
2. Implement overlay pipeline:
   - apply base
   - apply chosen overlays in deterministic order
3. Add CLI flags:
   - `--example none|aave|lido|uniswap|all`

### Testability

1. Smoke-test each option in isolated temp dirs.
2. Verify generated repo compiles/tests for selected overlays.

### Exit criteria

1. `none` remains minimal and clean.
2. Each overlay option is reproducible and documented.

## Phase 5: Post-generation UX

### Changes

1. Print next-step instructions based on selected package manager/examples.
2. Optional `--git` initialization.
3. Optional `--install` dependency install (off by default for speed/safety).

### Testability

1. Snapshot test of CLI output for each mode.
2. Manual UX pass for error messages and next steps.

### Exit criteria

1. User can scaffold and run first command without reading source code.

## Phase 6: Test harness for generator quality

### Changes

1. Add generator unit tests (validation, placeholder replacement, option parsing).
2. Add smoke tests that generate temp projects and run quick checks.
3. Keep smoke tests deterministic and fast by default.

### Testability

1. `bun test packages/create-aztec-privacy-template/test/unit`
2. `bun test packages/create-aztec-privacy-template/test/smoke`

### Exit criteria

1. Generator changes are guarded by automated tests.

## Phase 7: CI and release flow

### Changes

1. Add CI job for generator package:
   - lint
   - typecheck
   - unit
   - smoke
2. Add publish workflow for npm package.
3. Add semantic versioning (changesets or semantic-release).

### Testability

1. Dry-run publish job on PR/manual dispatch.
2. Validate `npx create-aztec-privacy-template@next` from a clean machine.

### Exit criteria

1. Publish process is reproducible and documented.

## Phase 8: Documentation hardening

### Changes

1. Add generator README with:
   - usage
   - options
   - examples
   - troubleshooting
2. Ensure generated template docs are complete:
   - contract NatSpec + inline guidance
   - architecture diagrams/text flow
   - adaptation checklists

### Testability

1. Documentation checklist in CI/PR template.
2. Manual “new user walkthrough” from generated project.

### Exit criteria

1. New users can implement a custom portal flow without reading this source repo.

## Suggested PR Breakdown (small discrete slices)

1. PR-1: Phase 0 + base template contract doc.
2. PR-2: Phase 1 base template extraction.
3. PR-3: Phase 2 CLI MVP (base scaffold only).
4. PR-4: Phase 3 placeholder replacement.
5. PR-5: Phase 4 overlays (`aave` only first), then `lido`, then `uniswap`.
6. PR-6: Phase 5 UX polish.
7. PR-7: Phase 6 generator tests.
8. PR-8: Phase 7 CI + publish.
9. PR-9: Phase 8 doc hardening and examples.

## Practical Defaults

- Default command should generate minimal base:
  - `npx create-aztec-privacy-template my-project`
- Power users can add overlays:
  - `npx create-aztec-privacy-template my-project --example all`

## Success Criteria

1. First-time user can scaffold and run `make install` + `make check` successfully.
2. Generated repo feels small and understandable.
3. Docs explain both “what to run” and “how to adapt architecture safely.”
4. Generator package can be versioned and released without manual patchwork.
