# Aztec Protocol Privacy Template

This repository is a starter kit for protocol teams that want to add Aztec privacy to an existing L1 protocol integration.

It gives you real end-to-end examples for:

- `Aave` style deposit/withdraw flows
- `Uniswap` style swap flows
- `Lido` style stake/unstake flows

Each example includes:

- an Aztec contract (private intent + finalize flow)
- an L1 portal contract (request + execute + completion message)
- a real E2E test that runs against local Aztec + local L1

## Who this is for

This repo is for protocol builders and smart contract engineers who need a reference architecture for:

- private user intent on Aztec
- public execution on Ethereum
- deterministic message passing between both sides

## Core idea

Users keep intent and state transitions private on Aztec, while protocol execution still happens on L1 through a portal.

```text
User
  |
  v
Aztec Adapter (private intent)
  |  message_portal(...)
  v
L1 Portal (request stored)
  |  relayer executes
  v
Underlying L1 Protocol (Aave/Uniswap/Lido)
  |
  |  success/failure handling + L1->L2 message
  v
Aztec Adapter finalize_* (consume message, clear pending)
```

## Repository layout

```text
.
|-- packages/
|   |-- core/solidity/              # Shared L1 portal primitives
|   `-- protocols/
|       |-- aave/
|       |   |-- aztec/
|       |   `-- solidity/
|       |-- uniswap/
|       |   |-- aztec/
|       |   `-- solidity/
|       `-- lido/
|           |-- aztec/
|           `-- solidity/
|-- tests/
|   |-- aave.ts                     # Real E2E flow
|   |-- uniswap.ts                  # Real E2E flow
|   |-- lido.ts                     # Real E2E flow
|   |-- runtime.ts                  # Local network + deploy helpers
|   `-- mocks/                      # Solidity test doubles (kept out of protocol code)
`-- Makefile
```

## Quick start

```bash
make install
make build
make test-e2e
```

`make install` verifies required tooling first (`bun`, `node`, `aztec`, `forge`, `cast`, `anvil`) and then installs workspace dependencies.

## Protocol entry points

- `packages/protocols/aave/README.md`
- `packages/protocols/uniswap/README.md`
- `packages/protocols/lido/README.md`

These READMEs explain each protocol flow, contract responsibilities, and adaptation guidance.

## Common commands

- `make install` -> verify toolchain + install dependencies
- `make verify-toolchain` -> check required local binaries
- `make build` -> compile protocol Aztec artifacts
- `make test-e2e` -> run real end-to-end tests
- `make check` -> formatting + lint + core checks
- `make clean` -> remove build artifacts (`target`, `cache`, `out`, coverage caches)

## What this template is not

- not a production-ready bridge or relayer stack
- not a frontend product
- not a full protocol implementation

It is a minimal but real integration baseline you can clone and adapt.
