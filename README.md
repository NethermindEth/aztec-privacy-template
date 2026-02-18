# Aztec Privacy Template

Single-repo starter for building Aztec + L1 protocol integrations.

This repo has two concerns, clearly separated:

1. `generator/`:
CLI generator that scaffolds new starter projects.
2. Runtime reference implementation:
protocol adapters, Solidity portals, and E2E tests under `packages/` + `tests/`.

## Repository Structure

```text
.
|-- Makefile                           # single entrypoint for all dev/CI commands
|-- packages/
|   |-- core/solidity/                 # shared L1 primitives
|   |-- protocols/
|   |   |-- aave/                      # Aave protocol adapter contracts
|   |   |-- lido/                      # Lido protocol adapter contracts
|   |   `-- uniswap/                   # Uniswap protocol adapter contracts
|-- generator/                         # project generator package
|-- tests/
|   |-- e2e/                           # protocol and adapter E2E suites
|   |-- helpers/                       # E2E runtime/test harness utilities
|   `-- mocks/                         # Solidity mocks used by E2E tests
`-- scripts/                           # shared compile helpers
```

## Quick Start

```bash
make install
make check
make test
```

## Main Commands

```bash
make help
make install
make check
make test
make build
make clean
```

Quality:

```bash
make fmt
make fmt-check
make lint
make typecheck
```

E2E:

```bash
make test-e2e
make test-e2e-adapters
make test-e2e-full
```

Generator:

```bash
make generator-check
make generator-e2e-case
make generator-published-artifact-smoke
make generator-release-check
```

## Scaffold with the Generator

```bash
node generator/dist/cli.js my-app --yes
```

Remote example source overlay (GitHub URL or owner/repo path):

```bash
node generator/dist/cli.js my-app \
  --example-source aztecprotocol/aztec-packages/examples/noir-contracts#master \
  --yes
```
