# Relayer Operational Specification (Minimum)

This document defines the minimum behavior expected from a relayer that operates the generated template flow.

Scope:

1. request lifecycle orchestration for `request_action -> requestAction -> executeAction -> finalize_action`
2. canonical messaging integration (Inbox/Outbox or current equivalent on your network/version)
3. reliability and safety requirements for production-like operation

This is an operational spec, not a full implementation.

## Responsibilities

The relayer must:

1. Observe canonical message events/state for the target network.
2. Derive/validate message payloads and deterministic hashes used by `BasePortal`/`GenericPortal`.
3. Submit L1 transactions to `executeAction` with correct parameters.
4. Publish/relay completion messages needed by L2 `finalize_action`.
5. Handle retries, reorg-safe confirmations, and duplicate delivery safely.

## Required Inputs

Use environment configuration (see `DEPLOYMENT.md`) for:

1. `PROTOCOL_ID`
2. `L1_GENERIC_PORTAL`
3. `L2_GENERIC_ADAPTER`
4. `RELAYER_ADDRESS` and signer material
5. `EXECUTOR_ADDRESS`
6. canonical messaging contract addresses for the selected network version
7. RPC endpoints + chain IDs for L1 and Aztec network

## Core Processing Loop

1. Detect eligible request message from canonical channel.
2. Decode/derive:
`content`, `sender`, `amount`, `actionData`, `nonce`, `timeoutBlocks`.
3. Validate local invariants before submit:
   - `keccak256(actionData)` matches expected request metadata hash.
   - `sender` is non-zero and payload shape is expected for your protocol.
4. Submit `executeAction(...)` on `GenericPortal` from `RELAYER_ADDRESS`.
5. Wait for confirmation policy (configurable confirmations).
6. Route success/failure outcome:
   - success: ensure completion payload is available for L2 finalize path.
   - failure: ensure escape path observability and user/operator notification.

## Nonce and Idempotency Rules

1. Treat `(content, sender, nonce)` as an idempotency key.
2. Before submitting, check whether the message was already consumed when possible.
3. On retry, never mutate payload fields associated with an existing idempotency key.
4. Persist per-message processing state in durable storage.

## Retry and Failure Policy

1. Use bounded exponential backoff for transient RPC/network errors.
2. Separate retry classes:
   - transient infra errors (retry)
   - deterministic contract reverts (do not blind-retry; mark failed with reason)
3. Keep a dead-letter queue for messages requiring manual intervention.
4. Record revert data/tx hash/error class for every failed attempt.

## Confirmation and Reorg Handling

1. Configure minimum confirmations before treating an L1 tx as final.
2. Reconcile local state on restart and after reorg signals.
3. Ensure replay safety when transactions are dropped/replaced.

## Observability (Minimum)

Emit structured logs and metrics for:

1. message detect/submit/confirm/fail transitions
2. tx hash, nonce key, and retry count
3. end-to-end latency (`request detected -> executeAction confirmed`)
4. failure-rate by category (RPC, revert, timeout, proof mismatch)

## Security and Operations

1. Use dedicated relayer key(s) with least privilege.
2. Enforce allowlist for target contracts and chain IDs.
3. Protect signer access (HSM/KMS preferred for production).
4. Support safe pause/resume operations without state loss.

## Compatibility Contract

Keep these three components aligned whenever payload schema changes:

1. L1 `GenericPortal.executeAction` request and completion handling
2. relayer payload construction/proof submission
3. L2 `finalize_action` content hash construction in Noir

Any schema change must ship with integration tests covering both success and failure/escape paths.
