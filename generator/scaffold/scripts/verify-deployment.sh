#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="${1:-${ROOT_DIR}/.deployments.local.json}"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

section() {
  echo
  log "=== $* ==="
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

assert_nonempty() {
  local value="$1"
  local name="$2"
  if [[ -z "$value" ]]; then
    echo "Missing required value: ${name}" >&2
    exit 1
  fi
}

norm_hex() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

assert_equal_hex() {
  local actual
  actual="$(norm_hex "$1")"
  local expected
  expected="$(norm_hex "$2")"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "Mismatch for ${label}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    exit 1
  fi
}

require_cmd node
require_cmd cast
require_cmd aztec

if ! command -v aztec-wallet >/dev/null 2>&1; then
  echo "Missing required command: aztec-wallet" >&2
  exit 1
fi

if [[ ! -f "$DEPLOYMENT_FILE" ]]; then
  echo "Deployment file not found: $DEPLOYMENT_FILE" >&2
  echo "Run: bash scripts/deploy.sh" >&2
  exit 1
fi

eval "$(
  node - "$DEPLOYMENT_FILE" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
const d = JSON.parse(fs.readFileSync(file, 'utf8'));
const out = {
  L1_RPC_URL: d.config?.l1RpcUrl || '',
  AZTEC_NODE_URL: d.config?.aztecNodeUrl || '',
  WALLET_DATA_DIR: d.config?.walletDataDir || '',
  L1_CHAIN_ID: String(d.config?.l1ChainId ?? ''),
  PROTOCOL_ID: d.config?.protocolId || '',
  L1_PORTAL: d.l1?.genericPortal || '',
  L1_EXECUTOR: d.l1?.genericActionExecutor || d.l1?.executorStub || '',
  L1_RELAYER: d.l1?.relayer || '',
  L2_ADAPTER: d.l2?.genericPrivacyAdapter || '',
  AZTEC_ACCOUNT_ALIAS: d.l2?.accountAlias || '',
};
for (const [k, v] of Object.entries(out)) {
  console.log(`${k}=${JSON.stringify(v)}`);
}
NODE
)"

assert_nonempty "$L1_RPC_URL" "config.l1RpcUrl"
assert_nonempty "$AZTEC_NODE_URL" "config.aztecNodeUrl"
assert_nonempty "$WALLET_DATA_DIR" "config.walletDataDir"
assert_nonempty "$PROTOCOL_ID" "config.protocolId"
assert_nonempty "$L1_PORTAL" "l1.genericPortal"
assert_nonempty "$L1_EXECUTOR" "l1.genericActionExecutor"
assert_nonempty "$L1_RELAYER" "l1.relayer"
assert_nonempty "$L2_ADAPTER" "l2.genericPrivacyAdapter"
assert_nonempty "$AZTEC_ACCOUNT_ALIAS" "l2.accountAlias"

section "Deployment Inputs"
log "deployment file: ${DEPLOYMENT_FILE}"
log "l1 rpc:          ${L1_RPC_URL}"
log "aztec node:      ${AZTEC_NODE_URL}"
log "wallet data dir: ${WALLET_DATA_DIR}"
log "l1 chain id:     ${L1_CHAIN_ID}"
log "l1 portal:       ${L1_PORTAL}"
log "l1 executor:     ${L1_EXECUTOR}"
log "l1 relayer:      ${L1_RELAYER}"
log "l2 adapter:      ${L2_ADAPTER}"
log "aztec account:   ${AZTEC_ACCOUNT_ALIAS}"

section "RPC Reachability"
ACTUAL_CHAIN_ID="$(cast chain-id --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
curl -sf "${AZTEC_NODE_URL}/status" >/dev/null
log "l1 rpc reachable (chain id ${ACTUAL_CHAIN_ID})"
log "aztec node reachable"

section "L1 Bytecode Presence"
PORTAL_CODE="$(cast code "$L1_PORTAL" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
EXECUTOR_CODE="$(cast code "$L1_EXECUTOR" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"

if [[ "$PORTAL_CODE" == "0x" || "$EXECUTOR_CODE" == "0x" ]]; then
  echo "One or more L1 addresses have no deployed bytecode." >&2
  exit 1
fi

