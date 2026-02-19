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
|-- scripts/
|   `-- compile-aztec-contract.sh
|-- Makefile
`-- package.json
```

## Quick start

```bash
cd __PROJECT_NAME__
__INSTALL_COMMAND__
make check
make test
```

## Core commands

1. `make build`  
Compile Solidity and Aztec contract artifacts.

2. `make test`  
Run all starter Solidity tests (`BasePortal`, `EscapeHatch`, `GenericPortal` flow).

## Adaptation workflow

1. Start from `contracts/l1/GenericPortal.sol`.
2. Replace `IGenericActionExecutor` wiring with your protocol integration call(s).
3. Extend `contracts/aztec/src/main.nr` intent fields to match your private flow.
4. Update `contracts/l1/test/GenericPortal.t.sol` with protocol-specific assertions.
5. Implement relayer + canonical Inbox/Outbox integration for your network.

## Safety boundaries

This starter is not production-ready as-is. It does not include:

1. relayer service implementation
2. production deployment pipelines
3. frontend application scaffolding
4. production bridge claim operations

Treat this scaffold as a baseline to adapt, document, and harden for your protocol.
