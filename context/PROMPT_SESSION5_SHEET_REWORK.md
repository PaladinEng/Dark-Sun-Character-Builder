# Claude Code Prompt — Session 5: Sheet & Print Layout Rework

## Context

Read `context/PROMPT_LOG.md`, `context/STATUS.md`, and `CLAUDE.md` first. Run `pnpm loop:check` to confirm the harness is green before starting.

The reference PDF is at `apps/web/assets/sheets/DLDM - 5E24 CHARACTER SHEET - 5pg - Updated Form Fields.pdf`. This is a 5-page D&D 2024 character sheet (603×774pt per page, US Letter). Use it as the target information architecture.

## Objective

Rework `apps/web/app/print/page.tsx` from 2 pages to 5 pages matching the reference PDF layout. Then update `apps/web/app/sheet/page.tsx` to mirror the same information architecture as a scrollable HTML view.

## Reference PDF Layout (from form field analysis)

### Page 1 — Core Character Sheet
**Header bar:** Name (left, large), then row of Background, Class, Species, Subclass, Level, XP.
**Top-right combat strip:** AC, Current HP, Temp HP, Max HP, Spent HD, Max HD.
**Left column (~100px):** Proficiency Bonus at top. Then 6 ability blocks stacked vertically (STR → DEX → CON → INT → WIS → CHA). Each block has: modifier circle, score box, then save + related skills indented below. Skills are grouped under their ability (Athletics under STR, Acrobatics/Sleight of Hand/Stealth under DEX, etc.).
**Center column:** Combat stats (AC, Initiative, Speed, Prof Bonus, Passive Perception), Hit Points block (Max/Current/Temp), Attacks table (weapon name, bonus, damage — at least 4 rows), Features & Traits list.
**Right column:** Senses, Proficiencies (armor/weapon/tool), Languages, Equipment/inventory, Currency (CP/SP/EP/GP/PP), Conditions/exhaustion.

### Page 2 — Extended Character Details
**Same header bar** as page 1 (Name, Background, Class, Species, Subclass, Level, XP, AC, HP strip).
**Left column:** Ability blocks repeated (for reference at the table). Save proficiency checkboxes. Passive Perception.
**Center:** Skills full list with proficiency checkboxes and modifiers.
**Right column:** Armor worn, Weapons, Equipment list, Magic Items (5 slots).

### Page 3 — Spell Slots & Spells
**Top section:** Spell slot checkboxes — 9 levels, each with a grid of checkboxes for tracking used slots.
**Right side:** Character portrait placeholder, Armor Worn, Weapons, Equipment list, Magic Items (5 slots).
**Bottom area:** Large area for spell entries organized by level. Each spell has a checkbox row.

### Page 4 — Backstory & Personality
**Left column:** Armor Worn, then large text areas for: Personality Traits, Ideals, Bonds & Flaws. Magic Items (5 slots). Currency row at bottom.
**Center:** Backstory (large text area), Organization/Allies label, Appearance notes.
**Right:** Additional Notes, Companions/Familiars. Ability scores summary (compact 6-score grid) at bottom.

### Page 5 — Full Spellcasting Page
**Top-left:** Spell slot tracking checkboxes (same as page 3 but full layout).
**Top-right:** Spellcasting Ability, Spell Attack Bonus, Spellcasting Modifier, Spell Save DC, Spellcasting Focus, Notes.
**Main body:** Spell list organized by level (Cantrips through 9th), each spell as a row with checkbox columns (Prepared, Concentration, Ritual) + spell name + notes.

## Implementation Plan

Work one page at a time. Run `pnpm loop:check` after each page is complete.

### Step 1: Rework print page (page.tsx in apps/web/app/print/)

The print page uses custom CSS with fixed inch-based dimensions (`@page { size: letter; margin: 0.35in; }`). Each `.sheet-page` is `width: 7.8in; height: 10.3in`. Keep this approach — it works well for print.

Expand from 2 pages to 5:

**Page 1 (core sheet):** Keep the existing page 1 structure but clean up to match the reference more closely. The current 3-column layout is close. Key changes:
- Group skills under their ability score (STR section has Athletics, DEX section has Acrobatics/Sleight of Hand/Stealth, etc.) instead of a separate flat skills table.
- Add proficiency bullet markers to saves and skills.
- Ensure the attacks table shows all equipped weapons (use `derived.attacks` array).
- Add senses (Darkvision etc.) from `derived.senses`.

