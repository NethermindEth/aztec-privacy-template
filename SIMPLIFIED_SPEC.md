# Simplified PRD: aztec-protocol-privacy-template

> **Version**: 1.1-simplified  
> **Date**: 2026-02-17  
> **Status**: Draft  
> **License**: MIT

## Context

Ethereum DeFi protocols still lack a standard, fast path to integrate Aztec privacy.  
This document defines a simplified template that keeps the original product promise while removing platform-level complexity.

The template must still deliver:

- fork-and-run Aztec privacy integration patterns
- configurable privacy at compile time
- L1/L2 messaging with escape hatch recovery
- relayer and self-execution paths
- three protocol references (Aave, Uniswap, Lido)

## 1. Product Overview

### 1.1 Name

`aztec-protocol-privacy-template`

### 1.2 Target Users

- DeFi protocol teams adding private flows to existing products
- Developers building privacy wrappers around established protocols

### 1.3 Value Proposition

Fork the repo and get a working privacy integration in hours, with clear extension paths and minimal infra burden.

### 1.4 Non-Goals

- no standalone SDK product
- no frontend/UI
- no production relayer platform
- no bundled compliance enforcement logic

## 2. Simplification Principles

1. One L1 portal contract per protocol (no separate adapter contract).
2. Keep Aztec integration thin (`env`, `wallet`, `aztec` modules) instead of a large provider abstraction.
3. Compile each protocol once per selected config (generate one `privacy_flags.nr`).
4. Keep protocol implementations modular: core flow first, optional modules separate.
5. Use one Solidity testing stack (Foundry + Anvil), not Foundry + Hardhat.
6. Use one parameterized E2E harness for all protocols.
7. Keep relayer support minimal and stateless.
8. Keep docs focused on core path; move deep references into appendix docs.
9. Reduce config drift with a top-level schema and per-protocol overrides.

## 3. Architecture

### 3.1 High-Level Flow

1. User acts privately in Noir contract on Aztec.
2. Contract emits L2->L1 message.
3. Protocol Portal on L1 consumes message and calls target protocol.
4. Portal sends L1->L2 message for completion/minting.
5. Noir contract mints/updates private notes.

### 3.2 L1 Contract Model

Each protocol has a single contract:

- `AavePortal.sol`
- `UniswapPortal.sol`
- `LidoPortal.sol`

Each portal:

- inherits `BasePortal` and `EscapeHatch`
- contains protocol call logic directly (or internal/library helpers)
- handles Inbox/Outbox message validation and consumption

### 3.3 Error Recovery

Escape hatch remains required:

- register pending L1-side actions
- allow timeout-based claim if L2 completion fails
- cancel escape on successful completion

## 4. Privacy and Configuration

### 4.1 Compile-Time Privacy

Privacy remains compile-time configurable via TOML.

Configuration model:

- top-level `template.toml` defines shared schema/defaults
- optional per-protocol override (for example `packages/protocols/aave/config.toml`)

Generated artifacts:

- `privacy_flags.nr` (Noir feature/privacy booleans)
- `protocol_constants.ts` (addresses, chain IDs, timeouts)
- optional `PortalConstants.sol`

### 4.2 Build Rule

For each protocol build:

1. read merged config
2. generate `privacy_flags.nr`
3. run `nargo compile` once for that selected config

No multi-variant artifact sprawl in repo.  
Matrix variants are optional CI concerns only.

## 5. Repository Structure

```text
/
  packages/
    core/
      solidity/
        BasePortal.sol
        EscapeHatch.sol
      noir/
        notes/
        authwit/
        messaging/
      ts/
        env.ts
        wallet.ts
        aztec.ts
        message-utils.ts
      scripts/
        build-flags.sh
        setup-sandbox.sh
    protocols/
      aave/
        noir/src/
          core/
          modules/
        solidity/
          AavePortal.sol
        ts/
      uniswap/
        noir/src/
          core/
          modules/
        solidity/
          UniswapPortal.sol
        ts/
      lido/
        noir/src/
          core/
          modules/
        solidity/
          LidoPortal.sol
        ts/
  tests/
    e2e/
      harness.ts
      specs/
        aave.spec.ts
        uniswap.spec.ts
        lido.spec.ts
  docs/
    GETTING_STARTED.md
    ARCHITECTURE.md
    ADDING_NEW_PROTOCOL.md
    SECURITY.md
    PRIVACY.md
    appendix/
```

