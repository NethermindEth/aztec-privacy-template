## What’s making this PRD heavy

You’re trying to ship **(a)** a forkable template, **(b)** shared infra across 3 languages, **(c)** 3 full protocol references, **(d)** relayer + self-exec, **(e)** compile-time privacy variants, **(f)** full security/compliance docset, **(g)** 3-layer testing + E2E harness.

That’s all coherent, but the repo becomes “3 products + a platform” instead of “a template people can fork quickly”.

Below are ways to simplify **without removing the core promise**: *a fork gives you a working Aztec privacy integration pattern with configurable privacy, messaging, relayer/self execution, and an escape hatch; plus reference implementations.*

---

## 1) Collapse the L1 contract model: Portal + Adapter → single Portal-per-protocol

### Current

* `Adapter` does protocol calls
* `Portal` does messaging + calls adapter
* Extra deployment, extra wiring, more surface area, extra tests

### Simplified

* **One Solidity contract per protocol**: `AavePortal.sol`, `UniswapPortal.sol`, `LidoPortal.sol`

  * Inherits `BasePortal` + `EscapeHatch`
  * Directly calls the target protocol
  * Treat “adapter” as a *library* or *internal functions* for readability/testing

**Keeps full functionality** (protocol calls + Inbox/Outbox + escape hatch), reduces:

* number of contracts
* constructor/immutables wiring
* interface duplication (`IAdapter`, `IPortal`)
* “onlyPortal” modifiers and cross-contract approval patterns

**Net effect**: simpler deployment + fewer moving parts, same external behavior.

---

## 2) Reduce “AztecProvider” abstraction to a thin “Environment” module

Your `AztecProvider` aims to future-proof breaking SDK changes, but it’s also a big local API you now must maintain across sandbox/testnet/mainnet.

### Simplified

* Replace `AztecProvider` with:

  * `env.ts` (network config + PXE url + L1 RPC + chain ids)
  * `wallet.ts` (account creation/loading)
  * `aztec.ts` “thin wrappers” that re-export direct aztec.js calls you actually use

So instead of a full provider interface, you keep a **minimal compatibility layer** around:

* connect / getWallet
* deploy / sendPrivateTx
* message consume helpers (if needed)

This preserves the “SDK churn containment” goal, but avoids re-implementing a parallel SDK.

---

## 3) Stop generating “circuit variants”; generate a single `privacy_flags.nr` and compile once per protocol

Right now the wording implies “different circuit variants are generated” based on `privacy.toml`. That explodes complexity quickly (naming artifacts, test matrix, CI runtime).

### Simplified build rule

* For each protocol: compile exactly **one** Noir package per configuration:

  * `privacy.toml` → generates `privacy_flags.nr`
  * `nargo compile` once
* You’re still compile-time configurable, but you’re not managing multiple variants in-repo.

If later you truly need multiple variants, make it a **CI-only matrix** (build `--profile` or `--config`), not a first-class repo artifact.

---

## 4) Make reference implementations modular: “core flow + optional modules”

To keep “full intended functionality” while slimming the template, restructure each protocol as:

* **Core** (must-have, proves the template):

  * Aave: deposit/withdraw
  * Uniswap: swap
  * Lido: stake/unstake
* **Optional modules** (kept in-tree, but not “required to understand”):

  * Aave: borrow/repay, health factor sync
  * Uniswap: LP mint/burn
  * Lido: harvester / yield notes / withdrawal queue complexity

Mechanically: put optional modules under `noir/src/modules/*` and gate compilation with a single `FEATURE_*` flag derived from `privacy.toml` (or a separate `features.toml`).

This keeps all features available (nothing deleted), but drastically reduces cognitive load for a team forking for “just deposit/withdraw privacy”.

---

## 5) Flatten repository structure into a monorepo with 2 layers: `core` and `protocols/*`

### Current

`shared/` + `{protocol}/` + top-level `tests/` + many scripts

### Simplified target layout

```
/
  packages/
    core/
      solidity/
      noir/
      ts/
      scripts/
    protocols/
      aave/
      uniswap/
      lido/
  docs/
  scripts/
```

Benefits:

* one workspace toolchain (pnpm/bun)
* cleaner dependency boundaries
* core upgrades don’t require hunting “shared/” paths across 3 stacks

