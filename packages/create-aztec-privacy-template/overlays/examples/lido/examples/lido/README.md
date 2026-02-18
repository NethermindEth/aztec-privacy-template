# Lido Example

This optional overlay adds Lido-oriented reference notes to the generated project.

## What this adds

1. A protocol-specific adaptation checklist for staking/unstaking style flows.
2. Suggested integration boundaries for L1 portal execution and Aztec finalize logic.

## Adaptation checklist

1. Extend `contracts/l1/GenericPortal.sol` with staking action payload fields.
2. Wire protocol execution calls for stake/unstake request handling.
3. Keep hash compatibility between L1 and `contracts/aztec/src/main.nr`.
4. Add protocol-specific flow assertions in Solidity tests.

## Notes

This overlay is reference-only. It does not replace base contracts automatically.
