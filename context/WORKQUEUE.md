# WORKQUEUE — Dark Sun Character Builder
Last updated: 2026-06-07

## P1 — High Priority
- [x] ~~**Class resources system** (Focus Points, Rage, Bardic Inspiration, Sorcery Points, etc.) — schema, derivation, display on sheet/print/PDF~~ (done 2026-06-06, Cowork session)
- [x] ~~Improve /sheet HTML layout (information architecture against D&D Beyond reference)~~ (done 2026-05-31, Session 5)
- [x] ~~Improve printable PDF/print layout (multi-page split per reference)~~ (done 2026-05-31, Session 5)
- [x] ~~Correct `shortsword.json` to `weaponCategory: "martial"`~~ (done 2026-05-31, Cowork session)
- [x] ~~Druidic feature grants language via `grant_language`~~ (done 2026-05-31, Cowork session)
- [x] ~~Migrate Codex prompt queue workflow to Claude Code~~ (operating in Claude Code; PROMPT_LOG.md is the new continuity ledger)
- [x] ~~Add character name field to builder state and UI~~ (done 2026-04-26)
- [x] ~~Enforce 27-point Point Buy budget in the builder~~ (done 2026-04-26)
- [x] ~~Split backstory section to add Companion and Familiar fields~~ (done 2026-04-26)
- [x] ~~Add the missing D&D 2024 SRD general feats~~ (done 2026-04-26, 23 feats added)
- [x] ~~Support multiple equipped weapons and a multi-row attack table~~ (done 2026-04-26)

## P2 — Medium Priority (added 2026-06-07)
- [x] ~~Coverage test: add missing effect handlers to SUPPORTED_EFFECT_TYPES~~ (done 2026-06-07)
- [x] ~~Wizard class to 2024 PHB: Ritual Adept (L1), Scholar (L2), subclass→L3, Memorize Spell (L5)~~ (done 2026-06-07)
- [x] ~~Athasian Elf Keen Senses: choice of Insight/Perception/Survival~~ (done 2026-06-07; added species-level skillChoices framework)
- [x] ~~Wizard spell list expansion: missing named spells + L4–L9 coverage~~ (done 2026-06-07; 41 new spells)
- [x] ~~Wizard starting equipment: Spellbook, Component Pouch, Arcane Focus, Scholar's Pack staples~~ (done 2026-06-07)
- [x] ~~Visual signal that starting equipment was auto-added on class select~~ (done 2026-06-07 — per-item ✓ checkmarks, smart button label, inline "added" flash)
- [x] ~~Wild Talent picker visibility regression~~ (done 2026-06-07 — root cause: parseProfile required unresolvedDisabledSubclassKeys after the field was removed in ef924fd; restored field + made parser tolerant)
- [x] ~~Reset Character button to clear all entries~~ (done 2026-06-07)
- [ ] Filter prepared spell list to only show known spells (wizard-style casters)
- [ ] Dark Sun currency (ceramic/copper/silver/gold pieces)
- [ ] Custom Gear input (mirror custom spells)
- [ ] Verify: saves not including proficiency bonus (code trace clean; needs character JSON to reproduce)

