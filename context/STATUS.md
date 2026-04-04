# STATUS — Dark Sun Character Builder
Updated: 2026-04-04

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core is working with the closed-loop validation harness passing. Five confirmed UI bugs in BuilderClient.tsx have been fixed. /sheet HTML layout and printable PDF layout both need improvement.

## Last Session
Date: 2026-04-04
Done:
- Bug 1: Fixed standard array stat swap deadlock — removed per-option disabled constraint
- Bug 2: Fixed equipped item selectors to draw from inventory; added inventory item picker with search/filter
- Bug 3: Added character name input field to builder identity section
- Bug 4: Enforced point buy budget in UI controls — max attribute dynamically computed per ability
- Bug 5: Split background section into labeled sub-fields for companion and familiar (name, type, summary, notes)
- All validation harness checks pass (typecheck, unit tests, golden, invariants, web:build)

## In Progress
- /sheet HTML layout improvement (P1)
- Printable PDF layout improvement (P1)

## Blocked
- Codex prompt queue workflow blocked on Codex deprecation — needs Claude Code migration

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes, then review WORKQUEUE.md for priority work.
