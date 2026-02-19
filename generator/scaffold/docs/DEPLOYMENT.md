# Deployment and Configuration Runbook

This runbook defines required deployment/config values for the generated template and where each value comes from.

Important:

1. The scaffold includes `scripts/deploy.sh` for end-to-end deployment automation.
2. The script supports both local (`aztec start --local-network`) and Sepolia + Aztec testnet style setups.
3. This runbook remains the source of truth for constructor semantics and environment-level value ownership.

## Contracts and Constructor Inputs

### L1 `GenericPortal` constructor

`new GenericPortal(protocolId_, l2Contract_, relayer_, executor_)`

1. `protocolId_`:
Source: your protocol flow identifier (bytes32) agreed by your integration.
Recommendation: derive from stable string (for example `keccak256("MY_PROTOCOL_V1")`) and pin in config.

2. `l2Contract_`:
Source: deployed L2 Aztec adapter contract address as `bytes32`
(`GenericPrivacyAdapter` or your renamed contract).
Must match the L2 contract that emits/consumes messages for this flow.
You may pass `0x00...00` at deploy time and finalize once via `setL2Contract(bytes32)`.

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

The scaffold deploy script resolves the dependency using one-time deferred L2 binding on `GenericPortal`:

1. deploy `GenericActionExecutor`
2. deploy `GenericPortal` with `l2Contract_ = 0x00...00` (`bytes32`)
3. configure executor portal binding
4. deploy `GenericPrivacyAdapter` with the real deployed portal address
5. finalize L1 portal L2 binding via `setL2Contract(bytes32)`

## Script Usage

```bash
bash scripts/deploy.sh
```

Verify deployed contracts against live RPCs:

```bash
make test-deployment
# or: make test-deployment DEPLOYMENT_FILE=.deployments.sepolia.json
```

What `make test-deployment` runs:

1. `scripts/verify-deployment.sh` (manifest + L1/L2 invariant checks)
2. `scripts/integration-test-deployment.sh` (state-changing L1 request/execute success + failure flow)

### What `.env.deploy.example` is for

`.env.deploy.example` is a starter environment file for `scripts/deploy.sh`.

1. It documents the deploy script variables in one place.
2. It provides sensible local defaults for `aztec start --local-network`.
3. It includes commented Sepolia/testnet examples you can enable per environment.

Important behavior:

1. `scripts/deploy.sh` does **not** auto-load `.env.deploy`.
2. You must export variables yourself before running the script.

Recommended flow:

```bash
cp .env.deploy.example .env.deploy
# edit .env.deploy
set -a && source .env.deploy && set +a
bash scripts/deploy.sh
```

Local defaults:

1. `L1_RPC_URL=http://127.0.0.1:8545`
2. `AZTEC_NODE_URL=http://127.0.0.1:8080`
3. anvil deterministic test key if `DEPLOYER_PRIVATE_KEY` is unset
4. Aztec account alias `test0` after `import-test-accounts`

Sepolia/testnet expected inputs:

1. `L1_RPC_URL` pointing at Sepolia RPC
2. `AZTEC_NODE_URL` pointing at your Aztec testnet endpoint
3. `DEPLOYER_PRIVATE_KEY` funded with Sepolia ETH

Optional script env vars:

1. `PROTOCOL_ID` (`bytes32`, default `keccak256("GENERIC_ACTION_V1")`)
2. `RELAYER_ADDRESS` (defaults to L1 deployer address)
3. `AZTEC_ACCOUNT_ALIAS` (defaults to `test0` on local, `deployer` on sepolia)
4. `AZTEC_CONTRACT_ALIAS` (defaults to `generic-privacy-adapter`)
5. `SPONSORED_FPC_ADDRESS` (testnet account bootstrap helper)
6. `WALLET_DATA_DIR` (defaults to `.aztec-wallet` under project root)
7. `SKIP_BUILD=1` to skip artifact rebuild

Optional integration-test env vars:

1. `RELAYER_PRIVATE_KEY` (required unless local default key matches relayer)
2. `OPERATOR_PRIVATE_KEY` (required unless same as deployer/relayer key)
3. `DEPLOYER_PRIVATE_KEY` (fallback key source for integration tests)
4. `INTEGRATION_AMOUNT_WEI` (request amount used by integration flow)
5. `FAILURE_TIMEOUT_BLOCKS` (escape timeout blocks used by failure-path integration test)
6. `FAILURE_TARGET` (non-allowlisted address used to assert failure-path behavior)

## Environment Configuration Manifest

Create one manifest (for example `.env.deploy` or deployment JSON) per environment:

1. `PROTOCOL_ID` (bytes32)
2. `L1_GENERIC_PORTAL` (address)
3. `L2_GENERIC_ADAPTER` (bytes32 Aztec address)
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