---

## 6) Kill duplicated tooling: choose one L1 framework and stick to it

Right now you have Foundry tests *and* Hardhat configs, and Jest on top. That’s expensive.

### Simplified recommendation

* **Foundry for Solidity tests** (mainnet fork)
* TypeScript tests remain Jest (or vitest), but avoid “Hardhat forking” from TS
* If you need programmatic fork control, use **Anvil** (via Foundry) rather than Hardhat

So each protocol has:

* `solidity/` with `foundry.toml`
* `noir/` with `Nargo.toml`
* `ts/` client + tests

This keeps the same coverage, removes an entire toolchain.

---

## 7) Make E2E tests a single parameterized harness (not 3 bespoke suites)

Instead of:

* `aave-e2e.test.ts`
* `uniswap-e2e.test.ts`
* `lido-e2e.test.ts`

Create:

* `tests/e2e/harness.ts` that starts sandbox + fork once
* `tests/e2e/specs/*.spec.ts` that exports a common interface:

  * `deploy()`
  * `shield()`
  * `act()`
  * `unshield()`
  * `assert()`

Then one Jest runner iterates specs.

Same functionality, lower duplication, faster CI.

---

## 8) Replace “relayer mode infrastructure” with a minimal reference + interface

Relayer infra tends to balloon (queues, retries, pricing, auth, monitoring).

### Simplified

* Keep relayer mode as:

  * **a single stateless relayer script**: `relayer-runner.ts`
  * reads requests from a simple source (stdout logs, file, or HTTP callback)
  * submits L1 tx, returns tx hash
* Document “production relayer architecture” separately, but don’t ship it.

You still deliver max privacy mode and the pattern, without shipping an ops product.

---

## 9) Slash the docs set into “core path docs” + “appendix docs”

13 docs is fine for a mature repo; it’s heavy for a template.

### Simplified doc map

Keep 5 “core” docs:

* `GETTING_STARTED.md`
* `ARCHITECTURE.md`
* `ADDING_NEW_PROTOCOL.md`
* `SECURITY.md` (merge threat model + checklist summary; link out to full checklist in appendix)
* `PRIVACY.md` (config + tradeoffs + viewing keys overview)

Move the rest under:

* `docs/appendix/*` and treat as reference, not onboarding.

This preserves all information, but makes the repo approachable.

---

## 10) Tighten the template’s “source of truth”: fewer config files

Right now each protocol has `privacy.toml` plus shared config readers.

### Simplified

* One top-level `template.toml` schema, per-protocol overrides allowed:

  * `protocols/aave/config.toml`
* Generate:

  * `privacy_flags.nr`
  * `protocol_constants.ts` (addresses, chain ids, timeouts)
  * `PortalConstants.sol` (optional)

Single config schema reduces drift and validation burden.

---

## A concrete “simplified MVP” that still matches the PRD promise

If you want the smallest version that still feels complete:

1. **Core package**:

* `BasePortal` + `EscapeHatch`
* Noir libs: notes/authwit/messaging
* TS: env + wallet + message helpers
* scripts: config → flags, sandbox setup, deploy

2. **3 reference protocols (core flows only)**:

* Aave: deposit/withdraw
* Uniswap: swap
* Lido: stake/unstake
  Optional modules exist but not required for “works end-to-end”.

3. **One E2E harness**:

* parameterized across protocols

4. **Docs**:

* 5 core docs + appendix

This keeps:

* fork-and-run experience
* Aztec privacy primitives (notes/nullifiers/authwit)
* portal messaging + escape hatch
* relayer/self-exec modes (relayer minimal runner)
* multiple protocol categories validated

…and removes the largest sources of repo sprawl: duplicated frameworks, multi-variant circuits, heavy provider abstraction, duplicated tests/docs.

---

## Quick “diff” summary of what to change first (highest leverage)

1. Merge Adapter into Portal (single contract per protocol)
2. Drop Hardhat configs; standardize on Foundry fork tests
3. Replace `AztecProvider` with `env/wallet/aztec` thin modules
4. Make protocols “core + optional modules” and advertise only core in README
5. Parameterize E2E harness

If you want, I can rewrite your repo structure section + phase plan to reflect this simplified architecture (keeping your PRD format, but with fewer moving parts).
