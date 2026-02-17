# Core Solidity modules

This folder contains shared L1 building blocks used by all protocol portal examples.

If you are a protocol builder, treat these contracts as the base primitives for your own portal implementation.

## What is here

- `BasePortal.sol`
  - Common message lifecycle utilities for Aztec <-> L1 flows
  - Deterministic message hashing via protocol id + L2 contract + content + sender + nonce
  - Message issuance tracking and consumption tracking
  - `onlyRelayer` guard for execution functions

- `EscapeHatch.sol`
  - Shared fallback mechanism when protocol execution fails
  - Registers delayed recovery claims keyed by message hash
  - Supports native ETH and ERC20-like token returns
  - Allows users to claim after a timeout window

## Why this exists

Every protocol example needs the same safety and plumbing:

- consistent cross-domain message identity
- replay protection (issued/consumed tracking)
- relayer authorization boundary
- failure recovery path

Keeping this logic in `core` avoids re-implementing critical behavior per protocol.

## How protocol portals use it

Each protocol portal (Aave, Uniswap, Lido):

1. Inherits `BasePortal` for message lifecycle.
2. Inherits `EscapeHatch` for failure recovery.
3. Adds protocol-specific request/execute logic on top.

## For builders adapting this template

- Keep `BasePortal` hash construction consistent across Aztec and L1 sides.
- Keep `onlyRelayer` on execution paths.
- Keep escape registration on execution failure paths.
- Do not duplicate these primitives per protocol unless you intentionally need different semantics.
