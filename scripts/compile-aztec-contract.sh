#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <contract-dir>" >&2
  exit 1
fi

CONTRACT_DIR="$1"

if [ ! -d "$CONTRACT_DIR" ]; then
  echo "Contract directory not found: $CONTRACT_DIR" >&2
  exit 1
fi

compile_with_aztec() {
  local output status

  set +e
  output=$(cd "$CONTRACT_DIR" && aztec compile 2>&1)
  status=$?
  set -e

  if printf '%s\n' "$output" | rg -q "unknown command 'compile'"; then
    return 2
  fi

  if printf '%s\n' "$output" | rg -qi "permission denied while trying to connect to the docker API"; then
    return 2
  fi

  if printf '%s\n' "$output" | rg -q 'Conflict\. The container name "/aztec" is already in use'; then
    return 2
  fi

  if [ "$status" -eq 0 ] && printf '%s\n' "$output" | rg -q '^error:'; then
    printf '%s\n' "$output" >&2
    return 1
  fi

  if [ "$status" -eq 0 ]; then
    printf '%s\n' "$output"
    return 0
  fi

  printf '%s\n' "$output" >&2
  return "$status"
}

if command -v aztec >/dev/null 2>&1; then
  if compile_with_aztec; then
    exit 0
  fi

  aztec_status=$?
  if [ "$aztec_status" -ne 2 ]; then
    exit "$aztec_status"
  fi
fi

if command -v aztec-nargo >/dev/null 2>&1; then
  (cd "$CONTRACT_DIR" && aztec-nargo compile)
  exit 0
fi

if command -v nargo >/dev/null 2>&1; then
  (cd "$CONTRACT_DIR" && nargo compile)
  exit 0
fi

if command -v docker >/dev/null 2>&1; then
  IMAGE="${AZTEC_DOCKER_IMAGE:-aztecprotocol/aztec:${AZTEC_VERSION:-latest}}"
  (
    cd "$CONTRACT_DIR" && docker run --rm \
      --user "$(id -u):$(id -g)" \
      -v "$HOME:$HOME" \
      -e HOME="$HOME" \
      --workdir "$PWD" \
      --entrypoint /usr/src/noir/noir-repo/target/release/nargo \
      "$IMAGE" compile
  )
  exit 0
fi

echo "No supported Aztec Noir compiler command found." >&2
echo "Tried: aztec compile, aztec-nargo compile, nargo compile, docker nargo compile." >&2
exit 1
