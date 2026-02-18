# Tests Improvement Plan (Incremental + Testable)

## Goal

Improve `tests/` so they are:

1. clear to follow from console output
2. broader in behavior coverage (success + failure paths)
3. true cross-chain coverage (L1 portal and Aztec adapter flow)

## Current gap summary

1. Aztec contracts are compiled but not executed in tests.
2. Only happy paths are tested for protocol flows.
3. Failure paths (`EscapeHatch`, replay, unauthorized relayer) are not covered.
4. Test output is hard to follow from user-facing CI logs.

## Phase 0: Baseline observability **COMPLETED**

### Changes

1. Add a shared test logger helper in `tests/runtime.ts`.
2. Add explicit step logs in `tests/aave.ts`, `tests/lido.ts`, `tests/uniswap.ts`.
3. Print key runtime values: deployed addresses, request hash, message hash, amounts.

### Testability

1. Run `make test-e2e`.
2. Confirm each test prints numbered steps with protocol prefix.

### Exit criteria

1. Console output clearly shows lifecycle: compile -> deploy -> request -> execute -> assertions.

## Phase 1: Deterministic structure and reusable flow helpers **COMPLETED**

### Changes

1. Add reusable helpers for repeated actions (deploy portal, request flow, execute flow, assert consumed).
2. Standardize constants/fixtures per protocol.
3. Keep one main happy-path test per protocol using shared helpers.

### Testability

1. Run `make test-e2e`.
2. Verify all three protocol tests pass with same behavior as before.

### Exit criteria

1. No duplicated deploy/request/execute boilerplate in protocol tests.

## Phase 2: L1 portal negative-path coverage **COMPLETED**

### Changes

1. Add tests for unauthorized relayer execution.
2. Add tests for invalid inputs (zero amount, zero recipient where applicable).
3. Add tests for replay/double-consume behavior.
4. Add tests for request mismatch (wrong actor/amount/nonce).

### Testability

1. Run `make test-e2e`.
2. Each negative test asserts revert/error message or state invariant.

### Exit criteria

1. Each protocol has at least one failing-path assertion for auth, validation, and replay protection.

## Phase 3: Escape hatch coverage **COMPLETED**

### Changes

1. Trigger protocol failure using mocks (`setShouldFail`).
2. Assert escape request registration (`getEscapeRequest`).
3. Assert pre-timeout claim fails.
4. Advance chain blocks and assert post-timeout claim succeeds.

### Testability

1. Run `make test-e2e`.
2. Confirm logs show failure branch and successful delayed claim.

### Exit criteria

1. Escape flow is validated end-to-end for each protocol action type.

## Phase 4: Solidity unit tests for core invariants **COMPLETED**

### Changes

1. Add Foundry tests under `packages/core/solidity/test`.
2. Unit test `BasePortal` hash/nonce/consumption invariants.
3. Unit test `EscapeHatch` registration/cancel/claim edge cases.

### Testability

1. Run `make test-core`.
2. Ensure tests are deterministic and isolated from Aztec runtime.

### Exit criteria

1. Core invariants are protected by fast unit tests independent of E2E.

## Phase 5: Aztec adapter execution coverage **COMPLETED**

### Changes

1. Extend E2E to deploy and call protocol Aztec adapters, not just compile them.
2. Test `request_*` emits L1-bound message semantics and marks pending state.
3. Test `finalize_*` consumes L1->L2 message and clears pending state.
4. Add failure/assertion cases on adapter methods (invalid amount, invalid constructor args).

### Testability

1. Run `make test-e2e`.
2. Verify adapter state transitions (`is_*_pending`) before and after finalize.

### Exit criteria

1. Cross-chain lifecycle is validated on both sides: Aztec adapter + L1 portal.

## Phase 6: CI hardening for protocol-builder template quality

### Changes

1. Add coverage reporting for Solidity unit tests.
2. Keep E2E on main/manual and gate PR with quality + compile + core unit tests.
3. Add clear CI log grouping per protocol flow.

### Testability

1. Open PR and verify CI gates behavior.
2. Run workflow dispatch and verify full E2E behavior.

### Exit criteria

1. CI is a reproducible template showing scalable quality gates for protocol builders.

## Recommended execution order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

Each phase is designed to be merged independently and keep the suite green.
