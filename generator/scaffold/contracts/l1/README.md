# L1 Contracts

This folder contains all Solidity contracts for the starter:

1. `BasePortal.sol`
2. `EscapeHatch.sol`
3. `GenericPortal.sol`

It also includes tests under `test/`.

## Responsibilities

1. deterministic Aztec <-> L1 message hashing (`BasePortal`)
2. replay protection and relayer authorization (`BasePortal`)
3. timeout-gated recovery path (`EscapeHatch`)
4. protocol-agnostic request/execute bridge (`GenericPortal`)

## Messaging integration note

These contracts define deterministic message content and local request state. For real cross-chain delivery, integrate
your relayer with Aztec canonical Inbox/Outbox contracts (or their current equivalent on your target network).

## Deployment parameters

See `../../docs/DEPLOYMENT.md` for constructor input requirements and value sources for:

1. `protocolId_`
2. `l2Contract_`
3. `relayer_`
4. `executor_`

## Relayer behavior

See `../../docs/RELAYER_SPEC.md` for minimum relayer responsibilities, nonce/idempotency handling, retry policy, and operations requirements.

## Adaptation checklist

1. Keep hash construction consistent between Aztec and L1.
2. Keep `onlyRelayer` on execution/finalization entrypoints.
3. Wire your real protocol integration in `IGenericActionExecutor`.
4. Preserve escape registration behavior on execution failure.
5. Extend tests in `test/GenericPortal.t.sol` for protocol-specific invariants.

## Personalization examples

Example A: lend/repay style flow

1. `actionData` schema:
`abi.encode(uint8(actionKind), address(asset), uint256(amount), bytes(protocolArgs))`
2. enforce `actionKind` allowlist in executor (`LEND`, `REPAY`).
3. compute/store `actionHash = keccak256(actionData)` at request time.
4. decode and route in executor by `actionKind`.

Example B: swap style flow

1. `actionData` schema:
`abi.encode(address(tokenIn), address(tokenOut), uint256(amountIn), uint256(minOut), bytes(route))`
2. add slippage protection in executor (`minOut` checks).
3. include route encoding in hash so relayer cannot alter execution path.
