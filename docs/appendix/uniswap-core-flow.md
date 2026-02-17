# Uniswap Core Flow (Reference 2)

## Scope

Phase 4 adds a second reference implementation for the template: a Uniswap private swap flow.

## Noir

- `packages/protocols/uniswap/noir/src/core/swap.nr`
  - `UniswapSwapInput` payload primitive.
  - Deterministic input encoding and basic amount validation.

## Solidity

- `packages/protocols/uniswap/solidity/UniswapPortal.sol`
  - Inherits `BasePortal` and `EscapeHatch`.
  - Supports request/execute for:
    - `requestSwap`
    - `executeSwap`
  - Tracks and validates request context (actor, token pair, fee, amounts, recipient) before execution.
  - Registers failed/under-slippage operations into the shared escape hatch.

- `packages/protocols/uniswap/solidity/UniswapPortalMock.sol`
- `packages/protocols/uniswap/solidity/MockUniswapV3Router.sol`

## TypeScript

- `packages/protocols/uniswap/ts/uniswap.ts`
  - `UniswapProtocolClient`
  - `buildSwapPayload`
  - `buildSwapMessage`

## Tests

- `packages/protocols/uniswap/solidity/test/UniswapPortal.t.sol`
- `packages/protocols/uniswap/ts/uniswap.test.ts`
- `tests/e2e/specs/uniswap.ts`
- `tests/e2e/specs/uniswap.spec.ts`

## Caveats

- Slippage is represented by `minAmountOut` and validated in `executeSwap` against mocked router output.
- Swap execution constraints are intentionally simplified:
  - Single-hop behavior via `exactInputSingle`-style arguments.
  - No on-chain liquidity path simulation.
  - No ERC20 transfer checks implemented in this reference scaffold.
