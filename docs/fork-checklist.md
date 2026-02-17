# Fork Checklist

Use this checklist when creating a fork from this template.

## Immediate setup

- [ ] Clone repository and create team branch.
- [ ] Update `template.toml` to fork defaults.
- [ ] Regenerate artifacts:

  ```bash
  make clean
  make build
  ```

- [ ] Update `packages/protocols/<protocol>/config.toml` for fork-specific constraints.
- [ ] Update deployment endpoints / RPC values in core environment wrappers as needed.

## Protocol selection

- [ ] Confirm which core flows are required for release.
- [ ] Confirm optional modules should stay disabled initially.
- [ ] Add/adjust protocol-specific addresses in protocol config files.
- [ ] Add local/private fork names to metadata in protocol configs.

## Integration checks

- [ ] Run `make check`.
- [ ] Run `make test`.
- [ ] Run `make test-e2e`.
- [ ] Validate `tests/e2e` spec adapters still pass in both lifecycle modes.

## Documentation

- [ ] Update core docs and appendix links where behavior changed:
  - `GETTING_STARTED.md`
  - `ARCHITECTURE.md`
  - `ADDING_NEW_PROTOCOL.md`
- [ ] Add protocol or deployment notes to the relevant appendix file.
- [ ] Update release plan and governance process for any operational changes.