## 6. Reference Implementations

Each protocol ships as **core flow + optional modules**.

| Protocol | Core Flow (Required) | Optional Modules (In-Tree) |
| --- | --- | --- |
| Aave | deposit, withdraw | borrow/repay, health-factor sync |
| Uniswap | swap | LP mint/burn, advanced routing |
| Lido | stake, unstake | harvester/yield notes, withdrawal queue extensions |

Core flows define the default onboarding path.  
Optional modules are available without being required for first integration.

## 7. Execution Modes

### 7.1 Relayer Mode (Default)

- minimal stateless runner (`relayer-runner.ts`)
- submits L1 tx from validated requests
- returns tx hash and status

### 7.2 Self-Execution Mode

- user executes L1 leg directly
- simpler operations, weaker metadata privacy

Both modes remain supported by the same contracts and message format.

## 8. Testing Strategy

### 8.1 Unit + Integration

- Noir: `nargo test`
- Solidity: Foundry tests with Anvil/mainnet fork
- TypeScript: Jest/Vitest for client and messaging behavior

### 8.2 E2E

One reusable harness with per-protocol specs implementing a common interface:

- `deploy()`
- `shield()`
- `act()`
- `unshield()`
- `assert()`

Shared sandbox/fork setup runs once per suite.

## 9. Documentation Strategy

### 9.1 Core Docs (Required)

- `GETTING_STARTED.md`
- `ARCHITECTURE.md`
- `ADDING_NEW_PROTOCOL.md`
- `SECURITY.md`
- `PRIVACY.md`

### 9.2 Appendix Docs (Reference)

Move deep-dive content to `docs/appendix/*`:

- extended threat model and audit checklist
- messaging internals
- optimization notes
- deployment runbooks
- FAQ and troubleshooting

## 10. Non-Functional Requirements

| Requirement | Target |
| --- | --- |
| Fork to first passing local flow | < 15 minutes |
| Proof generation time | < 30s per operation (baseline target) |
| Languages | Solidity, Noir, TypeScript |
| Test coverage | > 80% on template-owned code |
| Tooling complexity | one L1 framework (Foundry) |

## 11. Implementation Phases

### Phase 1: Core Foundation

- finalize monorepo layout
- implement `BasePortal`, `EscapeHatch`, core Noir libs
- implement TS `env/wallet/aztec` and config generator
- set up Foundry + Noir + TS test scaffolding

### Phase 2: Core Protocol Flows

- Aave: deposit/withdraw
- Uniswap: swap
- Lido: stake/unstake
- ship parameterized E2E harness across all three

### Phase 3: Optional Modules

- add advanced protocol modules under `noir/src/modules/*`
- keep core docs and examples focused on core path

### Phase 4: Hardening and Docs

- security pass and checklist updates
- appendix docs
- fork cleanup scripts and final onboarding polish

## 12. Verification Plan

1. Install and bootstrap workspace successfully.
2. Build each protocol with config -> `privacy_flags.nr` generation.
3. Run unit and integration tests across core + protocols.
4. Run one E2E harness that executes all protocol specs.
5. Validate escape hatch timeout behavior in at least one protocol scenario.
6. Validate adding a new protocol using `ADDING_NEW_PROTOCOL.md` in < 4 hours target.

## 13. Retained Promise vs Removed Complexity

Retained:

- Aztec notes/nullifiers/authwit flows
- L1/L2 portal messaging and escape hatch
- relayer + self-execution options
- three protocol categories with working references

Removed or reduced:

- separate adapter contracts
- large provider abstraction layer
- first-class multi-variant circuit artifacts
- dual L1 toolchains
- bespoke E2E suites and heavy doc sprawl

## Appendix A: Glossary (Short)

- **Note**: encrypted private UTXO-style state on Aztec
- **Nullifier**: unique spent marker preventing double-spend
- **Portal**: L1 contract bridging Aztec L1/L2 messaging
- **Authwit**: action-scoped authorization witness
- **Shield/Unshield**: move value between public and private domains
