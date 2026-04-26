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
