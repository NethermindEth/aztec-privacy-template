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

## Deployment parameters

See `../../docs/DEPLOYMENT.md` for constructor input requirements and value sources for:

1. `admin`
2. `portal_address`

## Adaptation checklist

1. Replace `asset`, `amount`, and `action_type` intent fields with your protocol model.
2. Keep intent/content hashing deterministic with L1 parser assumptions.
3. Keep pending-state writes behind self-call-only public entrypoints.
4. Mirror your L1 completion payload in `finalize_action` content hashing.

## L1 Completion Payload Contract

`finalize_action` consumes an L1->L2 completion message using:

1. `content = poseidon2_hash([intent_id, result_amount as Field])`
2. the same `portal_address`
3. relayer-provided `secret` + `message_leaf_index`

When adapting the flow, define one canonical completion payload schema and keep it identical across:

1. `contracts/l1/GenericPortal.sol` success path emission
2. relayer message construction/proof consumption
3. `finalize_action` content hash construction in `src/main.nr`

If any field order/type/hash input changes on one side, update all three.

## Personalization examples

Example A: lending position intent

1. replace fields:
   - `asset` -> `market_id`
   - `action_type` -> `position_action` (`OPEN`, `CLOSE`, `REPAY`)
2. include a user risk control field in intent hash (for example `max_rate_bps`).
3. mirror the same semantic fields in L1 `actionData` encoding.

Example B: swap intent

1. replace fields:
   - `asset` -> `token_in`
   - add `token_out`
   - `amount` -> `amount_in`
2. include protection fields in intent hash (for example `min_out`, `deadline_slot`).
3. ensure L1 completion payload includes data needed by `finalize_action` (for example settled amount).
