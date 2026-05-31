# WORKQUEUE — Dark Sun Character Builder
Last updated: 2026-05-31

## P1 — High Priority
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

## P2 — Medium Priority
- [ ] Add Aasimar species to SRD pack
- [ ] Create 9 missing Dark Sun reworked spell entities (Elemental Aegis, Elemental Favor, Storm Step, Destructive Squall, Silt Horror's Grasp, Blight of the Ash Wastes, Transmute Stone to Slag, Conjure Elemental Earth/Fire reworks)
- [ ] Add missing D&D 2024 SRD subclasses and resolve `unresolvedDisabledSubclassKeys` in profile.json (~13 subclasses)
- [ ] Add localStorage auto-save for character state (prevent data loss on tab close)
- [ ] Add builder shortcut to open /sheet directly
- [ ] Expand SRD coverage (additional spells, equipment)
- [ ] Implement modelable feat effects when the runtime grows reaction/conditional support (Mobile +10 speed, Heavy Armor Master damage reduction, Observant +5 passive bonuses, etc.)
- [ ] Tune print page vertical budgets if long feature/backstory text clips under fixed `.sheet-page` height
- [ ] Extract all 5 template overlay PNGs from reference PDF and wire page 3/4 overlay CSS

## P3 — Low Priority
- [ ] Defiler casting mechanics
- [ ] Psionicist class mechanics (currently a stub)
- [ ] Athasian Bard subclass mechanics (currently a stub)
- [ ] Wild Talent mechanical effects beyond table assignment (12 talents are stubs)
- [ ] Preserver spell-point and Rite of Blood automation
- [ ] Telekinetic and Telepathic feat mechanical implementations
- [ ] Remove Dark Sun hardcoding — implement full content pack system
- [ ] Create homebrew content pack documentation for other DMs
- [ ] Commercialization prep — landing page and licensing

## Completed This Session (2026-05-31 Cowork)
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
