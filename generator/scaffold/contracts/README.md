# Contracts Layout

The template keeps contract code in two folders only:

1. `contracts/l1`
2. `contracts/aztec`

This is intentionally flat so new users can find the key files immediately.

## Flow summary

1. User creates a private intent in Aztec adapter (`request_action`).
2. Adapter computes/emits portal message content hash.
3. L1 portal records request metadata (`requestAction`).
4. Authorized relayer executes (`executeAction`) against protocol executor.
5. Success emits completion message content for Aztec finalize path.
6. Failure registers an escape request for later claim.

## Canonical messaging boundary

The scaffold models message content + lifecycle, but production delivery must be wired through Aztec canonical
messaging contracts (Inbox/Outbox for your network version). In other words:

1. `BasePortal`/`GenericPortal` message hashes are integration inputs.
2. Your relayer is responsible for reading/proving canonical messages and invoking L1/L2 handlers.
3. Keep hash/payload layout identical between Solidity and Noir when integrating canonical message transport.

## Start customizing here

1. `contracts/l1/GenericPortal.sol`
2. `contracts/aztec/src/main.nr`
3. `contracts/l1/test/GenericPortal.t.sol`