PORTAL_CODE_SIZE=$(( (${#PORTAL_CODE} - 2) / 2 ))
EXECUTOR_CODE_SIZE=$(( (${#EXECUTOR_CODE} - 2) / 2 ))
log "portal bytecode size:   ${PORTAL_CODE_SIZE} bytes"
log "executor bytecode size: ${EXECUTOR_CODE_SIZE} bytes"

section "L1 Invariant Checks"
PORTAL_PROTOCOL_ID="$(cast call "$L1_PORTAL" "PROTOCOL_ID()(bytes32)" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
PORTAL_L2_CONTRACT="$(cast call "$L1_PORTAL" "L2_CONTRACT()(bytes32)" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
PORTAL_RELAYER="$(cast call "$L1_PORTAL" "RELAYER()(address)" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
PORTAL_EXECUTOR="$(cast call "$L1_PORTAL" "EXECUTOR()(address)" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"
EXECUTOR_PORTAL="$(cast call "$L1_EXECUTOR" "portal()(address)" --rpc-url "$L1_RPC_URL" | tr -d '\r\n')"

assert_equal_hex "$PORTAL_PROTOCOL_ID" "$PROTOCOL_ID" "portal.PROTOCOL_ID"
assert_equal_hex "$PORTAL_L2_CONTRACT" "$L2_ADAPTER" "portal.L2_CONTRACT"
assert_equal_hex "$PORTAL_RELAYER" "$L1_RELAYER" "portal.RELAYER"
assert_equal_hex "$PORTAL_EXECUTOR" "$L1_EXECUTOR" "portal.EXECUTOR"
assert_equal_hex "$EXECUTOR_PORTAL" "$L1_PORTAL" "executor.portal"
log "portal.PROTOCOL_ID matches config"
log "portal.L2_CONTRACT matches deployed adapter"
log "portal.RELAYER matches manifest"
log "portal.EXECUTOR matches manifest"
log "executor.portal matches portal address"

section "L2 Callability Check"
L2_ARTIFACT_PATH="${ROOT_DIR}/contracts/aztec/target/generic_privacy_adapter-GenericPrivacyAdapter.json"
if [[ ! -f "$L2_ARTIFACT_PATH" ]]; then
  log "L2 artifact missing, compiling: ${L2_ARTIFACT_PATH}"
  bash "${ROOT_DIR}/scripts/compile-aztec-contract.sh" "${ROOT_DIR}/contracts/aztec" >/dev/null
fi

AZTEC_WALLET_CMD=(node "$(command -v aztec-wallet)" -d "$WALLET_DATA_DIR" -n "$AZTEC_NODE_URL")
if [[ "$L1_CHAIN_ID" == "31337" ]]; then
  log "local chain detected; importing test accounts"
  "${AZTEC_WALLET_CMD[@]}" import-test-accounts >/dev/null
fi

if ! "${AZTEC_WALLET_CMD[@]}" get-alias "accounts:${AZTEC_ACCOUNT_ALIAS}" >/dev/null 2>&1; then
  echo "Aztec account alias not found in wallet data: ${AZTEC_ACCOUNT_ALIAS}" >&2
  exit 1
fi

set +e
SIM_OUTPUT="$("${AZTEC_WALLET_CMD[@]}" simulate is_pending \
  --from "$AZTEC_ACCOUNT_ALIAS" \
  --contract-address "$L2_ADAPTER" \
  --contract-artifact "$L2_ARTIFACT_PATH" \
  --args 0 2>&1)"
SIM_STATUS=$?
set -e

if [[ "$SIM_STATUS" -ne 0 ]]; then
  echo "L2 simulation failed." >&2
  printf '%s\n' "$SIM_OUTPUT" >&2
  exit "$SIM_STATUS"
fi

if ! printf '%s\n' "$SIM_OUTPUT" | grep -q "Simulation result"; then
  echo "L2 simulation completed but did not return a result line." >&2
  printf '%s\n' "$SIM_OUTPUT" >&2
  exit 1
fi

SIM_RESULT_LINE="$(printf '%s\n' "$SIM_OUTPUT" | grep "Simulation result" | tail -n1)"
log "simulation ok: ${SIM_RESULT_LINE}"

echo
log "Deployment verification passed."
