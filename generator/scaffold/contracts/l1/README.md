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

## Adaptation checklist

1. Keep hash construction consistent between Aztec and L1.
2. Keep `onlyRelayer` on execution/finalization entrypoints.
3. Wire your real protocol integration in `IGenericActionExecutor`.
4. Preserve escape registration behavior on execution failure.
5. Extend tests in `test/GenericPortal.t.sol` for protocol-specific invariants.
