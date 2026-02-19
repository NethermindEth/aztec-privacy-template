#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_FILE="${1:-${ROOT_DIR}/.deployments.local.json}"

LOCAL_CHAIN_ID=31337
DEFAULT_ANVIL_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

INTEGRATION_AMOUNT_WEI="${INTEGRATION_AMOUNT_WEI:-1000000000000000}"
FAILURE_TIMEOUT_BLOCKS="${FAILURE_TIMEOUT_BLOCKS:-1}"
FAILURE_TARGET="${FAILURE_TARGET:-0x000000000000000000000000000000000000dEaD}"

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

is_valid_eth_address() {
  [[ "$1" =~ ^0x[a-fA-F0-9]{40}$ ]]
}

is_valid_private_key() {
  [[ "$1" =~ ^0x[a-fA-F0-9]{64}$ ]]
}

norm_hex() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

assert_equal() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "Mismatch for ${label}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    exit 1
  fi
}

assert_true() {
  local value="$1"
  local label="$2"
  if [[ "$value" != "true" ]]; then
    echo "Expected true for ${label}, got: ${value}" >&2
    exit 1
  fi
}

cast_call_trimmed() {
  cast call "$@" --rpc-url "$L1_RPC_URL" | tr -d '\r\n'
}

cast_send_logged() {
  local label="$1"
  local key="$2"
  local to="$3"
  local signature="$4"
  shift 4

  local output
  local status
  set +e
  output="$(cast send "$to" "$signature" "$@" --rpc-url "$L1_RPC_URL" --private-key "$key" 2>&1)"
  status=$?
  set -e

  if [[ "$status" -ne 0 ]]; then
    echo "Transaction failed: ${label}" >&2
    printf '%s\n' "$output" >&2
    exit "$status"
  fi

  local tx_hash
  local gas_used
  local block_number
  tx_hash="$(printf '%s\n' "$output" | awk '$1=="transactionHash"{print $2}' | tail -n1)"
  gas_used="$(printf '%s\n' "$output" | awk '$1=="gasUsed"{print $2}' | tail -n1)"
  block_number="$(printf '%s\n' "$output" | awk '$1=="blockNumber"{print $2}' | tail -n1)"

  log "tx ok: ${label}"
  if [[ -n "$tx_hash" ]]; then
    log "  tx hash: ${tx_hash}"
  fi
  if [[ -n "$block_number" ]]; then
    log "  block:   ${block_number}"
  fi
  if [[ -n "$gas_used" ]]; then
    log "  gas:     ${gas_used}"
  fi
}

resolve_key_for_address() {
  local target_address
  target_address="$(norm_hex "$1")"
  local key
  for key in "${KEY_CANDIDATES[@]}"; do
    local candidate_address
    candidate_address="$(cast wallet address "$key" | tr -d '\r\n')"
    if [[ "$(norm_hex "$candidate_address")" == "$target_address" ]]; then
      printf '%s\n' "$key"
      return 0
    fi
  done
  return 1
}

extract_escape_field() {
  local escape_line="$1"
  local field="$2"
  local compact
  compact="$(printf '%s' "$escape_line" | tr -d ' ')"

  case "$field" in
    depositor)
      printf '%s\n' "$compact" | sed -E 's/^\((0x[a-fA-F0-9]{40}),.*/\1/'
      ;;
    amount)
      printf '%s\n' "$compact" | sed -E 's/^\([^,]+,[^,]+,([0-9]+).*/\1/'
      ;;
    claimed)
      printf '%s\n' "$compact" | sed -E 's/.*,(true|false)\)$/\1/'
      ;;
    *)
      echo "Unsupported escape field: ${field}" >&2
      exit 1
      ;;
  esac
}

require_cmd node
require_cmd cast

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
  L1_CHAIN_ID: String(d.config?.l1ChainId ?? ''),
  L1_PORTAL: d.l1?.genericPortal || '',
  L1_EXECUTOR: d.l1?.genericActionExecutor || d.l1?.executorStub || '',
  L1_RELAYER: d.l1?.relayer || '',
};
for (const [k, v] of Object.entries(out)) {
  console.log(`${k}=${JSON.stringify(v)}`);
}
NODE
)"

assert_nonempty "$L1_RPC_URL" "config.l1RpcUrl"
assert_nonempty "$L1_CHAIN_ID" "config.l1ChainId"
assert_nonempty "$L1_PORTAL" "l1.genericPortal"
assert_nonempty "$L1_EXECUTOR" "l1.genericActionExecutor"
assert_nonempty "$L1_RELAYER" "l1.relayer"

