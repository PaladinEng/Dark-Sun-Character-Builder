# STATUS — Dark Sun Character Builder
Updated: 2026-06-14

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core works with the closed-loop validation harness green (13/13 stages).
Both /print and /sheet have been reworked to a multi-section information
architecture. The rules engine supports multiple equipped weapons, natural weapon
attacks, half-feat ability bonuses, custom spell entry, language picker with
literacy tracking, skill expertise (proficiency bonus doubled), non-walking
movement speeds, a setting-aware currency system, and character save/load via
JSON import/export. PDF export has been fixed for ability score layout, skill
markers, and spell slot alignment. Starting equipment is complete for all classes
and backgrounds.

## Last Session
Date: 2026-06-14 (Player feedback batch — expertise, Ranger 2024, currency, UI)
Done:
- grant_skill_expertise effect type (fixed or player-choice); doubles proficiency
  bonus, tracked in DerivedState.skillExpertise, shown on sheet/print/PDF; builder
  Skill Expertise picker. Wired Scholar (Wizard L2).
- Ranger 2024: Deft Explorer (L2), Roving (L6), Expertise (L9); new
  grant_movement_speed effect + DerivedState.movementSpeeds (climb/swim/fly/burrow);
  converted Ranger to the 2024 prepared-spell progression (L6 = 6 prepared).
- Human (SRD + Athasian): Skillful skill choice via skillChoices; +2 language
  choices via new Species.languageChoices. Versatile (origin feat) deferred.
- Added 6 SRD equipment items (Arrows, Bolts, Quiver, Sprig of Mistletoe, Tent,
  Traveler's Clothes).
- Spell-list audit: confirmed wizard->arcane / ranger+druid->nature override works
  at runtime via classSpellListOverrides; added Hunter's Mark to the nature list.
- Dark Sun (Athasian) base-10 currency (Bit/CP/SP/GP); SRD reordered low-to-high.
- UI: empty background ability defaults with green indicators; Custom Gear moved
  before spells; Known/Prepared spell pickers filtered to castable levels.
- Verified via rendered /sheet: Ranger L6 Human (Dark Sun) shows expertise (PP 18),
  Roving 40 ft walk/climb/swim, Bits currency, nature tradition; Wizard L2 (Dark
  Sun) shows Scholar expertise and arcane tradition.

## Previous Session
Date: 2026-06-07 (Cowork — Wizard modernization + species skill choice + spell/equipment fill)
Done:
- Coverage test fixed: add_hp_per_level, add_speed_bonus, grant_natural_weapon, grant_weapon_mastery added to SUPPORTED_EFFECT_TYPES allowlist
- Wizard class modernized to 2024 PHB: L1 Ritual Adept (new), L2 Scholar (new), L3 Arcane Tradition (was L2), L5 Memorize Spell (new); 7 wizard subclasses bumped from L2→L3 first feature
- Species skill choice framework: new SpeciesSchema.skillChoices field; CharacterState.chosenSpeciesSkills + touched.speciesSkills; compute applies; builder renders a Species Skills picker section
- Athasian Elf Keen Senses now grants choice of Insight/Perception/Survival via the new framework
- Wizard spell list expanded from 51 to 92 spells: added Mind Sliver (cantrip); Find Familiar, Tenser's Floating Disk, Witch Bolt (L1); Enlarge/Reduce, Mind Spike (L2); Tongues (L3); curated L4–L9 wizard staples (Banishment, Dimension Door, Fireshield, Polymorph, Stoneskin, Wall of Fire/Force, Cone of Cold, Hold Monster, Scrying, Telekinesis, Chain Lightning, Disintegrate, True Seeing, Teleport, Finger of Death, Prismatic Spray, Reverse Gravity, Dominate Monster, Mind Blank, Meteor Swarm, Time Stop, Wish, etc.)
- Wizard starting equipment now includes Spellbook, Component Pouch, Arcane Focus (Crystal), Robe, Book, Ink & Pen, Parchment, Map/Scroll Case; equippedWeaponId switched to Quarterstaff; 5 alternate Arcane Focus variants (Orb/Rod/Staff/Wand) also added to the catalog
- 41 new SRD spell entities and 11 new SRD equipment entities added to the catalog


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
Run `pnpm loop:check` to confirm baseline passes. Then verify outstanding triage items:
- Wild Talent picker visibility (user reported missing; gated on settingProfile + wildTalentOptions; needs in-browser repro)
- Saves missing proficiency (user reported; code-path traces clean; needs repro with exported character JSON)
Then WORKQUEUE priorities:
- P2 enhancements: starting-equipment "added" badge, filter prepared spells, Dark Sun currency, custom gear
- P2: Extract template overlay PNGs for pages 3/4
- P3: Defiler/Psionicist/Bard stubs, content pack generalization, commercialization
