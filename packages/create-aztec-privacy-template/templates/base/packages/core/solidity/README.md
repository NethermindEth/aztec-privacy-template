# Core Solidity modules

This package contains the shared L1 building blocks used by protocol portals.

Use these contracts as the baseline primitives for message lifecycle and escape handling.

## What is here

- `BasePortal.sol`
  - deterministic Aztec <-> L1 message hashing
  - outbound/inbound message issuance + consumption tracking
  - relayer authorization guard for execution entrypoints

- `EscapeHatch.sol`
  - delayed fallback claims when protocol execution fails
  - timeout-gated claim flow for native/token recovery
  - shared request storage and lifecycle events

## Why this exists

Most portal implementations need the same safety and plumbing:

1. stable cross-domain message identity
2. replay protection for inbound messages
3. strict relayer execution boundary
4. bounded recovery path for failed execution

Keeping these primitives in one shared package prevents protocol packages from
re-implementing critical logic.

## Adaptation notes

1. Keep the hash construction consistent between Aztec and L1.
2. Keep relayer authorization on all execute/finalize paths.
3. Register an escape path before returning from failed execution paths.
