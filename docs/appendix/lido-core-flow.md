# Lido Core Flow (Reference 3)

## Scope

Phase 5 adds the third reference implementation: a minimal Lido-like stake/unstake flow.

## Contracts

- `packages/protocols/lido/solidity/LidoPortal.sol`
  - Inherits `BasePortal` and `EscapeHatch`.
  - Supports request/execute methods for:
    - `requestStake` / `executeStake`
    - `requestUnstake` / `executeUnstake`
  - Persists matching request metadata to bind execute payloads.
  - Registers failed execution paths into the shared escape hatch.

## Noir

- `packages/protocols/lido/noir/src/core/stake.nr`
- `packages/protocols/lido/noir/src/core/unstake.nr`
- `packages/protocols/lido/noir/src/lib.nr`

These modules provide basic payload helpers for deterministic witness wiring.

## TypeScript

- `packages/protocols/lido/ts/lido.ts`
  - `LidoProtocolClient`
  - `buildStakeMessage`
  - `buildUnstakeMessage`

## Tests

- Solidity tests: `packages/protocols/lido/solidity/test/LidoPortal.t.sol`
- TS tests: `packages/protocols/lido/ts/lido.test.ts`
- E2E adapter skeleton: `tests/e2e/specs/lido.ts`

## Caveats

- Stake/unstake logic is intentionally simplified into one contract interface:
  - `submit` for staking
  - `unstake` for redemption
- This flow does not model protocol-specific reward accounting or delayed queue settlement.
- Escape hatch currently refunds/stores ETH-denominated amounts, not full stETH withdrawal semantics.