if ! is_valid_eth_address "$L1_PORTAL"; then
  echo "Invalid portal address in deployment file: ${L1_PORTAL}" >&2
  exit 1
fi

if ! is_valid_eth_address "$L1_EXECUTOR"; then
  echo "Invalid executor address in deployment file: ${L1_EXECUTOR}" >&2
  exit 1
fi

if ! is_valid_eth_address "$L1_RELAYER"; then
  echo "Invalid relayer address in deployment file: ${L1_RELAYER}" >&2
  exit 1
fi

if ! [[ "$INTEGRATION_AMOUNT_WEI" =~ ^[0-9]+$ ]] || [[ "$INTEGRATION_AMOUNT_WEI" == "0" ]]; then
  echo "INTEGRATION_AMOUNT_WEI must be a non-zero integer amount in wei." >&2
  exit 1
fi

if ! [[ "$FAILURE_TIMEOUT_BLOCKS" =~ ^[0-9]+$ ]] || [[ "$FAILURE_TIMEOUT_BLOCKS" == "0" ]]; then
  echo "FAILURE_TIMEOUT_BLOCKS must be a non-zero integer." >&2
  exit 1
fi

if ! is_valid_eth_address "$FAILURE_TARGET"; then
  echo "FAILURE_TARGET must be a valid 20-byte hex address." >&2
  exit 1
fi

section "Deployment Inputs"
log "deployment file:       ${DEPLOYMENT_FILE}"
log "l1 rpc:                ${L1_RPC_URL}"
log "l1 chain id:           ${L1_CHAIN_ID}"
log "l1 portal:             ${L1_PORTAL}"
log "l1 executor:           ${L1_EXECUTOR}"
log "manifest relayer:      ${L1_RELAYER}"
log "integration amount:    ${INTEGRATION_AMOUNT_WEI}"
log "failure timeout blocks:${FAILURE_TIMEOUT_BLOCKS}"
log "failure target:        ${FAILURE_TARGET}"

section "Signer Resolution"
KEY_CANDIDATES=()
for maybe_key in "${OPERATOR_PRIVATE_KEY:-}" "${RELAYER_PRIVATE_KEY:-}" "${DEPLOYER_PRIVATE_KEY:-}"; do
  if [[ -n "$maybe_key" ]]; then
    if ! is_valid_private_key "$maybe_key"; then
      echo "Invalid private key format: ${maybe_key}" >&2
      exit 1
    fi
    KEY_CANDIDATES+=("$(norm_hex "$maybe_key")")
  fi
done

if [[ "$L1_CHAIN_ID" == "$LOCAL_CHAIN_ID" ]]; then
  KEY_CANDIDATES+=("$DEFAULT_ANVIL_PRIVATE_KEY")
fi

if [[ "${#KEY_CANDIDATES[@]}" -eq 0 ]]; then
  echo "No private keys available for integration test execution." >&2
  echo "Set RELAYER_PRIVATE_KEY and OPERATOR_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY)." >&2
  exit 1
fi

declare -A SEEN_KEYS
UNIQUE_KEYS=()
for key in "${KEY_CANDIDATES[@]}"; do
  if [[ -z "${SEEN_KEYS[$key]+x}" ]]; then
    SEEN_KEYS[$key]=1
    UNIQUE_KEYS+=("$key")
  fi
done
KEY_CANDIDATES=("${UNIQUE_KEYS[@]}")
log "key candidates: ${#KEY_CANDIDATES[@]}"

EXECUTOR_OPERATOR="$(cast_call_trimmed "$L1_EXECUTOR" "operator()(address)")"
if ! is_valid_eth_address "$EXECUTOR_OPERATOR"; then
  echo "Failed to resolve executor operator address." >&2
  exit 1
fi
log "executor operator: ${EXECUTOR_OPERATOR}"

if ! RELAYER_PRIVATE_KEY_RESOLVED="$(resolve_key_for_address "$L1_RELAYER")"; then
  echo "No private key available for relayer ${L1_RELAYER}." >&2
  echo "Provide RELAYER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY if they are the same)." >&2
  exit 1
fi

if ! OPERATOR_PRIVATE_KEY_RESOLVED="$(resolve_key_for_address "$EXECUTOR_OPERATOR")"; then
  echo "No private key available for executor operator ${EXECUTOR_OPERATOR}." >&2
  echo "Provide OPERATOR_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY if they are the same)." >&2
  exit 1
fi

