# Scaffold Documentation Review

Assessment scope:
- `generator/scaffold/**/*.md`
- Inline documentation/comments in scaffolded Solidity/Noir/scripts

## Summary

The scaffold documentation is a strong baseline for orientation, but it is not yet fully comprehensive for users to personalize and ship a protocol-specific implementation without prior Aztec/L1 integration experience.

## Findings

### 1. High: Flow docs imply a full Aztec bridge integration, but scaffolded L1 code only does local message bookkeeping/events **COOMPLETE**

References:
- `generator/scaffold/README.md:11`
- `generator/scaffold/contracts/README.md:10`
- `generator/scaffold/contracts/l1/BasePortal.sol:69`
- `generator/scaffold/contracts/l1/BasePortal.sol:80`

Impact:
- Users may assume this is production bridge wiring when it is not.

### 2. High: L1 completion payload vs Noir finalize payload contract is not documented clearly enough

References:
- `generator/scaffold/contracts/l1/GenericPortal.sol:144`
- `generator/scaffold/contracts/aztec/src/main.nr:77`
- `generator/scaffold/contracts/aztec/README.md:20`

Impact:
- Users can easily break L1/L2 message compatibility when adapting fields.

### 3. High: Missing deployment/configuration runbook for required constructor parameters and value sources

References:
- `generator/scaffold/contracts/l1/BasePortal.sol:43`
- `generator/scaffold/contracts/l1/GenericPortal.sol:74`
- `generator/scaffold/contracts/aztec/src/main.nr:24`
- `generator/scaffold/README.md:60`

Impact:
- Users know what to edit, but not how to initialize contracts correctly per network/environment.

### 4. Medium: Relayer responsibilities are acknowledged as out-of-scope, but there is no minimal operational spec

References:
- `generator/scaffold/README.md:71`
- `generator/scaffold/contracts/l1/GenericPortal.sol:109`

Impact:
- Users lack a concrete checklist for building the off-chain worker (inputs, nonce handling, retries, error paths).

### 5. Low: Inline docs explain responsibilities well, but personalization examples are sparse

References:
- `generator/scaffold/contracts/l1/GenericPortal.sol:22`
- `generator/scaffold/contracts/aztec/src/main.nr:32`

Impact:
- Users get concepts, but not enough concrete "replace this with your protocol schema" examples.

## Overall Assessment

- Current docs are strong for orientation.
- They are not yet comprehensive for end-to-end personalization and implementation without additional guidance.

## Assumptions

- Target audience includes users who have not previously built Aztec relayer flows.
- Goal is to make generated projects self-service without requiring deep repository internals.
