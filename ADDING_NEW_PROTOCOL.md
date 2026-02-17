# Adding a New Protocol

This template is designed so protocol work is isolated to one folder under `packages/<protocol>/`.

## 1) Scaffold directories

Create the minimal set:

- `packages/<protocol>/config.toml`
- `packages/<protocol>/generated` (created by build)
- `packages/<protocol>/noir/src/core`
- `packages/<protocol>/noir/src/modules` (optional features)
- `packages/<protocol>/solidity`
- `packages/<protocol>/solidity/test`
- `packages/<protocol>/ts`
- `packages/<protocol>/ts/<protocol>.test.ts`

## 2) Add protocol config

Add `packages/<protocol>/config.toml` with minimal overrides:

```toml
[metadata]
name = "<protocol-name>"

[privacy]
recipient_private = true
amount_private = false
sender_private = true
memo_private = false

[runtime]
default_gas_limit = 2000000

[addresses]
protocol_contract = "0x0000000000000000000000000000000000000000"
token_address = "0x0000000000000000000000000000000000000000"

[modules]
enable_borrow = false
enable_repay = false
enable_lp = false
enable_queue = false
enable_yield = false
```

Only include values you need changed; all unspecified values inherit from `template.toml`.

## 3) Implement core Noir flow

- Add one `.nr` file per required action under `noir/src/core`.
- Keep helpers deterministic and pure:
  - typed input structs
  - action id functions
  - encoding helpers
  - lightweight validation helpers
- Expose via `noir/src/lib.nr` with `mod core { ... }`.

## 4) Optional modules

- Add optional modules only under `noir/src/modules`:
  - Aave-style optional: `borrow`, `repay`
  - Uniswap-style optional: `lp`
  - Lido-style optional: `queue`, `yield`
- Read feature constants from `crate::privacy_flags`.
- Keep optional modules API consistent with core modules.

## 5) Implement protocol TS client

- Add request builders in `packages/<protocol>/ts/<protocol>.ts`.
- Reuse generated constants from `generated/protocol_constants.ts`.
- Add tests in `<protocol>.test.ts`.

## 6) Add Solidity portal

- Add `Portal.sol` implementing request/execute flow consistent with protocol client.
- Extend with escape hatch behavior where execution can fail.
- Add a protocol-specific test under `solidity/test`.

## 7) Add E2E adapter/spec

- Add spec adapter in `tests/e2e/specs/<protocol>.ts`.
- Add harness-driven spec in `tests/e2e/specs/<protocol>.spec.ts`.
- Verify both relayer and self-execution modes when relevant.

## 8) Regenerate artifacts and wire to docs

1. Rebuild all protocol artifacts:

   ```bash
   make protocol-<protocol>
   ```

2. Update:
   - `docs/appendix/<protocol>-core-flow.md` for protocol details
   - release/fork impact in related docs if needed

## 9) Validate before handoff

- `make fmt`
- `make lint`
- `make check`
- `make build`
- `make test-e2e`

Optional local checks:

- `make test` for full repo test command path
- `bun test packages/<protocol>/ts/<protocol>.test.ts`

## 10) Keep behavior additive

Core flows must remain stable and working when all optional module flags are false.