RELAYER_SIGNER_ADDRESS="$(cast wallet address "$RELAYER_PRIVATE_KEY_RESOLVED" | tr -d '\r\n')"
OPERATOR_SIGNER_ADDRESS="$(cast wallet address "$OPERATOR_PRIVATE_KEY_RESOLVED" | tr -d '\r\n')"
log "relayer signer:  ${RELAYER_SIGNER_ADDRESS}"
log "operator signer: ${OPERATOR_SIGNER_ADDRESS}"

section "Success Path"
SUCCESS_CONTENT="$(cast keccak "integration-success-$(date +%s%N)" | tr -d '\r\n')"
SUCCESS_CALLDATA="$(cast calldata "messageNonce()" | tr -d '\r\n')"
SUCCESS_ACTION_DATA="$(cast abi-encode "x(address,uint256,bytes)" "$L1_PORTAL" 0 "$SUCCESS_CALLDATA" | tr -d '\r\n')"
SUCCESS_ACTION_HASH="$(cast keccak "$SUCCESS_ACTION_DATA" | tr -d '\r\n')"
log "content hash: ${SUCCESS_CONTENT}"
log "action hash:  ${SUCCESS_ACTION_HASH}"

NONCE_BEFORE_SUCCESS="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
log "nonce before request: ${NONCE_BEFORE_SUCCESS}"
cast_send_logged "requestAction (success flow)" "$RELAYER_PRIVATE_KEY_RESOLVED" \
  "$L1_PORTAL" "requestAction(bytes32,uint256,bytes32)" "$SUCCESS_CONTENT" "$INTEGRATION_AMOUNT_WEI" "$SUCCESS_ACTION_HASH"
NONCE_AFTER_SUCCESS_REQUEST="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
log "nonce after request:  ${NONCE_AFTER_SUCCESS_REQUEST}"

EXPECTED_SUCCESS_REQUEST_NONCE=$((NONCE_BEFORE_SUCCESS + 1))
assert_equal "$NONCE_AFTER_SUCCESS_REQUEST" "$EXPECTED_SUCCESS_REQUEST_NONCE" "success request nonce increment"

SUCCESS_REQUEST_HASH="$(
  cast_call_trimmed "$L1_PORTAL" "messageHashFor(bytes32,address,uint64)(bytes32)" \
    "$SUCCESS_CONTENT" "$L1_RELAYER" "$NONCE_AFTER_SUCCESS_REQUEST"
)"
log "request message hash: ${SUCCESS_REQUEST_HASH}"

cast_send_logged "setTargetPermission(portal,true)" "$OPERATOR_PRIVATE_KEY_RESOLVED" \
  "$L1_EXECUTOR" "setTargetPermission(address,bool)" "$L1_PORTAL" true

cast_send_logged "executeAction (success flow)" "$RELAYER_PRIVATE_KEY_RESOLVED" \
  "$L1_PORTAL" "executeAction(bytes32,address,uint256,bytes,uint64,uint64)" \
  "$SUCCESS_CONTENT" "$L1_RELAYER" "$INTEGRATION_AMOUNT_WEI" "$SUCCESS_ACTION_DATA" "$NONCE_AFTER_SUCCESS_REQUEST" 0

NONCE_AFTER_SUCCESS_EXECUTE="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
EXPECTED_SUCCESS_COMPLETION_NONCE=$((NONCE_AFTER_SUCCESS_REQUEST + 1))
assert_equal "$NONCE_AFTER_SUCCESS_EXECUTE" "$EXPECTED_SUCCESS_COMPLETION_NONCE" "success completion nonce increment"
log "nonce after execute:  ${NONCE_AFTER_SUCCESS_EXECUTE}"

SUCCESS_COMPLETION_HASH="$(
  cast_call_trimmed "$L1_PORTAL" "messageHashFor(bytes32,address,uint64)(bytes32)" \
    "$SUCCESS_CONTENT" "$L1_RELAYER" "$NONCE_AFTER_SUCCESS_EXECUTE"
)"
log "completion msg hash:  ${SUCCESS_COMPLETION_HASH}"

SUCCESS_REQUEST_CONSUMED="$(cast_call_trimmed "$L1_PORTAL" "hasMessageBeenConsumed(bytes32)(bool)" "$SUCCESS_REQUEST_HASH")"
SUCCESS_COMPLETION_ISSUED="$(
  cast_call_trimmed "$L1_PORTAL" "hasMessageBeenIssued(bytes32)(bool)" "$SUCCESS_COMPLETION_HASH"
)"
assert_true "$SUCCESS_REQUEST_CONSUMED" "success request consumed"
assert_true "$SUCCESS_COMPLETION_ISSUED" "success completion issued"
log "success checks: consumed=${SUCCESS_REQUEST_CONSUMED}, completionIssued=${SUCCESS_COMPLETION_ISSUED}"

