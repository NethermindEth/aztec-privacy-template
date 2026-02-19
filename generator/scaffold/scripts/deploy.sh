#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

LOCAL_CHAIN_ID=31337
SEPOLIA_CHAIN_ID=11155111
DEFAULT_ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

L1_RPC_URL="${L1_RPC_URL:-http://127.0.0.1:8545}"
AZTEC_NODE_URL="${AZTEC_NODE_URL:-}"
DEPLOYER_PRIVATE_KEY="${DEPLOYER_PRIVATE_KEY:-}"
RELAYER_ADDRESS="${RELAYER_ADDRESS:-}"
PROTOCOL_ID="${PROTOCOL_ID:-}"
AZTEC_ACCOUNT_ALIAS="${AZTEC_ACCOUNT_ALIAS:-}"
AZTEC_CONTRACT_ALIAS="${AZTEC_CONTRACT_ALIAS:-generic-privacy-adapter}"
SPONSORED_FPC_ADDRESS="${SPONSORED_FPC_ADDRESS:-}"
WALLET_DATA_DIR="${WALLET_DATA_DIR:-${ROOT_DIR}/.aztec-wallet}"
SKIP_BUILD="${SKIP_BUILD:-0}"
AZTEC_PAYMENT_METHOD=""

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

run_quiet_or_fail() {
  local label="$1"
  shift

  local output
  set +e
  output="$("$@" 2>&1)"
  local status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    echo "${label} failed." >&2
    printf '%s\n' "$output" >&2
    exit "$status"
  fi
}

is_valid_eth_address() {
  [[ "$1" =~ ^0x[a-fA-F0-9]{40}$ ]]
}

is_valid_bytes32() {
  [[ "$1" =~ ^0x[a-fA-F0-9]{64}$ ]]
}

zero_bytes32() {
  printf '0x%064d\n' 0
}

pad_eth_address_to_field() {
  local eth="${1#0x}"
  printf '0x%024s%s\n' "" "$eth" | tr ' ' '0'
}

wallet() {
  "${AZTEC_WALLET_CMD[@]}" "$@"
}

extract_l2_contract_address() {
  local output="$1"
  local addr
  addr="$(printf '%s\n' "$output" | grep -Eo 'Contract deployed at (0x[a-fA-F0-9]{64})' | awk '{print $4}' | tail -n1 || true)"
  if [[ -z "$addr" ]]; then
    addr="$(wallet get-alias "contracts:${AZTEC_CONTRACT_ALIAS}" 2>/dev/null | grep -Eo '0x[a-fA-F0-9]{64}' | tail -n1 || true)"
  fi
  printf '%s\n' "$addr"
}

