# Security

## Security model

The template focuses on a small, auditable boundary:

- Core abstractions are protocol-agnostic and immutable in review scope.
- Protocol-specific behavior is isolated under `packages/<protocol>/`.
- Generated constants are deterministic and derived from config only.

## Recommended controls

1. Keep dependencies pinned and verified through lock file (`bun.lock`).
2. Treat generated artifacts as build output only; never hand-edit values.
3. Validate all external addresses in config and runtime values before deploy.
4. Review `solidity` code for `external` calls and access control on sensitive operations.
5. Keep private keys and RPC secrets outside version control.
6. Run `make check` on every change and never skip `make lint`.

## Runtime and fallback behavior

Escape-hatch paths are intentionally explicit and minimal in phase 1-5 scaffolds.
Treat escape hatch semantics as a high-priority security review area for production adapters:

- request/execute parity
- timeout defaults and overrides
- claimability and replay constraints

## Audit-oriented invariants

- Core flows should be deterministic and action-bound.
- Protocol adapters should never deserialize unvalidated payloads into privileged actions.
- Optional module flags are config-derived and should not be mutated at runtime.

## Solidity quality gates

The repository uses `solhint` under `make lint` as a baseline rule enforcement.
CI and local pre-merge checks should include this target.

## Current hardening status

- Phases 0-7 complete with configurable generation and deterministic config.
- Optional modules are scaffolded, but production readiness checks for module execution
  (authorization, accounting, edge-case handling) are intentionally deferred until a hardening
  pass.
