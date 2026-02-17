# Implementation Plan

> Scope: Execute `SIMPLIFIED_SPEC.md` in strict, dependency-ordered phases.

## Quality Rules (Effective From Day 1)

These rules are mandatory before feature work starts.

1. Formatting and linting are blocking checks in local and CI.
2. `biome` is the single formatter/linter for TypeScript/JavaScript/JSON/Markdown.
3. `solhint` is mandatory for all Solidity files.
4. No direct commits to main without passing `make check`.
5. Every feature PR must include tests and updated docs when behavior changes.
6. No skipped tests or lint suppressions without a tracked justification comment.
7. Generated files must be reproducible via make targets (never edited manually).

## Root Makefile Contract

A root `Makefile` is required and becomes the single orchestration entrypoint.

Minimum required targets:

- `make help` - list available commands
- `make install` - install workspace dependencies and toolchain checks
- `make fmt` - format all supported files via biome
- `make lint` - run biome lint + solhint
- `make test` - run all tests (TS, Solidity, Noir)
- `make test-unit` - fast unit tests only
- `make test-e2e` - E2E harness/specs
- `make build` - build/generated artifacts (including privacy flags)
- `make clean` - clean build/test artifacts
- `make check` - `fmt-check + lint + test-unit` (mandatory pre-commit gate)

Recommended expansion targets:

- `make dev-sandbox-up` / `make dev-sandbox-down`
- `make protocol-aave`
- `make protocol-uniswap`
- `make protocol-lido`

## Phase 0: Foundation and Guardrails **COMPLETE**

Goal: establish enforceable quality and repeatable execution.

1. Create workspace structure per `SIMPLIFIED_SPEC.md` (`packages/core`, `packages/protocols/*`, `tests/e2e`, `docs`).
2. Add root `Makefile` with required targets and placeholder commands where needed.
3. Add `biome` config and baseline ignore rules.
4. Add `solhint` config and Solidity style/security rules.
5. Add CI pipeline that runs `make check` on every PR.
6. Add contribution rules (`CONTRIBUTING.md`) documenting mandatory local flow:
   - `make install`
   - `make check`
   - `make test`

Exit criteria:

- `make help`, `make check`, and `make test` run successfully.
- CI fails if biome/solhint/tests fail.

## Phase 1: Core Infrastructure

**COMPLETE**

Goal: deliver reusable building blocks all protocols depend on.

Solidity v0.8.33

1. Implement `packages/core/solidity/BasePortal.sol`.
2. Implement `packages/core/solidity/EscapeHatch.sol`.
3. Implement `packages/core/noir` shared libraries:
   - notes
   - authwit helpers
   - messaging helpers
4. Implement `packages/core/ts`:
   - `env.ts`
   - `wallet.ts`
   - `aztec.ts` (thin wrappers only)
   - `message-utils.ts`
5. Add unit tests for all core modules (Solidity, Noir, TS).
6. Add make aliases for core-only checks (`make test-core`, `make lint-core`).

Exit criteria:

- Core contracts/libraries tested and lint-clean.
- No protocol-specific code required to validate core behavior.

## Phase 2: Config and Build Pipeline **COMPLETE**

Goal: make config the single source of truth and generate artifacts reproducibly.

1. Define root config schema (`template.toml`) and validation rules.
2. Add per-protocol override structure (`packages/protocols/*/config.toml`).
3. Implement generator pipeline:
   - merged config -> `privacy_flags.nr`
   - merged config -> `protocol_constants.ts`
   - optional `PortalConstants.sol`
4. Add `make build` and protocol-scoped build commands.
5. Add tests for config parsing, merge precedence, and generator output stability.

Exit criteria:

- Single command builds generated artifacts deterministically.
- Generated files are consistent and not hand-edited.

## Phase 3: Aave Core Flow (Reference 1)

Goal: first complete end-to-end reference (deposit/withdraw only).

1. Implement Aave Noir core module (`deposit`, `withdraw`).
2. Implement `AavePortal.sol` as single portal-per-protocol contract.
3. Implement Aave TS client calls for core flow.
4. Add unit/integration tests for Aave flow.
5. Add Aave spec adapter for shared E2E interface (`deploy/shield/act/unshield/assert`).
6. Add protocol docs section for Aave core flow.

Exit criteria:

- Aave core path passes unit, integration, and E2E in harness.

## Phase 4: Uniswap Core Flow (Reference 2)

Goal: validate architecture on DEX behavior (swap only).

1. Implement Uniswap Noir core module (`swap`).
2. Implement `UniswapPortal.sol` with same core contract patterns.
3. Implement Uniswap TS client for core flow.
4. Add tests and E2E spec using existing harness interface.
5. Update docs for protocol-specific caveats (slippage, execution constraints).

Exit criteria:

- Uniswap core path fully green without changing core abstractions.

## Phase 5: Lido Core Flow (Reference 3)

Goal: validate architecture on staking/yield domain (stake/unstake only).

1. Implement Lido Noir core module (`stake`, `unstake`).
2. Implement `LidoPortal.sol`.
3. Implement Lido TS client for core flow.
4. Add tests and E2E spec via shared harness.
5. Document Lido core flow limitations and assumptions.

Exit criteria:

- Lido core path fully green in same orchestration flow.

## Phase 6: Unified E2E Harness and Modes

Goal: make one reusable E2E system and execution-mode parity.

1. Finalize `tests/e2e/harness.ts` lifecycle (sandbox/fork startup once).
2. Standardize spec interface across all protocols.
3. Add relayer mode integration using minimal stateless runner.
4. Add self-execution mode coverage.
5. Add failure-path tests for escape hatch timeout behavior.

Exit criteria:

- `make test-e2e` runs all protocol specs through one harness.
- Both relayer and self-execution modes verified.

## Phase 7: Optional Modules

Goal: expand capabilities without increasing onboarding complexity.

1. Add optional modules under `noir/src/modules/*`:
   - Aave borrow/repay
   - Uniswap LP operations
   - Lido yield/queue extensions
2. Gate optional modules with feature flags/config.
3. Keep core flows default in docs, examples, and quickstart.
4. Add targeted tests for each optional module.

Exit criteria:

- Optional features are additive and do not break core path.

## Phase 8: Documentation and Release Hardening

Goal: make template fork-ready and operationally clear.

1. Finalize core docs:
   - `GETTING_STARTED.md`
   - `ARCHITECTURE.md`
   - `ADDING_NEW_PROTOCOL.md`
   - `SECURITY.md`
   - `PRIVACY.md`
2. Move deep references to `docs/appendix/*`.
3. Add release checklist and fork checklist.
4. Run full validation:
   - clean install
   - build all
   - lint all
   - test all
   - E2E all

Exit criteria:

- New team can fork and run first core flow quickly using only core docs.

## Dependency Rules Between Phases

1. No protocol implementation starts before Phases 0-2 are complete.
2. Uniswap and Lido must reuse interfaces proven by Aave (no parallel abstractions).
3. Optional modules cannot block core flow delivery.
4. Docs are updated in the same phase as behavior changes.
5. CI gates stay strict throughout; no temporary downgrade of lint/test blocking.

## Definition of Done (Project)

1. All three reference protocols pass core flow E2E in one harness.
2. `make check` and `make test` pass on clean clone.
3. Strict lint/format rules enforced by CI (`biome`, `solhint`).
4. Root `Makefile` is the documented entrypoint for common operations.
5. Core docs are sufficient for fork, configure, build, test, and extend workflows.