deploy_l1_contract() {
  local contract_path="$1"
  shift

  local -a cmd=(
    forge create "$contract_path"
    --rpc-url "$L1_RPC_URL"
    --private-key "$DEPLOYER_PRIVATE_KEY"
    --broadcast
  )

  if [[ "$L1_CHAIN_ID" == "$SEPOLIA_CHAIN_ID" ]]; then
    cmd+=(--legacy)
  fi

  if (( $# > 0 )); then
    cmd+=(--constructor-args "$@")
  fi

  local output
  output="$(cd "${ROOT_DIR}/contracts/l1" && "${cmd[@]}" 2>&1)"
  printf '%s\n' "$output" >&2

  local address
  address="$(printf '%s\n' "$output" | grep -Eo 'Deployed to: (0x[a-fA-F0-9]{40})' | awk '{print $3}' | tail -n1 || true)"

  if [[ -z "$address" ]]; then
    echo "Failed to parse deployment address for ${contract_path}" >&2
    exit 1
  fi

  printf '%s\n' "$address"
}

cast_send() {
  local to="$1"
  local sig="$2"
  shift 2

  local -a cmd=(
    cast send "$to" "$sig" "$@"
    --rpc-url "$L1_RPC_URL"
    --private-key "$DEPLOYER_PRIVATE_KEY"
  )

  if [[ "$L1_CHAIN_ID" == "$SEPOLIA_CHAIN_ID" ]]; then
    cmd+=(--legacy)
  fi

  "${cmd[@]}" >/dev/null
}

echo "Checking dependencies..."
require_cmd cast
require_cmd forge
require_cmd aztec
require_cmd node
require_cmd curl

if ! command -v aztec-wallet >/dev/null 2>&1; then
  echo "Missing required command: aztec-wallet" >&2
  exit 1
fi

AZTEC_WALLET_CMD=(node "$(command -v aztec-wallet)" -d "$WALLET_DATA_DIR" -n "$AZTEC_NODE_URL")

echo "Checking L1 RPC..."
L1_CHAIN_ID="$(cast chain-id --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"

if [[ "$L1_CHAIN_ID" == "$LOCAL_CHAIN_ID" ]]; then
  NETWORK_NAME="local"
elif [[ "$L1_CHAIN_ID" == "$SEPOLIA_CHAIN_ID" ]]; then
  NETWORK_NAME="sepolia"
else
  echo "Unsupported chain id: ${L1_CHAIN_ID}. Supported: ${LOCAL_CHAIN_ID} (local), ${SEPOLIA_CHAIN_ID} (sepolia)." >&2
  exit 1
fi

if [[ -z "$AZTEC_NODE_URL" ]]; then
  if [[ "$NETWORK_NAME" == "local" ]]; then
    AZTEC_NODE_URL="http://127.0.0.1:8080"
  else
    AZTEC_NODE_URL="https://devnet-6.aztec-labs.com"
  fi
  AZTEC_WALLET_CMD=(node "$(command -v aztec-wallet)" -d "$WALLET_DATA_DIR" -n "$AZTEC_NODE_URL")
fi

echo "Checking Aztec node..."
if ! curl -sf "${AZTEC_NODE_URL}/status" >/dev/null 2>&1; then
  echo "Aztec node is not reachable at ${AZTEC_NODE_URL}" >&2
  exit 1
fi

if [[ -z "$DEPLOYER_PRIVATE_KEY" ]]; then
  if [[ "$NETWORK_NAME" == "local" ]]; then
    DEPLOYER_PRIVATE_KEY="$DEFAULT_ANVIL_PRIVATE_KEY"
  else
    echo "DEPLOYER_PRIVATE_KEY is required for sepolia deployment." >&2
    exit 1
  fi
fi

DEPLOYER_ADDRESS="$(cast wallet address "$DEPLOYER_PRIVATE_KEY" | tr -d '\r\n')"

if [[ -z "$RELAYER_ADDRESS" ]]; then
  RELAYER_ADDRESS="$DEPLOYER_ADDRESS"
fi

if ! is_valid_eth_address "$RELAYER_ADDRESS"; then
  echo "RELAYER_ADDRESS must be a valid 20-byte hex address." >&2
  exit 1
fi

if [[ -z "$PROTOCOL_ID" ]]; then
  PROTOCOL_ID="$(cast keccak "GENERIC_ACTION_V1" | tr -d '\r\n')"
fi

if ! is_valid_bytes32 "$PROTOCOL_ID"; then
  echo "PROTOCOL_ID must be a bytes32 hex value." >&2
  exit 1
fi

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "Building L1 and Aztec artifacts..."
  run_quiet_or_fail "L1 build" bash -lc "cd '${ROOT_DIR}/contracts/l1' && forge build"
  run_quiet_or_fail "Aztec build" bash -lc "bash '${ROOT_DIR}/scripts/compile-aztec-contract.sh' '${ROOT_DIR}/contracts/aztec'"
fi

L2_ARTIFACT_PATH="$(find "${ROOT_DIR}/contracts/aztec/target" -maxdepth 1 -type f -name '*GenericPrivacyAdapter.json' | head -n1 || true)"
if [[ -z "$L2_ARTIFACT_PATH" ]]; then
  echo "Could not find GenericPrivacyAdapter artifact in contracts/aztec/target." >&2
  echo "Run: make build-aztec" >&2
  exit 1
fi

if [[ -z "$AZTEC_ACCOUNT_ALIAS" ]]; then
  if [[ "$NETWORK_NAME" == "local" ]]; then
    AZTEC_ACCOUNT_ALIAS="test0"
  else
    AZTEC_ACCOUNT_ALIAS="deployer"
  fi
fi

echo "Preparing Aztec deployer account (${AZTEC_ACCOUNT_ALIAS})..."
if [[ "$NETWORK_NAME" == "local" ]]; then
  wallet import-test-accounts >/dev/null
  AZTEC_ADMIN_ADDRESS="$(wallet get-alias "accounts:${AZTEC_ACCOUNT_ALIAS}" | grep -Eo '0x[a-fA-F0-9]{64}' | tail -n1 || true)"
  if [[ -z "$AZTEC_ADMIN_ADDRESS" ]]; then
    echo "Could not find local Aztec account alias '${AZTEC_ACCOUNT_ALIAS}' after import-test-accounts." >&2
    exit 1
  fi
else
  if [[ -z "$SPONSORED_FPC_ADDRESS" ]]; then
    SPONSORED_FPC_ADDRESS="$(aztec get-canonical-sponsored-fpc-address | grep -Eo '0x[a-fA-F0-9]{64}' | tail -n1 || true)"
  fi
  if ! is_valid_bytes32 "$SPONSORED_FPC_ADDRESS"; then
    echo "SPONSORED_FPC_ADDRESS must be a 32-byte hex value." >&2
    exit 1
  fi
  wallet register-contract "$SPONSORED_FPC_ADDRESS" SponsoredFPC --alias sponsored-fpc --salt 0 >/dev/null || true
  AZTEC_PAYMENT_METHOD="method=fpc-sponsored,fpc=${SPONSORED_FPC_ADDRESS}"

  AZTEC_ADMIN_ADDRESS="$(wallet get-alias "accounts:${AZTEC_ACCOUNT_ALIAS}" 2>/dev/null | grep -Eo '0x[a-fA-F0-9]{64}' | tail -n1 || true)"
  if [[ -z "$AZTEC_ADMIN_ADDRESS" ]]; then
    wallet create-account --alias "$AZTEC_ACCOUNT_ALIAS" --payment "$AZTEC_PAYMENT_METHOD" >/dev/null
    AZTEC_ADMIN_ADDRESS="$(wallet get-alias "accounts:${AZTEC_ACCOUNT_ALIAS}" | grep -Eo '0x[a-fA-F0-9]{64}' | tail -n1 || true)"
  fi
fi

if ! is_valid_bytes32 "$AZTEC_ADMIN_ADDRESS"; then
  echo "Failed to resolve Aztec admin address for alias '${AZTEC_ACCOUNT_ALIAS}'." >&2
  exit 1
fi

echo "Deploying L1 GenericActionExecutor..."
EXECUTOR_ADDRESS="$(deploy_l1_contract "GenericActionExecutor.sol:GenericActionExecutor" "$DEPLOYER_ADDRESS")"

echo "Deploying L1 GenericPortal..."
PORTAL_ADDRESS="$(deploy_l1_contract "GenericPortal.sol:GenericPortal" "$PROTOCOL_ID" "$(zero_bytes32)" "$RELAYER_ADDRESS" "$EXECUTOR_ADDRESS")"

echo "Configuring executor portal binding..."
cast_send "$EXECUTOR_ADDRESS" "setPortal(address)" "$PORTAL_ADDRESS"
if [[ "${RELAYER_ADDRESS,,}" != "${DEPLOYER_ADDRESS,,}" ]]; then
  echo "Transferring executor operator to relayer..."
  cast_send "$EXECUTOR_ADDRESS" "setOperator(address)" "$RELAYER_ADDRESS"
fi

echo "Deploying L2 GenericPrivacyAdapter..."
PADDED_PORTAL_ADDRESS="$(pad_eth_address_to_field "$PORTAL_ADDRESS")"
L2_DEPLOY_CMD=(wallet deploy --from "$AZTEC_ACCOUNT_ALIAS" --alias "$AZTEC_CONTRACT_ALIAS" "$L2_ARTIFACT_PATH" --args "$AZTEC_ADMIN_ADDRESS" "$PADDED_PORTAL_ADDRESS")
if [[ -n "$AZTEC_PAYMENT_METHOD" ]]; then
  L2_DEPLOY_CMD+=(--payment "$AZTEC_PAYMENT_METHOD")
fi
set +e
L2_DEPLOY_OUTPUT="$("${L2_DEPLOY_CMD[@]}" 2>&1)"
L2_DEPLOY_STATUS=$?
set -e
printf '%s\n' "$L2_DEPLOY_OUTPUT"
if [[ "$L2_DEPLOY_STATUS" -ne 0 ]]; then
  echo "L2 deployment failed." >&2
  exit "$L2_DEPLOY_STATUS"
fi

L2_ADAPTER_ADDRESS="$(extract_l2_contract_address "$L2_DEPLOY_OUTPUT")"
if ! is_valid_bytes32 "$L2_ADAPTER_ADDRESS"; then
  echo "Failed to parse L2 GenericPrivacyAdapter address from deploy output." >&2
  exit 1
fi

echo "Configuring L1 portal L2 binding..."
cast_send "$PORTAL_ADDRESS" "setL2Contract(bytes32)" "$L2_ADAPTER_ADDRESS"

DEPLOYED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
DEPLOYMENT_FILE="${ROOT_DIR}/.deployments.${NETWORK_NAME}.json"

cat >"$DEPLOYMENT_FILE" <<EOF
{
  "l1": {
    "genericPortal": "${PORTAL_ADDRESS}",
    "genericActionExecutor": "${EXECUTOR_ADDRESS}",
    "relayer": "${RELAYER_ADDRESS}"
  },
  "l2": {
    "genericPrivacyAdapter": "${L2_ADAPTER_ADDRESS}",
    "admin": "${AZTEC_ADMIN_ADDRESS}",
    "accountAlias": "${AZTEC_ACCOUNT_ALIAS}"
  },
  "config": {
    "network": "${NETWORK_NAME}",
    "l1ChainId": ${L1_CHAIN_ID},
    "l1RpcUrl": "${L1_RPC_URL}",
    "aztecNodeUrl": "${AZTEC_NODE_URL}",
    "protocolId": "${PROTOCOL_ID}",
    "l2ContractForPortal": "${L2_ADAPTER_ADDRESS}",
    "walletDataDir": "${WALLET_DATA_DIR}",
    "deployer": "${DEPLOYER_ADDRESS}",
    "deployedAt": "${DEPLOYED_AT}"
  }
}
EOF

echo
echo "Deployment complete."
echo "L1 GenericPortal:         ${PORTAL_ADDRESS}"
echo "L1 GenericActionExecutor: ${EXECUTOR_ADDRESS}"
echo "L2 GenericPrivacyAdapter: ${L2_ADAPTER_ADDRESS}"
echo "Saved: ${DEPLOYMENT_FILE}"
echo
echo "Next step: allowlist protocol targets in executor."
echo "Example:"
echo "  cast send ${EXECUTOR_ADDRESS} \"setTargetPermission(address,bool)\" <TARGET> true --rpc-url ${L1_RPC_URL} --private-key <KEY>"
