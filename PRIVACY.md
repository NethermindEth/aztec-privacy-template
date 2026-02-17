# Privacy

## Privacy configuration model

This template emits privacy knobs from config as deterministic generated constants:

- `recipient_private`
- `amount_private`
- `sender_private`
- `memo_private`

Each value is merged from `template.toml` and protocol overrides, then written to:

- `packages/protocols/<protocol>/generated/privacy_flags.nr`
- `packages/protocols/<protocol>/generated/protocol_constants.ts`
- `packages/protocols/<protocol>/generated/PortalConstants.sol`

## What the current scaffold provides

- Core action payloads are deterministic and helper-based.
- Core flows are documented in protocol appendix docs.
- Optional modules are available but off by default and safe to adopt incrementally.

## Feature flags and data minimization

Optional module flags are not privacy flags; they control feature surface:

- `enable_borrow`, `enable_repay`
- `enable_lp`
- `enable_queue`, `enable_yield`

Disabling optional modules keeps protocol scope minimal and reduces proof/logic exposure.

## Caveats

This scaffold is a simplified template:

- No production-grade note-format compatibility is guaranteed yet.
- Private input semantics are intentionally minimal for onboarding.
- Tooling may still serialize or log helper structs during local testing.

For production adapters, conduct a separate privacy review before handling real confidential
flows.
