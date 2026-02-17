# Release Checklist

Use this checklist before tagging a release or publishing a fork starter branch.

## Pre-release validation

- [ ] Clean environment run (fresh clone recommended).
- [ ] `make install`
- [ ] `make fmt`
- [ ] `make lint` (including `solhint` if available)
- [ ] `make build`
- [ ] `make test-core`
- [ ] `make test`
- [ ] `make test-e2e`
- [ ] Protocol sanity checks for each `packages/protocols/<protocol>` path

## Documentation checks

- [ ] `GETTING_STARTED.md` reflects the current commands and flows.
- [ ] `ARCHITECTURE.md` reflects actual directories and build steps.
- [ ] `ADDING_NEW_PROTOCOL.md` updated for any structural changes.
- [ ] Appendix entries remain current:
  - `docs/appendix/aave-core-flow.md`
  - `docs/appendix/uniswap-core-flow.md`
  - `docs/appendix/lido-core-flow.md`
  - `docs/appendix/optional-modules.md`

## Security and config checks

- [ ] Verify `template.toml` defaults are intentional.
- [ ] Verify each protocol override follows the same keys and conventions.
- [ ] Confirm generated artifacts are regenerated from current `template.toml`.
- [ ] Confirm release notes include any breaking config changes.
