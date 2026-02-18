# Generic Adapter (Aztec / Noir)

This folder contains a neutral Aztec contract skeleton for private request/finalize flows.

`main.nr` is intentionally minimal. It gives builders a starting point for:

1. private intent creation (`request_action`)
2. L2 -> L1 portal message emission
3. completion message consumption (`finalize_action`)
4. pending intent state tracking

## Files

- `Nargo.toml`: Noir package metadata + Aztec dependency
- `src/main.nr`: generic adapter skeleton

## Adaptation checklist

1. Replace `asset`, `amount`, and `action_type` intent fields with your protocol model.
2. Keep intent/content hashing deterministic with L1 parser assumptions.
3. Keep pending-state writes behind self-call-only public entrypoints.
4. Mirror your L1 completion payload in `finalize_action` content hashing.
