# STATUS — Dark Sun Character Builder
Updated: 2026-05-31

## Current State
Phase 0 — Project registered with Paladin Control Plane on 2026-04-03.
Creation mode: existing-repo.
GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder

Builder core works with the closed-loop validation harness green. Both the /print
sheet and the /sheet HTML view have been reworked to a shared multi-section
information architecture inspired by the D&D 2024 reference, and the rules engine
supports multiple equipped weapons end to end.

## Last Session
Date: 2026-05-31 (Session 5 — Sheet & print layout rework)
Done:
- Reworked `apps/web/app/print/page.tsx` from 2 pages to up to 4 (fixed inch-based
  CSS kept): page 1 core (skills grouped under abilities with ●/○ proficiency
  markers, combat, HP, attacks, senses, proficiencies, languages, equipment,
  CP/SP/EP/GP/PP currency, conditions); page 2 features & equipment (class/subclass
  features, species traits, feats, equipped-gear table, inventory, 5 magic-item
  slots); page 3 character details (appearance, description, backstory, alignment,
  notes, companion/familiar, compact ability summary); page 4 spellcasting, rendered
  only for casters (summary, slot tracker, cantrip/known/prepared lists with R/C
  markers).
- Reworked `apps/web/app/sheet/page.tsx` to mirror the same sections in one
  scrollable Tailwind document; removed the duplicated combat strip and HP block;
  grouped skills under abilities; added `SheetSection`/`StatCell` helpers.
- Data-fetching/parsing logic and `pdfExport.ts` left untouched. Backwards-compatible
  with the `?payload=base64` URL format.
- Verified via the dev server: Fighter → 3 print pages, Cleric L5 → 4 print pages
  with a populated spellcasting page; sheet renders 15 ordered sections, no dupes.

## In Progress
_None._

## Blocked
_None._

## Next Session Should Start With
Run `pnpm loop:check` to confirm the baseline passes. Optional follow-ups:
tune per-page vertical budgets if long feature/backstory text clips under the fixed
`.sheet-page` height; correct `shortsword.json` to martial (carried from Session 4);
and, only if a page-for-page reference match is wanted, extract all 5 template
overlays and wire `.page-3/4` overlay CSS (deliberately skipped this session — see
the Session 5 Decision in PROMPT_LOG.md).
