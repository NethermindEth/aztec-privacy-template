# Create Aztec Privacy Template

The template generator is released and available on npm:

- https://www.npmjs.com/package/create-aztec-privacy-template

Use it to scaffold a protocol-agnostic Aztec + L1 starter with Solidity portals, a Noir adapter skeleton, and baseline tests.

## Quick Start

```bash
npx create-aztec-privacy-template@latest my-aztec-app
cd my-aztec-app
make check
```

Non-interactive scaffolding:

```bash
npx create-aztec-privacy-template@latest my-aztec-app --yes
```

## CLI Options

```bash
npx create-aztec-privacy-template@latest <project-name-or-path> \
  [--pm <bun|npm|pnpm|yarn>] \
  [--example <none|aave|lido|uniswap|all>] \
  [--example-source <github-url|owner/repo[/path][#ref]>] \
  [--yes] [--skip-install] [--disable-git]
```

Common examples:

```bash
npx create-aztec-privacy-template@latest demo --pm pnpm --example aave --yes
npx create-aztec-privacy-template@latest demo --example all --yes
npx create-aztec-privacy-template@latest demo --skip-install --disable-git --yes
```

## What Gets Generated

Top-level layout:

```text
my-aztec-app/
|-- contracts/
|   |-- l1/
|   |   |-- BasePortal.sol
|   |   |-- EscapeHatch.sol
|   |   |-- GenericPortal.sol
|   |   `-- test/
|   |       |-- BasePortal.t.sol
|   |       |-- EscapeHatch.t.sol
|   |       `-- GenericPortal.t.sol
|   `-- aztec/
|       |-- Nargo.toml
|       `-- src/main.nr
|-- scripts/compile-aztec-contract.sh
|-- Makefile
|-- package.json
`-- README.md
```

Contract responsibilities:

1. `contracts/l1/BasePortal.sol`
Deterministic Aztec <-> L1 message hashing, message issuance/consumption tracking, and relayer gating.

2. `contracts/l1/EscapeHatch.sol`
Timeout-based recovery path. Failed executions can register escrowed escape requests, then depositors can claim after timeout.

3. `contracts/l1/GenericPortal.sol`
Protocol-agnostic bridge flow. Accepts requests (`requestAction`), validates/executes relayed actions (`executeAction`), emits completion messages, and registers escape on failure.

4. `contracts/aztec/src/main.nr` (`GenericPrivacyAdapter`)
Noir starter for private request/finalize flow: creates intent IDs, sends portal messages, consumes completion messages, and tracks pending intents.

## Protocol Example Overlays

`--example` adds protocol-specific guide files under `examples/`:

- `aave`
- `lido`
- `uniswap`
- `all`

These overlays are adaptation guides to help you customize the generic contracts for a concrete protocol flow.

## After Scaffold

Inside your generated app:

```bash
make help
make check
make test
make build
```

Tooling expected by the generated project:

- `bun`
- `node`
- `aztec`
- `forge`
- `cast`

## Repository Note

This repository contains:

1. The published generator package in `generator/`
2. Reference protocol/runtime code under `packages/` and `tests/`
