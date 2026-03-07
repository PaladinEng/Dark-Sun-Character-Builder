Goal

Redesign page 1 of the PDF export so it more closely matches the core first-page structure of the official 5E 2024 character sheet.

Reference asset

Use this file as the page-structure reference:
apps/web/assets/sheets/DLDM - 5E24 CHARACTER SHEET - 5pg - Updated Form Fields.pdf

Primary page 1 sections

- Identity header
  - character name
  - class / subclass
  - level
  - xp
  - background
  - species
  - heroic inspiration

- Combat block
  - armor class
  - shield contribution if represented
  - speed
  - initiative
  - proficiency bonus

- Survivability block
  - current HP
  - max HP
  - temp HP
  - hit dice total/spent
  - death saves

- Ability blocks
  - score
  - modifier
  - save modifier

- Weapons / attacks table
  - name
  - attack bonus or DC
  - damage and type
  - notes

- Conditions / exhaustion

- Features summary
  - class features
  - species traits
  - feats

Files to inspect first

apps/web/app/api/export/pdf/route.ts
packages/rules/src/pdfExport.ts
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
scripts/api-smoke.mjs
scripts/pdf-sanity.mjs

Implementation guidance

- Keep using the current PDF generation approach; do not revert to template passthrough.
- Improve structure, grouping, alignment, and field completeness.
- Focus on page 1 only in this prompt.
- It is acceptable for later prompts to refine styling and overflow handling.

Constraints

- Do not redesign all pages in this prompt.
- Do not break PDF sanity.
- Do not copy the official sheet artwork.

Definition of done

- Page 1 is materially closer to a real character sheet.
- Missing page-1 core fields are represented where data exists.
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
