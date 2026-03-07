Goal

Implement or improve the spellcasting, equipment, currency, proficiency, and narrative/equipment-related PDF sections beyond page 1, using the reference sheet as the structural guide.

Reference asset

Use this file as the section/layout guide:
apps/web/assets/sheets/DLDM - 5E24 CHARACTER SHEET - 5pg - Updated Form Fields.pdf

Target areas

- Spellcasting summary
  - spellcasting ability
  - spellcasting modifier
  - spell save DC
  - spell attack bonus

- Spell slots table
  - levels 1-9 where applicable
  - total and/or expended if modeled

- Equipment / inventory
- Currency
- Armor/weapon/tool/language proficiencies
- Narrative fields as appropriate for later pages
- Attuned items if data exists

Files to inspect first

apps/web/app/api/export/pdf/route.ts
packages/rules/src/pdfExport.ts
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
scripts/api-smoke.mjs
scripts/pdf-sanity.mjs

Implementation guidance

- Build on the page-1 work rather than refactoring everything from scratch.
- Represent these sections clearly and readably.
- Use later pages as needed.
- Keep the output deterministic and stable.

Constraints

- Do not add unsupported gameplay logic.
- Do not attempt a full companion implementation here.

Definition of done

- Spellcasting and equipment-related sections are substantially more complete.
- Currency, proficiencies, and attunement data render where present.
- PDF harness remains green.

Mandatory development loop

1. Inspect the relevant subsystem files first.
2. Make the smallest coherent change.
3. Run:
   pnpm loop:check
4. If any stage fails:
   - fix the root cause
   - rerun pnpm loop:check
5. Repeat until:

=== ALL_PASS ===
