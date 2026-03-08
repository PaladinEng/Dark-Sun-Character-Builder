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
