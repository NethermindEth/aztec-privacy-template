# Optional Modules

This template supports optional Noir modules that can be enabled per protocol without changing the
core deposit/swap/stake onboarding flow.

## Protocol module flags

- `modules.enable_borrow`
- `modules.enable_repay`
- `modules.enable_lp`
- `modules.enable_queue`
- `modules.enable_yield`

All flags default to `false` in `template.toml` and per-protocol overrides.

## How flags are applied

1. `template.toml` + protocol override files are merged by the config pipeline.
2. The merged config generates:
   - `generated/privacy_flags.nr` (Noir compilation flags)
   - `generated/protocol_constants.ts` (TS constants)
   - `generated/PortalConstants.sol` (Solidity constants)
3. Core flows continue to compile and run when all flags remain disabled.

## Current module placement

- Aave
  - `packages/protocols/aave/noir/src/modules/borrow.nr`
  - `packages/protocols/aave/noir/src/modules/repay.nr`
- Uniswap
  - `packages/protocols/uniswap/noir/src/modules/lp.nr`
- Lido
  - `packages/protocols/lido/noir/src/modules/queue.nr`
  - `packages/protocols/lido/noir/src/modules/yield.nr`

Each module exposes lightweight helper functions and a local enabled-state accessor that can be replaced by
generated constants as protocol modules become fully wired into the request/execute pipeline.
