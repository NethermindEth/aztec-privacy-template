# Next.js create-next-app Aligned Migration Plan

## Why This Revision

`create-react-app` is deprecated. This plan is now aligned to the current `create-next-app` architecture in Next.js canary (`packages/create-next-app`) instead of the old CRA `react-scripts` model.

## Reference Baseline (Next.js canary)

Primary source package:

- `packages/create-next-app/package.json`
- `packages/create-next-app/index.ts`
- `packages/create-next-app/create-app.ts`
- `packages/create-next-app/helpers/*`
- `packages/create-next-app/templates/*`

## Target Architecture (create-next-app style)

Use a single generator package with clear internal modules:

```text
packages/create-aztec-privacy-template/
  package.json
  index.ts                 # CLI entrypoint, option parsing, prompts, update notice
  create-app.ts            # main orchestration flow
  helpers/
    copy.ts
    install.ts
    get-pkg-manager.ts
    git.ts
    is-folder-empty.ts
    is-writeable.ts
    is-online.ts
    examples.ts
    validate-pkg.ts
  templates/
    index.ts               # template registry + installTemplate()
    types.ts
    base/
      ts/
      js/
    base-aave/
      ts/
      js/
    base-lido/
      ts/
      js/
    base-uniswap/
      ts/
      js/
```

Core change from prior plan: do **not** introduce a separate runtime package like `aztec-privacy-scripts` in the first migration. Keep scaffolding logic centralized in the generator package, like `create-next-app`.

## Design Principles

1. Keep generator output contract stable and explicit.
2. Prefer composable helper modules over large monolithic CLI files.
3. Template selection is typed and deterministic.
4. Support both interactive and non-interactive flows.
5. Make install and git initialization opt-controllable.
6. Keep example fetching resilient (retry + fallback).

## Behavior Model to Mirror

## 1) CLI layer (`index.ts` equivalent)

Implement:

1. Rich flags (package manager, template/example, skip-install, disable-git, yes/non-interactive).
2. Interactive prompts for missing options.
3. Saved preferences for future runs (`Conf`-style behavior).
4. Robust validation of project path and package name.
5. Graceful abort handling and clear error messages.

## 2) Orchestration layer (`create-app.ts` equivalent)

Implement:

1. Path writeability checks.
2. Empty-directory enforcement.
3. Template install path (default flow).
4. Example fetch/copy path (optional flow).
5. Dependency install unless `--skip-install`.
6. Post-install hook(s) for generated projects.
7. Optional git init + initial commit unless disabled.
8. Final “next steps” output.

## 3) Helper modules (`helpers/*` equivalent)

Implement focused helpers for:

1. package manager detection and command shape
2. dependency installation with offline/online awareness
3. file copy/rename utilities
4. folder safety checks
5. example source resolution and download
6. git initialization
7. package name validation

## 4) Template system (`templates/*` equivalent)

Implement typed template registry and installer:

1. `TemplateType` and `TemplateMode` unions.
2. `installTemplate()` that copies files and applies transforms.
3. `gitignore` -> `.gitignore` rename behavior.
4. placeholder and README transformations.
5. generated `package.json` construction at scaffold-time.

## Migration Phases

## Phase 0: Baseline and Contract Lock **COMPLETE**
 
Tasks:

1. Lock current output contract in docs.
2. Add CI matrix validating current generator outputs across package managers/examples.
3. Capture baseline fixture snapshots for generated structure.

Exit criteria:

1. Refactors can be compared against stable baseline checks.

## Phase 1: Internal Package Refactor (No Behavior Change) **COMPLETE**

Tasks:

1. Restructure `src/` into `index.ts`, `create-app.ts`, and `helpers/*`.
2. Move existing logic from `cli.ts`/`scaffold.ts` into modular helpers.
3. Keep CLI flags backward compatible (`--pm`, `--example`, `--yes`).

Exit criteria:

1. Existing commands and generated output remain unchanged.
2. New module boundaries are in place.

## Phase 2: Template Registry and Typed Installer **COMPLETE**

Tasks:

1. Replace ad hoc `scaffold + overlays` with template registry (`templates/index.ts`).
2. Convert existing scaffold and overlays into typed template variants.
3. Add deterministic template selection logic based on user flags.

Exit criteria:

1. Same output can be generated via the new template installer.
2. Template choice logic is type-safe and test-covered.

## Phase 3: Prompt and Preference Flow **COMPLETE**

Tasks:

1. Add interactive prompts for omitted settings.
2. Add `--yes` non-interactive mode using defaults/saved prefs.
3. Persist preferences for repeat scaffolding runs.

Exit criteria:

1. Local UX works both interactively and in CI.
2. Non-interactive mode is deterministic.

## Phase 4: Install, Post-Init, and Git Flow **COMPLETE**

Tasks:

1. Add package-manager-aware install flow.
2. Add `--skip-install` support.
3. Add post-install hook pipeline (Aztec-specific setup checks/generation).
4. Add git init + initial commit, with `--disable-git` escape hatch.

Exit criteria:

1. Fresh projects are runnable immediately unless install is skipped.
2. Git setup behavior matches flags exactly.

## Phase 5: Example Source Expansion and Resilience

Tasks:

1. Keep local built-in examples.
2. Add optional GitHub URL/repo path example sourcing.
3. Add retries and clear fallback when network retrieval fails.

Exit criteria:

1. Example scaffolding is robust for both local and remote sources.

## Phase 6: CI and Release Hardening

Tasks:

1. Add e2e generator job matrix (pm x template x install mode).
2. Add smoke generation tests from the published artifact.
3. Ensure release pipeline validates package build and CLI bootstrap.

Exit criteria:

1. Generator behavior is regression-protected before every release.

## Compatibility Policy

1. Keep existing flags functional during migration (`--pm`, `--example`, `--yes`).
2. Map legacy `--example` values to new template registry keys.
3. Preserve scaffolded top-level contract unless a documented breaking release is made.
4. Any breaking output change requires:
   - migration note
   - compatibility test updates
   - version bump policy compliance

## Risks and Mitigations

1. Risk: refactor introduces subtle scaffold drift.
   Mitigation: fixture snapshots + matrix baseline checks before/after.

2. Risk: template matrix complexity grows quickly.
   Mitigation: constrain variants and keep typed template registry.

3. Risk: install/git steps fail in constrained environments.
   Mitigation: explicit `--skip-install`, `--disable-git`, and actionable errors.

4. Risk: remote example fetch instability.
   Mitigation: retries and fallback to local default template.

## Initial PR Sequence

1. PR-1: Phase 0 baseline checks and contract docs.
2. PR-2: Phase 1 file/module refactor with no behavior change.
3. PR-3: Phase 2 template registry introduction.
4. PR-4: Phase 3 prompt + preference persistence.
5. PR-5: Phase 4 install/post-init/git flow.
6. PR-6: Phase 5 remote example support + fallback.
7. PR-7: Phase 6 CI/release hardening.

## Success Criteria

1. Generator internals mirror modern `create-next-app` architecture patterns.
2. End users can scaffold with one command, interactive or non-interactive.
3. Generated project contract remains stable and well-tested through migration.
