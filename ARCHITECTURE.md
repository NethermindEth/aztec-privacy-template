# Architecture

## Design at a glance

The template is split into three layers:

1. Shared core primitives (`packages/core`)
2. Per-protocol implementations (`packages/protocols/*`)
3. Tooling, tests, and harness (`scripts`, `tests`, `Makefile`)

This structure keeps privacy circuits and protocol-specific wiring modular while allowing protocol teams to
adopt only the needed surface area.

## Core layer

`packages/core` contains:

- Solidity primitives (`BasePortal`, `EscapeHatch`)
- Shared Noir helpers (`notes`, `authwit`, `messaging`)
- TS utilities (`env`, `wallet`, `aztec`, `message-utils`)
- Config generator (`scripts/config`) used by all protocols

Core modules are intentionally minimal and should not embed protocol-specific assumptions.

## Protocol layer

Each protocol keeps consistent structure:

- `packages/<protocol>/config.toml`
- `packages/<protocol>/generated/*` (derived from config)
- `packages/<protocol>/noir/src/core/*`
- `packages/<protocol>/noir/src/modules/*` (optional feature modules)
- `packages/<protocol>/ts/*.ts`
- `packages/<protocol>/solidity/*`
- `packages/<protocol>/solidity/test/*`

### Data and flag flow

1. `template.toml` and protocol override merge in `scripts/config/src/config.ts`.
2. `scripts/config/src/cli.ts` writes generated artifacts and Noir `privacy_flags.nr`.
3. Protocol-specific Noir modules import `crate::privacy_flags::*`.
4. Protocol TS clients use generated TS constants for protocol metadata and runtime values.

## Execution flow

### Core flow

- Build artifacts (`make build`)
- Deploy protocol portal and protocol helper contracts
- Use protocol client helper methods to encode actions
- Execute through portal + shared core patterns

### Execution modes

- Relayer mode: lifecycle calls are submitted via relayer adapter (`tests/e2e/relayer-runner.ts`).
- Self-execution mode: same lifecycle is executed with deterministic local behavior for test parity.

## Optional module flow

Optional modules are included under each protocol's `noir/src/modules` and enabled by config flags:

- `modules.enable_borrow`
- `modules.enable_repay`
- `modules.enable_lp`
- `modules.enable_queue`
- `modules.enable_yield`

The generated constants gate feature helpers and are included in `privacy_flags.nr` so module code remains
deterministic and compile-time configurable.

## Extensibility contract

Protocol modules should follow the same conventions as core modules:

- deterministic input encoding
- minimal typed structs
- explicit validation helpers
- no side effects in pure helper utilities

For adding a new protocol, follow `ADDING_NEW_PROTOCOL.md`.
