# Uniswap example (Aztec privacy adapter + L1 portal)

This folder is a minimal end-to-end pattern for adding Aztec privacy to a Uniswap-like swap integration.

It is meant for protocol builders who want a concrete starting point, not a full production implementation.

## What this example does

It demonstrates a private intent flow across Aztec and Ethereum:

1. A user creates a private swap intent on Aztec.
2. The Aztec contract emits a message to an L1 portal.
3. The L1 portal executes the swap on a Uniswap-like router.
4. The L1 portal emits a completion message back to Aztec.
5. The Aztec contract consumes that message and finalizes state.

## Why this exists

Real protocol integrations need a bridge pattern between:

- private user intent/state on Aztec
- public protocol execution on L1

This example gives you the smallest reusable structure for that:

- deterministic message hashes
- request/execute/finalize lifecycle
- relayer-gated execution
- escape hatch path when L1 execution fails

You can copy this structure and replace protocol-specific logic while keeping the privacy flow model.

## Files in this protocol

- `packages/protocols/uniswap/aztec/src/main.nr`
  - Aztec contract (`UniswapPrivacyAdapter`)
  - Builds private swap intent IDs and message content
  - Tracks pending swap intent state
  - Consumes L1->L2 completion messages to finalize intents

- `packages/protocols/uniswap/solidity/UniswapPortal.sol`
  - L1 portal contract
  - Accepts user requests for swap execution
  - Enforces relayer-only execution
  - Calls a Uniswap-like router interface
  - Handles failures via `EscapeHatch` registration

## How it works (high level)

### Aztec side

`UniswapPrivacyAdapter`:

- computes an `intent_id` from caller + swap parameters
- computes `content` hash used for cross-chain messaging
- emits a message to the configured L1 portal via `message_portal`
- marks intent as pending
- later consumes the L1 completion message and clears pending state

### L1 side

`UniswapPortal`:

- receives request and stores request metadata keyed by message hash
- relayer executes with matching payload + nonce
- validates request metadata to prevent mismatched execution
- performs the swap through the router
- on success: sends completion message back to Aztec
- on failure: registers an escape entry for recovery path

## What is intentionally simplified

- single-hop exact-input style flow
- simplified message content schema
- no production fee/economic model
- no frontend, indexer, or operator stack in this folder

This is by design: keep the integration shape clear and easy to port.

## Where test doubles are

Mocks are intentionally outside protocol code:

- `tests/mocks/uniswap/solidity/MockUniswapV3Router.sol`

So this protocol folder only contains integration contracts.

## How to run this example

From repository root:

```bash
make install
make protocol-uniswap
make test-e2e
```

`make test-e2e` runs the Uniswap flow in `tests/uniswap.ts` using local Aztec + local L1.

## How to adapt for your protocol

1. Keep the same Aztec lifecycle: request -> pending -> finalize.
2. Replace portal protocol call logic with your protocol’s execution API.
3. Keep strict request metadata binding (actor, route params, nonce).
4. Keep failure fallback/escape behavior.
5. Update message schema only if both Aztec and L1 sides are updated together.
