# Aave Core Flow (Reference 1)

## Scope

Phase 3 requires a completed deposit/withdraw reference path for Aave.
This flow uses one L1 contract (`AavePortal.sol`) and one TS adapter.

## Contracts

- `packages/protocols/aave/solidity/AavePortal.sol`
  - Inherits `BasePortal` and `EscapeHatch`.
  - Supports request/execute methods for:
    - `requestDeposit` / `executeDeposit`
    - `requestWithdraw` / `executeWithdraw`
  - Escalates failed L1 execution into `EscapeHatch`.

## Noir

- `packages/protocols/aave/noir/src/core/deposit.nr`
- `packages/protocols/aave/noir/src/core/withdraw.nr`

These modules provide deterministic payload encoding helpers for future witness generation.

## TypeScript

- `packages/protocols/aave/ts/aave.ts`
  - `AaveProtocolClient`
  - `buildDepositMessage`
  - `buildWithdrawMessage`

## Test Coverage

- Solidity tests: `packages/protocols/aave/solidity/test/AavePortal.t.sol`
- TS tests: `packages/protocols/aave/ts/aave.test.ts`
- E2E adapter skeleton: `tests/e2e/specs/aave.ts`

## Config Notes

`packages/protocols/aave/config.toml` overrides:

- `memo_private`
- `escape_timeout_blocks`

Build output is generated via `make protocol-aave`.
