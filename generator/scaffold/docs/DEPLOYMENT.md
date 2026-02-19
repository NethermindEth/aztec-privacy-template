# Deployment and Configuration Runbook

This runbook defines required deployment/config values for the generated template and where each value comes from.

Important:

1. This template currently does not ship an end-to-end deployment script.
2. A deployment script is expected in future iterations.
3. Until then, use this runbook as the source of truth for manual/developer-run automation.

## Contracts and Constructor Inputs

### L1 `GenericPortal` constructor

`new GenericPortal(protocolId_, l2Contract_, relayer_, executor_)`

1. `protocolId_`:
Source: your protocol flow identifier (bytes32) agreed by your integration.
Recommendation: derive from stable string (for example `keccak256("MY_PROTOCOL_V1")`) and pin in config.

2. `l2Contract_`:
Source: deployed L2 Aztec adapter address (`GenericPrivacyAdapter` or your renamed contract).
Must match the L2 contract that emits/consumes messages for this flow.

3. `relayer_`:
Source: relayer/service account address allowed to call `executeAction`.
Use a dedicated key/account for relaying.

4. `executor_`:
Source: deployed protocol executor hook implementing `IGenericActionExecutor`.
This is your protocol-specific L1 integration contract.

### L2 `GenericPrivacyAdapter` constructor

`constructor(admin, portal_address)`

1. `admin`:
Source: operator/admin Aztec address for your deployment.

2. `portal_address`:
Source: deployed L1 `GenericPortal` address for this environment.
Must match the exact L1 portal used by the relayer.

## Address Dependency and Planning

`GenericPortal` requires the L2 adapter address, and `GenericPrivacyAdapter` requires the L1 portal address.
Plan this dependency before deployment:

1. Deterministic address strategy:
Use deterministic deployment/orchestration so each side's address can be known in advance.

2. Coordinated deployment strategy:
Use deployment tooling that can compute planned addresses, then deploy both sides with matching inputs.

Do not use placeholder addresses in production flows.

## Environment Configuration Manifest

Create one manifest (for example `.env.deploy` or deployment JSON) per environment:

1. `PROTOCOL_ID` (bytes32)
2. `L1_GENERIC_PORTAL` (address)
3. `L2_GENERIC_ADAPTER` (address)
4. `RELAYER_ADDRESS` (address)
5. `EXECUTOR_ADDRESS` (address)
6. `AZTEC_ADMIN_ADDRESS` (Aztec address)
7. `AZTEC_NETWORK` (local/devnet/testnet/mainnet-like)
8. `L1_CHAIN_ID`
9. Canonical Aztec messaging contract addresses for the chosen network version (Inbox/Outbox or current equivalent)

Keep this manifest under version control per environment (excluding secrets).

## Minimum Deployment Checklist

1. Confirm `PROTOCOL_ID` is identical across all components.
2. Confirm `L1_GENERIC_PORTAL` and `L2_GENERIC_ADAPTER` cross-reference each other correctly.
3. Confirm relayer key corresponds to `RELAYER_ADDRESS`.
4. Confirm executor contract implements expected `executeAction` behavior.
5. Run `make build` and `make test` in the generated project before deployment.
6. Run relayer integration tests that validate request, execute, and finalize with canonical messaging.

## Post-Deployment Validation

1. Verify contract constructor params on chain (L1 and L2).
2. Submit a minimal request path and verify:
`request_action -> requestAction -> executeAction -> finalize_action`
3. Validate failure path:
`executeAction` failure registers escape and `claimEscape` works after timeout.
4. Confirm relayer observability:
message nonce progression, message hash matching, and finalize payload compatibility.
