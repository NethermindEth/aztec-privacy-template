# Aave Example

This optional overlay adds Aave-oriented reference notes to the generated project.

## What this adds

1. A protocol-specific adaptation checklist for Aave-style supply/withdraw flows.
2. Suggested places to extend the generic contracts and Aztec adapter.

## Adaptation checklist

1. Extend `contracts/l1/GenericPortal.sol` execute payload parsing with Aave request fields.
2. Add pool integration wrappers for supply/withdraw execution semantics.
3. Mirror request/finalize payload hashes in `contracts/aztec/src/main.nr`.
4. Add protocol-specific tests beside `contracts/l1/test/GenericPortal.t.sol`.

## Notes

This overlay is reference-only. It does not replace base contracts automatically.
