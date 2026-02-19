# __PROJECT_NAME__

This repository is a protocol-agnostic starter for building Aztec privacy flows.

It is intentionally minimal:

1. shared L1 primitives + one generic portal in one folder
2. one neutral generic Aztec adapter skeleton
3. minimal tests validating request/finalize + escape behavior

## Architecture

```text
User
  |
  v
Aztec Generic Adapter (private request_*)
  | message_portal(...)
  v
L1 Generic Portal (requestAction)
  | relayer executeAction
  v
Generic Executor hook
  | success => completion message
  | failure => escape registration
  v
Aztec Generic Adapter (private finalize_*)
```

Important integration boundary:

1. This template models request/completion message content and lifecycle.
2. Real cross-chain transport must be wired through Aztec canonical messaging contracts
   (Inbox/Outbox for your target network/version).
3. `BasePortal` tracks deterministic message hashes and emits events for traceability, but it does not by itself
   submit/consume canonical bridge proofs.
4. Your relayer/service must bridge Aztec messages to `requestAction`/`executeAction` and back to
   `finalize_action` using the canonical contracts.

## Repository layout

```text
.
|-- contracts/
|   |-- l1/                            # BasePortal, EscapeHatch, GenericPortal + tests
|   `-- aztec/                         # Generic Noir adapter skeleton
|-- docs/
|   |-- DEPLOYMENT.md                  # deployment/configuration runbook (manual until script is added)
|   `-- RELAYER_SPEC.md                # minimal relayer operational spec
|-- scripts/
|   `-- compile-aztec-contract.sh
|-- Makefile
`-- package.json
```

## Quick start

```bash
cd __PROJECT_NAME__
make verify-toolchain
__INSTALL_COMMAND__
make check
```

`make check` runs formatting checks, linting, and starter tests.
Use `make help` for the full command list.

## Prerequisites

The generated project expects these tools on PATH:

1. `bun`
2. `node`
3. `aztec`
4. `forge`
5. `cast`

Run `make verify-toolchain` to validate your local setup.

## Core commands

1. `make build`  
Compile Solidity and Aztec contract artifacts.

2. `make test`  
Run all starter Solidity tests (`BasePortal`, `EscapeHatch`, `GenericPortal` flow).

## Adaptation workflow

1. Start from `contracts/l1/GenericPortal.sol`.
2. Replace `IGenericActionExecutor` wiring with your protocol integration call(s).
3. Extend `contracts/aztec/src/main.nr` intent fields to match your private flow.
4. Define a single completion payload schema and keep it identical in `GenericPortal` success emission, relayer transport,
   and Noir `finalize_action` hashing.
5. Update `contracts/l1/test/GenericPortal.t.sol` with protocol-specific assertions.
6. Add relayer/integration tests that prove completion payload compatibility between L1 and Noir.
7. Implement relayer + canonical Inbox/Outbox integration for your network.

## Start Here (Recommended Order)

1. `contracts/l1/GenericPortal.sol`
Define protocol-side execution flow and payload expectations.

2. `contracts/aztec/src/main.nr`
Define private intent fields and finalize payload compatibility.

3. `contracts/l1/test/GenericPortal.t.sol`
Add protocol-specific request/execute/failure invariants.

4. `docs/DEPLOYMENT.md` and `docs/RELAYER_SPEC.md`
Set constructor/deployment config and relayer operating behavior.

## Deployment Configuration

Use `docs/DEPLOYMENT.md` as the source of truth for:

1. required constructor parameters
2. value sources per environment
3. address dependency planning between L1 and L2 contracts
4. deployment validation checks

This template will include a deployment script in a future iteration. Until then, use the runbook for manual or custom automation.

## Relayer Operational Spec

Use `docs/RELAYER_SPEC.md` for minimum relayer behavior requirements:

1. canonical message handling responsibilities
2. idempotency + nonce rules
3. retry/failure/reorg handling
4. required observability and operational controls

## Safety boundaries

This starter is not production-ready as-is. It does not include:

1. relayer service implementation (only a minimum operational spec is provided)
2. production deployment pipelines
3. frontend application scaffolding
4. production bridge claim operations

Treat this scaffold as a baseline to adapt, document, and harden for your protocol.
