# STATUS — Dark Sun Character Builder
Updated: 2026-06-06

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
Date: 2026-06-06 (Cowork — PDF fixes, starting equipment, class resources)
Done:
- PDF ability score field no longer overlaps modifier text
- Proficient skill markers use ASCII `*` instead of mojibaked Unicode bullet
- Spell slots level 9 note text repositioned to avoid overlap
- LEVEL/TOTAL/EXPENDED header row aligned to correct table row
- Starting equipment completed for all 13 classes (backpack, bedroll, waterskin + class gear)
- 9 Dark Sun backgrounds gained startingEquipment
- 6 sparse backgrounds expanded
- Class resources system: ClassResourceDefinitionSchema with 5 calculation modes, 9 classes populated, display on sheet/print/PDF

## In Progress
_None._

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes. Priority items from WORKQUEUE:
- P2: Weapon Mastery feat, per-feature notes, localStorage auto-save, Aasimar species
- P2: Missing Dark Sun spells, missing SRD subclasses
- P3: Defiler/Psionicist/Bard stubs, feat mechanical effects, content pack generalization
