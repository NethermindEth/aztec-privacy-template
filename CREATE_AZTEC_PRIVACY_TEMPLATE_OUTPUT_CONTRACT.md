# create-aztec-privacy-template Output Contract

## Status

- Authoritative: yes
- Scope: generated repository shape and boundaries
- Applies to: `npx create-aztec-privacy-template`

## Purpose

Define exactly what the generated repository must include by default, what is optional, and what is explicitly out of scope.

This document is the source of truth for generator output decisions. If other docs conflict with this file, this file wins.

## Base Template Requirements (default output)

The default generated project must be protocol-agnostic and minimal.

Required characteristics:

1. Privacy integration starter structure only, with clear separation between:
   - Aztec adapter contract(s)
   - L1 portal contract(s)
   - shared core primitives
2. Core Solidity primitives included in generated repo under a `packages/core/solidity`-style path.
3. One neutral, generic adapter + portal skeleton flow (no protocol-branded naming in default path).
4. Basic test and quality tooling that a new user can run immediately:
   - install command path
   - formatting/lint checks
   - core/unit checks
5. Full instructional documentation included by default:
   - comprehensive inline contract documentation (NatSpec + implementation guidance comments)
   - top-level and package-level README documentation for architecture, flow walkthroughs, and adaptation steps
   - explicit safety notes describing what is not production-ready

## Optional Output (overlays)

Protocol-specific content is optional and must not appear in default output.

Supported optional overlays are:

1. `--example aave`
2. `--example lido`
3. `--example uniswap`
4. `--example all`
5. `--example none` (default behavior)

Overlay rules:

1. Base is always applied first.
2. Selected overlays are applied second.
3. Overlay order is deterministic.
4. Overlay selection must not silently modify unrelated base files.

## Strict Non-Goals

The generator must not include the following in default output:

1. Frontend app scaffolding.
2. Relayer service stack scaffolding.
3. Production bridge claim/execution automation.
4. Full deployment orchestration for public environments.
5. Generated build artifacts, cache folders, runtime logs, or lock/temp noise.

## Documentation Contract (mandatory)

The generated template is documentation-first. The following are required in base output:

1. Inline contract docs:
   - NatSpec on contracts, public/external functions, events, and errors.
   - Short implementation guidance comments for critical privacy and cross-chain flow boundaries.
2. README docs:
   - Root README with quick start, architecture overview, and customization checklist.
   - Package-level READMEs where non-trivial logic exists.
3. Documentation quality bar:
   - New users must be able to execute local setup and identify where to customize adapter/portal logic without reading generator source code.

## Review Checklist (Phase 0 signoff)

PR reviewers should sign off all items:

- [ ] Default output is clearly protocol-agnostic.
- [ ] Optional overlays are documented and default is `none`.
- [ ] Non-goals are explicit and unambiguous.
- [ ] No requirements in this doc conflict with generator implementation docs.
