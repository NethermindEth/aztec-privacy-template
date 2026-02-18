# Uniswap Example

This optional overlay adds Uniswap-oriented reference notes to the generated project.

## What this adds

1. A protocol-specific adaptation checklist for swap-focused request/execute flows.
2. Suggested boundaries for calldata hashing and finalize message handling.

## Adaptation checklist

1. Extend `contracts/l1/GenericPortal.sol` payload fields for swap parameters.
2. Integrate router execution semantics inside protocol executor hooks.
3. Mirror swap intent hashing in `contracts/aztec/src/main.nr`.
4. Add swap-specific success/failure escape tests in Solidity.

## Notes

This overlay is reference-only. It does not replace base contracts automatically.
