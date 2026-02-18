# Generic Protocol Package

This package is the protocol-agnostic flow starter included in the base template.

It intentionally avoids protocol branding so builders can map it to their own domain model.

## Package map

- `solidity/`
  - `GenericPortal.sol`: L1 request/execute bridge skeleton
  - `test/GenericPortal.t.sol`: deterministic flow tests
- `aztec/`
  - `src/main.nr`: private request/finalize adapter skeleton
  - `Nargo.toml`: Noir contract package metadata

## Flow summary

1. User creates a private intent in Aztec adapter (`request_action`).
2. Adapter emits portal message with a content hash.
3. L1 portal records request metadata (`requestAction`).
4. Authorized relayer executes (`executeAction`) against protocol executor.
5. Success emits completion message back to Aztec.
6. Failure registers an escape request for later claim.

## What to customize first

1. Replace `IGenericActionExecutor` integration in `solidity/GenericPortal.sol`.
2. Replace adapter intent fields in `aztec/src/main.nr`.
3. Update and extend `solidity/test/GenericPortal.t.sol` for your protocol invariants.
