# Adding a New Protocol

This template is designed so protocol work is isolated to one folder under `packages/protocols/<protocol>/`.

## 1) Scaffold directories

Create the minimal set:

- `packages/protocols/<protocol>/config.toml`
- `packages/protocols/<protocol>/generated` (created by build)
- `packages/protocols/<protocol>/aztec/src/main.nr`
- `packages/protocols/<protocol>/noir/src/core`
- `packages/protocols/<protocol>/noir/src/modules` (optional features)
- `packages/protocols/<protocol>/solidity`
- `packages/protocols/<protocol>/solidity/test`
- `packages/protocols/<protocol>/ts`
- `packages/protocols/<protocol>/ts/<protocol>.test.ts`

## 2) Add protocol config

Add `packages/protocols/<protocol>/config.toml` with minimal overrides:

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

## 3) Implement Aztec contract

- Add `aztec/Nargo.toml` with the Aztec dependency and contract package metadata.
- Implement the protocol contract in `aztec/src/main.nr`:
  - `constructor` with portal address and admin wiring
  - private request entrypoints (`request_deposit`, `request_swap`, etc.)
  - private finalize entrypoints consuming L1->L2 messages
  - public pending-status state updates guarded to self-calls

## 4) Optional Noir helper modules

- Keep protocol-specific helper primitives under `noir/src/core` and `noir/src/modules`.
- Use these modules for deterministic encoding/flag helpers, not as deployable contracts.

## 5) Optional modules

- Add optional modules only under `noir/src/modules`:
  - Aave-style optional: `borrow`, `repay`
  - Uniswap-style optional: `lp`
  - Lido-style optional: `queue`, `yield`
- Read feature constants from `crate::privacy_flags`.
- Keep optional modules API consistent with core modules.

## 6) Implement protocol TS client

- Add request builders in `packages/protocols/<protocol>/ts/<protocol>.ts`.
- Reuse generated constants from `generated/protocol_constants.ts`.
- Add tests in `<protocol>.test.ts`.

## 7) Add Solidity portal

- Add `Portal.sol` implementing request/execute flow consistent with protocol client.
- Extend with escape hatch behavior where execution can fail.
- Add a protocol-specific test under `solidity/test`.

## 8) Add real E2E spec

- Add `tests/e2e/real/<protocol>.real.spec.ts`.
- Compile the protocol Aztec contract (`aztec compile`) inside the spec or pre-build step.
- Run against real local services (`aztec` local network + `forge/cast` on L1).

## 9) Regenerate artifacts and wire to docs

1. Generate protocol artifacts:

   ```bash
   bun run scripts/config/src/cli.ts --template=template.toml --protocol=<protocol> --protocol-config=packages/protocols/<protocol>/config.toml --out-dir=packages/protocols/<protocol>/generated
   ```

2. Add/verify a `Makefile` target for `protocol-<protocol>` that runs config generation and `aztec compile`.

3. Update:
   - `docs/appendix/<protocol>-core-flow.md` for protocol details
   - release/fork impact in related docs if needed

## 10) Validate before handoff

- `make fmt`
- `make lint`
- `make check`
- `make build`
- `make test-e2e`

Optional local checks:

- `make test` for full repo test command path
- `bun test packages/protocols/<protocol>/ts/<protocol>.test.ts`

## 11) Keep behavior additive

Core flows must remain stable and working when all optional module flags are false.
