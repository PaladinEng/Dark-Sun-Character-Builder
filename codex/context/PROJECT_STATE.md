# Project State

Last updated:
- 2026-03-08 EST

## Current Objective
- Complete the final narrow SRD Warlock pass (invocations, pact boon, and Mystic Arcanum tracking/validation) within existing engine/content-pack scope.

## Repository Snapshot
- Branch: `main`
- HEAD: `cc15116`
- Harness status for this pass:
  - `pnpm loop:check` -> `=== ALL_PASS ===`
  - `LOOPDEV_STRICT=1 pnpm loop:check` -> `=== ALL_PASS ===`

## Completed Work (Current Session)
- Added Warlock option model wiring to state/compute/validate:
  - `warlockInvocationFeatureIds`
  - `warlockPactBoonFeatureId`
  - `warlockMysticArcanumByLevel`
- Added selectable/tagged SRD warlock option features in-pack:
  - pact boons (`warlock_pact_boon`)
  - invocations (`warlock_invocation`) with prerequisite metadata support
- Added narrow Arcanum spell support for tier validation/display (levels 6-9 available on warlock list).
- Added builder UI controls for invocations, pact boon, and unlocked Arcanum selections.
- Added fixture coverage:
  - `warlock-invocations-level5`
  - `warlock-arcanum-level11`
- Added rule/content audit assertions for Warlock option validation and SRD option-entity coverage.

## Remaining Limitations (Explicit)
- Pact Magic remains represented via the shared 9-slot array model (single active pact slot level).
- Invocation and pact boon effects are modeled primarily as selectable content + validation + trait/display surfaces; deep mechanical automation remains limited to existing effect system support.
- Mystic Arcanum is modeled as tracked level-tier spell selections with validation/display, not a full standalone casting subsystem.
- Patron expanded spell breadth is bounded by the current in-pack SRD spell catalog.

## Notes for Next Runner Session
- Prefer content-first SRD additions; avoid broad spellcasting refactors.
- Keep strict harness green (`LOOPDEV_STRICT=1 pnpm loop:check`) before closeout.

## Milestone - Codex Integration Stabilization
Date: 2026-03-08

Tag: codex-integration-20260308  
Commit: d4612cf

### Major Achievements

SRD content population expanded across:

- classes
- subclasses
- spells
- feats
- equipment
- species
- spell lists
- features

Warlock class implemented with:

- pact progression
- invocation selection
- mystic arcanum scaffolding
- subclass support (Fiend, Archfey, Great Old One)

### Builder Capabilities

The builder currently supports:

- SRD character creation
- subclass selection
- warlock option tracking
- HTML sheet rendering
- printable sheet rendering
- PDF export
- JSON export

### Runtime Stability Fix

Resolved intermittent Next.js dev runtime failure.

Observed failures included:

- missing vendor chunks
- missing next-font-manifest.json
- missing pages-manifest.json
- missing app-paths-manifest.json
- missing server modules

Root cause:

Next.js dev lazily emits `.next/server` artifacts on first request.  
Previous readiness logic consumed the first-hit window and masked failures.

Fix:

- switch readiness from HTTP probe to port-listen detection
- enforce first-hit route checks
- add artifact assertions
- add runtime forensic harness

### Version Pinning

Working dependency set:

next: 15.5.12  
react: 19.2.4  
react-dom: 19.2.4  
eslint-config-next: 15.5.12

This version set must remain pinned unless a controlled upgrade experiment is performed.

### Harness Status

Current harness stages:

repo:duplicate-suffix  
content:lint  
rules:typecheck  
rules:unit  
sheet:golden  
sheet:invariants  
web:build  
web:smoke  
web:dev-smoke  
api:smoke  
pdf:sanity  
boundary:imports

All stages currently pass.
