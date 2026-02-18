# create-aztec-privacy-template Plan

Detailed execution plan:

- `CREATE_AZTEC_PRIVACY_TEMPLATE_IMPLEMENTATION_PLAN.md`

## Goal

Provide a distributable Node utility so users can run:

```bash
npx create-aztec-privacy-template
```

and receive a protocol-agnostic starter repo for Aztec privacy integrations.

The generated template must ship with full instructional documentation:

- comprehensive inline contract documentation (NatSpec + implementation guidance comments)
- comprehensive README documentation (architecture, flow walkthroughs, adaptation steps, and runbook commands)

## 1) Define the generated repo contract first

- Default output should be protocol-agnostic:
  - `packages/core/solidity` (shared primitives)
  - one generic adapter + portal skeleton
  - minimal tests for request/finalize + escape hatch
- Documentation requirement in generated output:
  - contract-level instructional docs embedded inline (NatSpec on contracts/functions/events/errors + key design notes)
  - top-level and package-level READMEs explaining architecture, lifecycle, extension points, and local dev/test workflow
- Keep protocol-specific examples optional, not default.
- Optional examples should be selectable via flags (e.g. `--example aave|lido|uniswap|all`).

## 2) Add a dedicated package for the generator

- Create `packages/create-aztec-privacy-template`.
- Publish package name: `create-aztec-privacy-template`.
- Add `bin` entry so `npx create-aztec-privacy-template` works directly.

## 3) Use static file templates

- Template layout:
  - `packages/create-aztec-privacy-template/`
  - `packages/create-aztec-privacy-template/overlays/examples/{aave,lido,uniswap}` (future phases)
- Exclude generated artifacts from templates:
  - `node_modules`, `cache`, `out`, `target`, transient logs/locks.

## 4) Build a composable scaffold flow

- CLI prompt/flags should cover:
  - project name/path
  - package manager (`bun` default)
  - include examples (`none` default)
- Flow:
  1. Copy base template.
  2. Overlay selected example packs.
  3. Replace placeholders (`__PROJECT_NAME__`, IDs, docs tokens).

## 5) Add post-generation UX and validation

- Optionally initialize git.
- Print exact next steps:
  - `make install`
  - `make test-e2e-fast`
  - `make test-e2e-adapters`
- Do not auto-run long E2E by default.

## 6) Add QA for the generator

- Snapshot tests for generated tree structure.
- Smoke tests for generated projects:
  - generator invocation from built package
  - `make check`
  - `make test-e2e-fast`
- Run these checks in CI before publishing.

## 7) Publish and versioning strategy

- Publish from `packages/create-aztec-privacy-template`.
- Use semantic versioning (changesets or semantic-release).
- Include a template schema/version marker in generated repo docs.

## 8) Rollout sequence

1. MVP: base protocol-agnostic template only.
2. Add optional example overlays (`aave`, `lido`, `uniswap`).
3. Document both entrypoints:
   - `npx create-aztec-privacy-template`
   - `npm create aztec-privacy-template@latest`

## Suggested initial deliverable

Scaffold `packages/create-aztec-privacy-template` with:

- CLI entrypoint + argument parsing
- base template extraction
- first working `npx` path
