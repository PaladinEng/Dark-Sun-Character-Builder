# STATUS — Dark Sun Character Builder
Updated: 2026-06-07

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core works with the closed-loop validation harness green (13/13 stages).
Both /print and /sheet have been reworked to a multi-section information
architecture. The rules engine supports multiple equipped weapons, natural weapon
attacks, half-feat ability bonuses, custom spell entry, language picker with
literacy tracking, and character save/load via JSON import/export. PDF export
has been fixed for ability score layout, skill markers, and spell slot alignment.
Starting equipment is now complete for all classes and backgrounds.

## Last Session
Date: 2026-06-07 (Cowork — per-feature notes, weapon mastery, Aasimar)
Done:
- Per-feature notes: featureNotes map on CharacterState, input fields next to each feature/feat, display on sheet/print/PDF
- Weapon Mastery gating: grant_weapon_mastery effect type, weaponMasteryChoices on CharacterState, weaponMasteryLimit on DerivedState
- Weapon Mastery features: 4 feature JSONs (base 2-count, fighter 3/4/5-count) wired into all 5 martial classes
- Weapon Mastery picker UI in builder with limit enforcement
- Aasimar species added to SRD pack (auto-excluded from Dark Sun via speciesReplacementIds allowlist)
- Golden fixtures updated with weaponMasteryLimit field

## In Progress
_None._

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes. Priority items from WORKQUEUE:
- P2: localStorage auto-save, missing Dark Sun spells, missing SRD subclasses
- P2: Builder shortcut to /sheet, expanded SRD coverage, feat mechanical effects
- P3: Defiler/Psionicist/Bard stubs, content pack generalization