section "Failure Path"
FAILURE_CONTENT="$(cast keccak "integration-failure-$(date +%s%N)" | tr -d '\r\n')"
FAILURE_ACTION_DATA="$(cast abi-encode "x(address,uint256,bytes)" "$FAILURE_TARGET" 0 0x12345678 | tr -d '\r\n')"
FAILURE_ACTION_HASH="$(cast keccak "$FAILURE_ACTION_DATA" | tr -d '\r\n')"
log "content hash: ${FAILURE_CONTENT}"
log "action hash:  ${FAILURE_ACTION_HASH}"

NONCE_BEFORE_FAILURE="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
log "nonce before request: ${NONCE_BEFORE_FAILURE}"
cast_send_logged "requestAction (failure flow)" "$RELAYER_PRIVATE_KEY_RESOLVED" \
  "$L1_PORTAL" "requestAction(bytes32,uint256,bytes32)" "$FAILURE_CONTENT" "$INTEGRATION_AMOUNT_WEI" "$FAILURE_ACTION_HASH"
NONCE_AFTER_FAILURE_REQUEST="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
log "nonce after request:  ${NONCE_AFTER_FAILURE_REQUEST}"

EXPECTED_FAILURE_REQUEST_NONCE=$((NONCE_BEFORE_FAILURE + 1))
assert_equal "$NONCE_AFTER_FAILURE_REQUEST" "$EXPECTED_FAILURE_REQUEST_NONCE" "failure request nonce increment"

FAILURE_REQUEST_HASH="$(
  cast_call_trimmed "$L1_PORTAL" "messageHashFor(bytes32,address,uint64)(bytes32)" \
    "$FAILURE_CONTENT" "$L1_RELAYER" "$NONCE_AFTER_FAILURE_REQUEST"
)"
log "request message hash: ${FAILURE_REQUEST_HASH}"

cast_send_logged "executeAction (failure flow)" "$RELAYER_PRIVATE_KEY_RESOLVED" \
  "$L1_PORTAL" "executeAction(bytes32,address,uint256,bytes,uint64,uint64)" \
  "$FAILURE_CONTENT" "$L1_RELAYER" "$INTEGRATION_AMOUNT_WEI" "$FAILURE_ACTION_DATA" "$NONCE_AFTER_FAILURE_REQUEST" \
  "$FAILURE_TIMEOUT_BLOCKS"

NONCE_AFTER_FAILURE_EXECUTE="$(cast_call_trimmed "$L1_PORTAL" "messageNonce()(uint64)")"
assert_equal "$NONCE_AFTER_FAILURE_EXECUTE" "$NONCE_AFTER_FAILURE_REQUEST" "failure path nonce unchanged after execute"
log "nonce after execute:  ${NONCE_AFTER_FAILURE_EXECUTE} (no completion message expected)"

FAILURE_REQUEST_CONSUMED="$(cast_call_trimmed "$L1_PORTAL" "hasMessageBeenConsumed(bytes32)(bool)" "$FAILURE_REQUEST_HASH")"
assert_true "$FAILURE_REQUEST_CONSUMED" "failure request consumed"
log "failure checks: consumed=${FAILURE_REQUEST_CONSUMED}"

ESCAPE_REQUEST_RAW="$(
  cast_call_trimmed "$L1_PORTAL" "getEscapeRequest(bytes32)((address,address,uint256,uint64,uint64,bool))" \
    "$FAILURE_REQUEST_HASH"
)"
ESCAPE_DEPOSITOR="$(extract_escape_field "$ESCAPE_REQUEST_RAW" depositor)"
ESCAPE_AMOUNT="$(extract_escape_field "$ESCAPE_REQUEST_RAW" amount)"
ESCAPE_CLAIMED="$(extract_escape_field "$ESCAPE_REQUEST_RAW" claimed)"
log "escape request: depositor=${ESCAPE_DEPOSITOR}, amount=${ESCAPE_AMOUNT}, claimed=${ESCAPE_CLAIMED}"

if [[ "$(norm_hex "$ESCAPE_DEPOSITOR")" != "$(norm_hex "$L1_RELAYER")" ]]; then
  echo "Escape depositor mismatch." >&2
  echo "  expected: $L1_RELAYER" >&2
  echo "  actual:   $ESCAPE_DEPOSITOR" >&2
  exit 1
fi
assert_equal "$ESCAPE_AMOUNT" "$INTEGRATION_AMOUNT_WEI" "escape amount"
assert_equal "$ESCAPE_CLAIMED" "false" "escape claimed status"

echo
log "Deployment integration tests passed."
