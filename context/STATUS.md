# STATUS — Dark Sun Character Builder
Updated: 2026-04-26

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core works with the closed-loop validation harness green. /sheet and /print
layouts still need an information-architecture rework against the D&D Beyond reference,
and the rules engine now supports multiple equipped weapons end to end.

## Last Session
Date: 2026-04-26
Done:
- Restored harness baseline by reinstalling autoprefixer (corrupted pnpm entry).
- Bug 1 — added `characterName` to `CharacterState`, surfaced a prominent name input
  at the top of the builder, and wired sheet/print/PDF to read the typed field.
- Bug 2 — point buy ability score increases now clamp to the highest affordable
  value given the remaining 27-point budget; over-budget legacy state shows red.
- Bug 3 — split the narrative section into Backstory + collapsible Companion and
  Familiar subsections feeding the existing `companion`/`familiar` slots.
- Bug 4 — added 23 missing D&D 2024 SRD general feats (Ability Score Improvement,
  Charger, Crossbow Expert, Defensive Duelist, Dual Wielder, Great Weapon Master,
  Heavily Armored, Heavy Armor Master, Inspiring Leader, Lightly Armored, Medium
  Armor Master, Mobile, Moderately Armored, Mounted Combatant, Observant, Polearm
  Master, Poisoner, Resilient, Ritual Caster, Sentinel, Shield Master, Skulker,
  Weapon Master). Pack feat count now 38.
- Bug 5 — added `equippedWeaponIds[]` and `attacks[]`. Compute iterates per weapon;
  legacy single-weapon fields remain valid as `attacks[0]`. Builder UI now uses a
  weapon checklist with chips. Sheet, print, and PDF render one row per attack.
  32 golden fixtures regenerated to include `attacks`.

## In Progress
- /sheet HTML layout improvement against the D&D Beyond reference (P1).
- Printable PDF layout improvement against the D&D Beyond reference (P1).

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes, then choose between the /sheet
HTML rework and the /print layout rework. The reference architecture (5-page D&D
Beyond layout) is captured in PROMPT_LOG entry for 2026-04-26.
