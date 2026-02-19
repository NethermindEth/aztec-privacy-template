# create-aztec-privacy-template

CLI generator for scaffolding Aztec privacy starter projects.

- npm: https://www.npmjs.com/package/create-aztec-privacy-template

## Usage

```bash
npx create-aztec-privacy-template@latest my-aztec-app
```

Non-interactive:

```bash
npx create-aztec-privacy-template@latest my-aztec-app --yes
```

## CLI

```bash
create-aztec-privacy-template <project-name-or-path> \
  [--pm <bun|npm|pnpm|yarn>] \
  [--example <none|aave|lido|uniswap|all>] \
  [--example-source <github-url|owner/repo[/path][#ref]>] \
  [--yes] [--skip-install] [--disable-git]
```

## Generated Contracts

The scaffold includes a minimal, protocol-agnostic contract stack:

1. `contracts/l1/BasePortal.sol`
Implements deterministic message hashing and message lifecycle tracking between Aztec and L1.

2. `contracts/l1/EscapeHatch.sol`
Implements timeout-gated escape requests so users can reclaim funds after failed execution paths.

3. `contracts/l1/GenericPortal.sol`
Main L1 bridge contract for request/execute/finalize flow with relayer gating and protocol executor integration hook.

4. `contracts/aztec/src/main.nr` (`GenericPrivacyAdapter`)
Noir contract skeleton for private request + finalize flow and pending intent tracking.

The scaffold also includes Solidity tests for all three L1 contracts under `contracts/l1/test`.

## Examples

`--example` can add adaptation guides under `examples/`:

- `aave`
- `lido`
- `uniswap`
- `all`

## Local Development

```bash
bun install
bun run build
node dist/cli.js my-local-app --yes
```