## P2 — Medium Priority
- [x] ~~**Weapon Mastery feat** — gate mastery properties behind class feature/feat, add choice UI, add effects to weapon-master.json~~ (done 2026-06-07, Cowork session)
- [x] ~~**Per-feature notes** — add `featureNotes` map to CharacterState, input fields next to each feature/feat, display on sheet/print/PDF~~ (done 2026-06-07, Cowork session)
- [x] ~~Add localStorage auto-save for character state (prevent data loss on tab close)~~ (done 2026-06-07, Cowork session)
- [x] ~~Add Aasimar species to SRD pack~~ (done 2026-06-07, Cowork session)
- [x] ~~Create 9 missing Dark Sun reworked spell entities~~ (done 2026-06-07, Cowork session — Elemental Aegis, Elemental Favor, Storm Step, Destructive Squall, Silt Horror's Grasp, Blight of the Ash Wastes, Transmute Stone to Slag, Conjure Elemental Earth/Fire)
- [x] ~~Add missing D&D 2024 SRD subclasses and resolve `unresolvedDisabledSubclassKeys`~~ (done 2026-06-07, Cowork session — 4 new subclasses: Path of the Zealot, Circle of the Sea, Fey Wanderer, Gloom Stalker; 3 stale keys removed, 1 rename resolved)
- [x] ~~Add builder shortcut to open /sheet directly~~ (done 2026-06-07, Cowork session — "View Sheet" button in header)
- [x] ~~Expand SRD coverage~~ (done 2026-06-07, Cowork session — 12 missing feats added, 2 missing weapons: Musket, Net)
- [x] ~~Implement modelable feat effects~~ (done 2026-06-07, Cowork session — add_speed_bonus + add_hp_per_level effect types; Mobile +10 speed, Tough +2 HP/level, Speedy +10 speed, Poisoner tool prof, Tavern Brawler natural weapon)
- [x] ~~Tune print page vertical budgets~~ (done 2026-06-07, Cowork session — min-height: 0 on flex children, reduced font sizes)
- [ ] Extract all 5 template overlay PNGs from reference PDF and wire page 3/4 overlay CSS

## P3 — Low Priority
- [ ] Defiler casting mechanics
- [ ] Psionicist class mechanics (currently a stub)
- [ ] Athasian Bard subclass mechanics (currently a stub)
- [ ] Wild Talent mechanical effects beyond table assignment (12 talents are stubs)
- [ ] Preserver spell-point and Rite of Blood automation
- [x] ~~Telekinetic and Telepathic feat files added~~ (done 2026-06-07, Cowork session — mechanical effects still stubs)
- [ ] Remove Dark Sun hardcoding — implement full content pack system
- [ ] Create homebrew content pack documentation for other DMs
- [ ] Commercialization prep — landing page and licensing

## Completed (2026-06-06 Cowork — PDF fixes + starting equipment + class resources)
- [x] Class resources system — ClassResourceDefinitionSchema with 5 calculation modes, resources on 9 classes, display on sheet/print/PDF


- [x] Fix PDF ability score overlap with modifier text (score field height/offset adjusted)
- [x] Fix mojibaked bullet `•` before proficient skills (replaced with ASCII `*`)
- [x] Fix spell slots level 9 "No class spell slots" text overlap
- [x] Fix LEVEL/TOTAL/EXPENDED header row shifted down by one
- [x] Complete starting equipment for all 13 classes (backpack, bedroll, waterskin + class-appropriate gear)
- [x] Add startingEquipment to 9 Dark Sun backgrounds that were missing it entirely
- [x] Expand 6 sparse backgrounds (Acrobat, Athasian Minstrel, Psionic Adept, Veiled Alliance, Acolyte, Noble)

## Completed (2026-05-31 Cowork — 20+ bug fixes and features)
- [x] 8 missing SRD backgrounds (Artisan, Charlatan, Farmer, Guard, Guide, Merchant, Scribe, Wayfarer)
- [x] Point buy input fix (defer clamping to blur/Enter)
- [x] Background dropdown with SRD/Dark Sun group separators
- [x] Additive background filtering (SRD + Dark Sun both show)
- [x] Weapon proficiencies derived from class data and displayed on sheet/PDF
- [x] Languages granted by Dark Sun species (all 8 species updated)
- [x] Languages display in builder derived state section
- [x] Half-feat ability score bonuses (17 feats + choice UI + abilityBonusOptions schema)
- [x] Natural weapon attacks for Aarakocra (Talons) and Thri-kreen (Claws + Bite)
- [x] Custom spell manual entry (name, level, list, ritual/concentration)
- [x] Rogue: Thieves' Tools proficiency + Thieves' Cant language
- [x] Assassin: Disguise Kit + Poisoner's Kit proficiency
- [x] Skills section added to PDF export
- [x] Language picker with Dark Sun categories and additionalChoices slots
- [x] Per-language literacy checkboxes (default illiterate per Dark Sun rules)
- [x] Current HP editable input
- [x] Character save/load (Import JSON button)
- [x] Wild Talent refactored to dedicated `wildTalentFeatureId` field with description display
- [x] Athasian Elf updated (Trance → Elf Sleep, added Elf Run)
- [x] Shortsword corrected to martial
- [x] Druidic feature grants language
