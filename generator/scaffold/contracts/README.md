# Contracts Layout

The template keeps contract code in two folders only:

1. `contracts/l1`
2. `contracts/aztec`

This is intentionally flat so new users can find the key files immediately.

## Flow summary

1. User creates a private intent in Aztec adapter (`request_action`).
2. Adapter emits portal message with a content hash.
3. L1 portal records request metadata (`requestAction`).
4. Authorized relayer executes (`executeAction`) against protocol executor.
5. Success emits completion message back to Aztec.
6. Failure registers an escape request for later claim.

## Start customizing here

1. `contracts/l1/GenericPortal.sol`
2. `contracts/aztec/src/main.nr`
3. `contracts/l1/test/GenericPortal.t.sol`
