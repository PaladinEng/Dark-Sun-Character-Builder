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
Date: 2026-06-07 (Cowork — continued: localStorage, spells, subclasses, feats, equipment, print)
Done:
- Per-feature notes: featureNotes map on CharacterState, input fields next to each feature/feat, display on sheet/print/PDF
- Weapon Mastery gating: grant_weapon_mastery effect type, weaponMasteryChoices on CharacterState, weaponMasteryLimit on DerivedState
- Weapon Mastery features: 4 feature JSONs (base 2-count, fighter 3/4/5-count) wired into all 5 martial classes
- Weapon Mastery picker UI in builder with limit enforcement
- Aasimar species added to SRD pack (auto-excluded from Dark Sun via speciesReplacementIds allowlist)
- localStorage auto-save: character state persisted to localStorage with 400ms debounce, loaded on init
- View Sheet shortcut: amber button in builder header for quick access to /sheet
- 9 Dark Sun homebrew spells: Elemental Aegis, Elemental Favor, Storm Step, Destructive Squall, Silt Horror's Grasp, Blight of the Ash Wastes, Transmute Stone to Slag, Conjure Elemental Earth/Fire — all wired into patron spell lists
- 4 new SRD subclasses: Path of the Zealot (Barbarian), Circle of the Sea (Druid), Fey Wanderer + Gloom Stalker (Ranger) — all disabled in Dark Sun profile; unresolvedDisabledSubclassKeys fully resolved
- 2 new effect types: add_speed_bonus, add_hp_per_level — wired through effects.ts and compute.ts
- Feat mechanical effects: Mobile (+10 speed), Tough (+2 HP/level), Speedy (+10 speed), Poisoner (Poisoner's Kit proficiency), Tavern Brawler (enhanced unarmed strike)
- 12 missing SRD feats added: Actor, Elemental Adept, Fey-Touched, Gift of the Chromatic Dragon, Keen Mind, Piercer, Shadow-Touched, Skill Expert, Slasher, Speedy, Telepathic, Telekinetic
- 2 missing SRD weapons added: Musket, Net
- Print page vertical budgets tuned: min-height: 0 on flex children, reduced font sizes for better text fit

## In Progress
_None._

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes. Priority items from WORKQUEUE:
- P2: Extract template overlay PNGs for pages 3/4
- P3: Defiler/Psionicist/Bard stubs, content pack generalization, commercialization
