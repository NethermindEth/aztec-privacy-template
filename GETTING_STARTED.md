# Getting Started

This template lets you build and run privacy-enabled protocol adapters for Aztec with a shared
core and optional per-protocol extension points.

## Prerequisites

- Bun (latest)
- Node.js >= 20 (for editor tooling compatibility)
- Make (used as orchestration entrypoint)

Optional if you are compiling Solidity/Noir locally:

- Solidity toolchain (`forge`) for core protocol tests
- Noir toolchain (`nargo`) for Noir tests and compilation

## Quickstart

1. Install dependencies.

   ```bash
   make install
   ```

2. Build generated artifacts for all protocols.

   ```bash
   make build
   ```

3. Run baseline checks before edits.

   ```bash
   make check
   ```

4. Run tests.

   ```bash
   make test
   ```

`make test` currently runs the repository test suite and E2E harness. If only core TypeScript checks are needed, use:

```bash
make test-core
```

## Core Flow (Default)

Each protocol ships with a working core flow first:

- Aave: deposit + withdraw
- Uniswap: swap
- Lido: stake + unstake

Core behavior is defined by:

- `template.toml` shared config
- Per-protocol `packages/<protocol>/config.toml` overrides
- Generated artifacts under `packages/<protocol>/generated`
- Protocol-specific Noir core modules under `packages/<protocol>/noir/src/core`
- Protocol clients under `packages/<protocol>/ts`
- Protocol portals under `packages/<protocol>/solidity`
- Protocol E2E spec adapters under `tests/e2e/specs`

Appendix references for each protocol flow:

- `docs/appendix/aave-core-flow.md`
- `docs/appendix/uniswap-core-flow.md`
- `docs/appendix/lido-core-flow.md`
- `docs/appendix/optional-modules.md`

## Configuration and generated artifacts

Generated artifacts are produced from config merges and should not be hand-edited.

- `packages/<protocol>/generated/privacy_flags.nr`
- `packages/<protocol>/generated/protocol_constants.ts`
- `packages/<protocol>/generated/PortalConstants.sol`

Re-run `make build` whenever config changes.

## Optional modules

Optional modules are intentionally separated so teams can adopt incrementally:

- Aave: borrow / repay
- Uniswap: LP
- Lido: queue / yield

Each option is controlled by `modules.*` flags in config and gates compiled constants.

See `docs/appendix/optional-modules.md` for details and `packages/<protocol>/noir/src/modules`.

## Development workflow

1. Keep edits small and focused.
2. Update config and protocol artifacts together with `make build`.
3. Keep docs updated in the same PR as behavior changes.
4. Run `make fmt`, `make lint`, and `make check` before commit.
5. Before release, follow `docs/release-checklist.md` and `docs/fork-checklist.md`.
