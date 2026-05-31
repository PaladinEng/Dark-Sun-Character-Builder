# Prompt Log

Session prompts and outcomes for the Dark Sun Character Builder. Each entry records what was asked, what was done, and what's left — providing continuity across Claude Code sessions and Cowork reviews.

## Format

```
### YYYY-MM-DD — Session N: <short title>
**Prompt:** <what was asked>
**Outcome:** <what was accomplished>
**Harness:** <pnpm loop:check result — PASS/FAIL with details>
**Commits:** <commit hashes and messages, or "none">
**Next:** <immediate follow-up work or blockers>
```

---

<!-- Append new entries below this line -->

### 2026-04-26 — Session 1: Baseline restore + define first sprint
**Prompt:** Read context files, run `pnpm loop:check`, and report harness status, issues, and which P1 items are ready to pick up.
**Outcome:** Confirmed all context files; harness initially failed on `web:build` because of a corrupted `autoprefixer@10.4.27` entry in pnpm's content store (missing `lib/browsers.js` plus ~13 other lib files). Diagnosed as an interrupted install. Reported back with diagnosis and proposed Sprint 1 (HTML sheet → PDF sheet → Codex migration close-out).
**Harness:** FAIL → PASS after `pnpm install --force` (web:build was the only failing stage; 12/13 checks were green before the fix).
**Commits:** none.
**Next:** Pick first work item from sprint definition (option #4 from the P1 backlog).

### 2026-04-26 — Session 2: Builder bug-fix sweep (5 bugs)
**Prompt:** Fix 5 bugs in order with a `pnpm loop:check` between each — character name field; point buy budget enforcement; split backstory into backstory/companion/familiar; add 23 missing D&D 2024 SRD general feats; support multiple equipped weapons with a multi-row attack table. Plus reference D&D Beyond 5-page sheet layout for future /sheet and /print rework.
**Outcome:**
- Bug 1: added `characterName` to `CharacterState`, prominent input at the top of the builder, sheet/print/PDF read it directly. Removed redundant `characterName?: unknown` casts.
- Bug 2: `updatePointBuyAbility` now clamps increases to the highest affordable score given the other abilities' costs; the score input's `max` reflects the dynamic ceiling and the budget panel turns red when remaining < 0. Validator already errors on budget overruns at export.
- Bug 3: collapsible Companion and Familiar `<details>` subsections under Backstory, each with name/type/summary/notes inputs. Sections auto-expand when populated.
- Bug 4: added 23 feats as JSON files matching the existing minimal schema (id/name/category/description/prerequisites). Effects deferred until the runtime grows reaction/conditional modeling. Pack feat count went 15 → 38.
- Bug 5: added `equippedWeaponIds[]` to `CharacterState` and `attacks[]` to `DerivedState`. compute.ts iterates over each equipped weapon. Legacy `equippedWeaponId` and `attack` remain populated as the first entry for backwards compatibility. Builder UI now uses a weapon checklist with chips; sheet/print pages render one row per attack; PDF snapshot carries an `attacks[]` payload that emits multiple weapon rows. validate.ts mirrors the existing single-weapon checks for the array. Regenerated 32 golden fixtures.
**Harness:** PASS (all 13 stages, ~65s) after each bug fix. One transient `web:dev-smoke` flake on Bug 1's first run; passed on retry without code changes (matches the documented Next.js dev-artifact race).
**Commits:**
- `9c18c6e` fix(builder): add character name field to state and UI
- `205d854` fix(builder): enforce 27-point budget on point buy ability scores
- `3de0ed6` fix(builder): split narrative section with Companion and Familiar fields
- `3b8a6d0` fix(content): add 23 missing D&D 2024 SRD general feats
- `a6dc941` fix(rules): support multiple equipped weapons and per-weapon attacks
**Next:** /sheet HTML layout rework against the D&D Beyond 5-page reference (left/center/right columns on page 1, features/equipment on page 2, character details with personality fields on page 4, spells page 5). Printable PDF layout rework follows. Some new feats (Mobile speed bonus, Heavy Armor Master damage reduction, Observant passive bonuses) will become mechanically modelable once the runtime grows reaction/conditional support.

### 2026-04-26 — Session 3: Complete D&D 2024 feat descriptions
**Prompt:** Cowork review found that the original 15 SRD feats had placeholder one-line descriptions, Great Weapon Master had outdated 2014 mechanics, and the origin feat Crafter was missing entirely. Rewrite all 15 placeholder descriptions to match D&D 2024 PHB rules, correct Great Weapon Master, and add Crafter.
**Outcome:**
- Rewrote 15 feat descriptions with full D&D 2024 mechanics: Alert (Initiative Proficiency + Initiative Swap), Healer (Battle Medic + Healing Reroll), Lucky (Luck Points = PB), Magic Initiate (cantrips + 1 spell from Cleric/Druid/Wizard list), Musician (3 instruments + Encouraging Song Heroic Inspiration), Savage Attacker (reroll weapon damage once per turn), Skilled (3 skills/tools, repeatable), Tavern Brawler (1d4 + STR unarmed, push, damage rerolls, improvised proficiency), Athlete (STR/DEX +1, climbing/jumping/standing improvements), Durable (CON +1, advantage on death saves, bonus-action HD heal), Mage Slayer (STR/CON/DEX +1, concentration disadvantage, mental save reroll), Sharpshooter (DEX +1, ignore cover, no long-range disadvantage, Steady Aim), Spell Sniper (spellcasting +1, doubled spell range, ignore cover, attack cantrip), Tough (HP = level×2 + 2/level), War Caster (spellcasting +1, advantage on Concentration saves, reaction-spell on OA, somatic components with weapons).
- Corrected Great Weapon Master: removed the obsolete 2014 "proficiency bonus to damage on a Heavy weapon attack" and replaced with the 2024 once-per-turn Heavy-weapon damage reroll.
- Added the missing origin feat Crafter (3 Artisan's Tools proficiencies, 25% craft time/cost reduction, 20% nonmagical-purchase discount). Pack feat count went 38 → 39.
- All categories verified (8 origins are `origin`, 8+ generals are `general`, prerequisites preserved). Effects arrays remain absent — the 2024 mechanics in scope here (initiative bonuses, dice rerolls, cover ignore, HP-per-level scaling, choice-based proficiencies) aren't expressible in the current effect schema.
**Harness:** PASS (all 13 stages, ~65s).
**Commits:**
- `71e212f` fix(content): complete D&D 2024 mechanical descriptions for all feats
**Next:** Same as session 2 — /sheet and /print layout rework against the 5-page D&D Beyond reference. Effect-schema expansion (reaction/conditional/initiative/HP-scaling) is now the gating constraint for promoting these descriptions to mechanical effects.

### 2026-04-26 — Session 4: Weapon mastery audit + missing weapons
**Prompt:** Cowork audit found 2 missing SRD weapons (Flail, Blowgun) and 30 weapons without 2024 mastery properties. Add the missing weapons and apply the correct mastery assignments. Musket/pistol excluded for Dark Sun setting fit.
**Outcome:**
- Added `flail.json` (martial melee, 1d8, mastery sap) and `blowgun.json` (martial ranged, 1 damage, ammunition/loading/range 25/100, mastery vex).
- Added `masteryProperties` to 30 existing weapons covering all four categories. Mastery enum is `cleave|graze|nick|push|sap|slow|topple|vex` (validated by `WeaponMasteryPropertySchema`); harness lints would have caught any typo. The 4 weapons that already had correct mastery (battleaxe/topple, longsword/sap, rapier/vex, shortbow/vex) were left untouched.
- Equipment count for srd52 pack is now 2 weapons higher.
**Harness:** PASS (all 13 stages, ~62s).
**Commits:**
- `c88cbc4` fix(content): add missing weapons and D&D 2024 mastery properties to all weapons
**Next:** Same as before — /sheet and /print layout rework against the D&D Beyond reference. Note that `shortsword.json` is currently typed as `weaponCategory: "simple"` but the SRD makes it martial; left unchanged because the audit's scope was mastery only — flag for a future content correction.

### 2026-05-31 — Session 5: Sheet & print layout rework
**Prompt:** Rework `apps/web/app/print/page.tsx` from 2 pages to a multi-page layout matching the 5-page D&D 2024 reference PDF, then mirror the same information architecture in `apps/web/app/sheet/page.tsx` as a scrollable HTML view. Group skills under their ability scores, add proficiency markers, surface senses/proficiencies/currency, split features and equipment onto their own page, add a character-details page, and render a spellcasting page only for casters.
**Outcome:**
- Print page reworked into up to 4 logical pages (kept the fixed inch-based `.sheet-page` CSS):
  - Page 1 (core): skills + saves grouped under each ability with ●/○ proficiency markers and a proficiency-bonus header; combat + HP blocks; attacks table (`derived.attacks`); senses panel (`derived.senses` + resistances + passive perception); armor/weapon/tool proficiencies; languages; equipment summary; full CP/SP/EP/GP/PP currency; conditions/resources (hit dice, death saves, exhaustion, heroic inspiration, active conditions/modifiers).
  - Page 2 (features & equipment): class features, subclass features, species traits + selected features, feats, equipped gear table (multi-weapon aware), inventory, and 5 numbered magic-item slots from `state.attunedItems` (handles both structured and legacy-string shapes).
  - Page 3 (character details): appearance, physical description, backstory, alignment, notes, companion, familiar, and a compact 6-ability summary grid.
  - Page 4 (spellcasting): rendered only when `hasSpellcasting`; spellcasting summary (ability/mod/save DC/attack/progression), per-level slot tracker with checkboxes, and cantrip/known/prepared lists (R/C markers preserved via `formatSpellNameWithFlags` and merged custom spells). Attribution footer moves to the last rendered page.
  - Reused the existing header bar across pages 1-3; removed the now-unused `SKILL_ORDER` constant.
- Sheet page reorganized into a single scrollable document mirroring the print sections: identity; one Combat block and one Hit Points block (removed the duplicated combat strip and HP block flagged in the prompt); abilities with saves and skills grouped per ability; attacks; senses; proficiencies & languages; currency; conditions; class/subclass features; species traits & feats; equipment & magic items; spellcasting (collapses to a one-line note for non-casters); character details with companion/familiar; validation. Added `SheetSection` and `StatCell` helpers to cut panel boilerplate and a `skillsByAbility` grouping that respects content-defined skill abilities.
- Data-fetching/payload-parsing logic at the top of each file was left intact per the constraints; `pdfExport.ts` untouched. Backwards-compatible with the existing `?payload=base64` format.
- Verified by rendering against the smoke fixtures through the real dev server: non-caster Fighter → 3 print pages (spell page omitted); level-5 Cleric → 4 print pages including a populated Spellcasting page; sheet renders all 15 sections in order with no Combat/HP duplication. Both routes return 200 with required markers ("Character Name", "Abilities").
- Step 3 (template overlay PNGs for pages 3-5) was intentionally skipped — see Decision below.
**Decision:** Did not extract reference PDF pages 3-5 to `public/sheets/template-page{3,4,5}.png`. The reworked print sheet consolidates the reference's 5 pages into a custom 4-page information architecture (e.g., our page 2 is Features & Equipment, the reference page 2 is Extended Details), so per-page overlays would no longer align with the rendered content. The existing page-1/page-2 overlays remain wired for core-layout alignment; adding mismatched multi-MB PNGs for a dev-only toggle would bloat the repo without value. Revisit if the layout is ever made to track the reference page-for-page.
**Harness:** PASS (all 13 stages, ~64s) after the print rework, after removing the unused `SKILL_ORDER` constant, and after the sheet rework. Zero web:build warnings.
**Commits:**
- `fbf89da` fix(print): rework sheet into multi-page layout [ckpt 1]
- `5db08cf` fix(sheet): mirror print information architecture in HTML view [ckpt 2]
**Next:** Optional polish — tune per-page vertical budgets if long feature/backstory text clips under the fixed `.sheet-page` height (content currently clips via `overflow: hidden`, matching prior behavior). Consider correcting `shortsword.json` to martial (carried over from Session 4). If a true page-for-page reference match is later desired, extract all 5 template overlays and wire `.page-3/4` overlay CSS.