**Page 2 (features & equipment):** Move Features & Traits and Equipment from page 1 overflow into a dedicated page. Include:
- Class features (from class + subclass feature lists)
- Species traits (`derived.traits`)
- Feats (`derived.feats`)
- Equipment/inventory with armor, shield, weapons listed
- Magic items (from `state.attunedItems`)

**Page 3 (character details):** Personality and backstory:
- Character appearance (`state.appearance`)
- Physical description (`state.physicalDescription`)
- Backstory (`state.backstory`)
- Alignment (`state.alignment`)
- Notes (`state.notes`)
- Companion (`state.companion`) and Familiar (`state.familiar`) if present
- Compact ability scores summary

**Page 4 (spellcasting):** Full spell page — only render if the character has spellcasting:
- Spellcasting summary: ability, save DC, attack bonus, modifier
- Spell slot table (levels 1-9 with slot counts)
- Spell lists: cantrips known, spells known, spells prepared
- Custom spells (`state.customSpells`)
- Include ritual (R) and concentration (C) markers

**Page 5:** Reserved / overflow. Can hold additional notes, extra equipment, or conditions. Or omit if 4 pages suffice.

### Step 2: Rework sheet page (page.tsx in apps/web/app/sheet/)

After the print page is done, update the HTML sheet page to follow the same information architecture but as a scrollable responsive web page (not fixed dimensions). Use Tailwind CSS.

The sheet page should be organized into the same logical sections as the print pages but flowing naturally in a single scrollable document. Remove the current data duplication (combat stats appear twice, HP appears twice).

### Step 3: Generate template overlay images

If time permits, extract the 5 pages of the reference PDF as PNG images and place them in `apps/web/public/sheets/` as `template-page1.png` through `template-page5.png`. The print page already has overlay support for alignment checking.

## Data Sources

All data comes from two objects available in both pages:
- `payload.characterState` — the raw `CharacterState` input
- `derived` — the computed `DerivedState` output from `computeDerivedState()`

Key derived fields:
- `derived.finalAbilities` / `derived.abilityMods` — ability scores and modifiers
- `derived.skills` — Record<string, number> of skill modifiers
- `derived.skillProficiencies` — string[] of proficient skill IDs
- `derived.saveProficiencies` — Ability[] of proficient saves
- `derived.savingThrows` — AbilityRecord of save modifiers
- `derived.traits` — string[] of species/class traits
- `derived.attacks` — Array of {name, toHit, damage, mastery?}
- `derived.weaponProficiencies` / `derived.armorProficiencies` / `derived.toolProficiencies`
- `derived.languages` / `derived.languageLiteracy`
- `derived.senses` — Array of {type, range?}
- `derived.resistances` — string[]
- `derived.spellcasting` — full spellcasting block with slots, known/prepared spell IDs, custom spells
- `derived.feats` — Array of {id, name}
- `derived.maxHP` / `derived.armorClass` / `derived.speed` / `derived.proficiencyBonus`
- `derived.passivePerception`

Content lookups via `merged.content.spellsById[id]`, `merged.content.equipmentById[id]`, etc.

## Constraints

- Run `pnpm loop:check` after completing each page. Must pass all 13 stages.
- Edit files in place — never create copy-style duplicates.
- The print page uses custom CSS (not Tailwind). The sheet page uses Tailwind.
- Keep the existing data-fetching and payload-parsing logic at the top of each file. Only rework the JSX/CSS layout.
- Maintain backwards compatibility with the existing URL payload format (`?payload=base64`).
- The PDF export (`pdfExport.ts`) is a separate system — do NOT modify it in this session.

## Commit Checkpoints

Commit after each major milestone:
1. Print page 1 rework → commit
2. Print pages 2-4 added → commit
3. Sheet page rework → commit
4. Template overlays (if done) → commit

Use conventional commit format: `fix(print): rework page 1 layout [ckpt 1]`

## Log Entry

After all work is done, append a session entry to `context/PROMPT_LOG.md` following the existing format, then update `context/STATUS.md` and `context/WORKQUEUE.md`.
