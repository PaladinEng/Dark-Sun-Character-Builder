# STATUS — Dark Sun Character Builder
Updated: 2026-05-31

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core works with the closed-loop validation harness green. Both the /print
sheet and the /sheet HTML view have been reworked to a shared multi-section
information architecture inspired by the D&D 2024 reference. The rules engine
supports multiple equipped weapons, natural weapon attacks, half-feat ability
bonuses, custom spell entry, language picker with literacy tracking, and
character save/load via JSON import/export.

## Last Session
Date: 2026-05-31 (Cowork bug-fix session — 20+ fixes and features)
Done:
- 8 SRD backgrounds added (Artisan, Charlatan, Farmer, Guard, Guide, Merchant, Scribe, Wayfarer)
- Point buy input fixed (defer clamping to blur/Enter)
- Background dropdown grouped by SRD/Dark Sun with additive filtering
- Weapon proficiencies derived from class data, displayed on sheet/PDF
- All 8 Dark Sun species grant languages via effects
- Half-feat ability bonuses: 17 feats with abilityBonusOptions schema + choice UI
- Natural weapons: grant_natural_weapon effect type, Aarakocra Talons + Thri-kreen Claws/Bite
- Custom spell manual entry with level, list, ritual/concentration flags
- Rogue gets Thieves' Tools + Thieves' Cant; Assassin gets Disguise Kit + Poisoner's Kit
- Skills section added to PDF page 1
- Language picker with Dark Sun categories, additionalChoices, literacy checkboxes
- Current HP editable input alongside Temp HP
- Character import/export (Save / Load section with Import JSON)
- Wild Talent refactored to dedicated wildTalentFeatureId with description display
- Athasian Elf updated: Trance → Elf Sleep, added Elf Run trait
- Shortsword corrected to martial weapon category
- Druidic feature changed to grant_language

## In Progress
_None._

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes. Priority items from WORKQUEUE:
- P2: Add Aasimar species, create 9 missing Dark Sun reworked spell entities,
  add missing 2024 SRD subclasses, localStorage auto-save
- P3: Defiler/Psionicist/Bard stubs, feat mechanical effects, content pack generalization
