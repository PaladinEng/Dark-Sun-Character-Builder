Goal

Upgrade /sheet into a substantially more complete HTML character sheet that mirrors the structure of the official 5E 2024 sheet while remaining a payload-backed developer-readable HTML route.

Reference asset

Use this file as the section/layout reference:
apps/web/assets/sheets/DLDM - 5E24 CHARACTER SHEET - 5pg - Updated Form Fields.pdf

Do not copy protected text unnecessarily; use it to understand structure and section placement.

Required /sheet sections

- Identity header
- Combat summary
- HP / temp HP / hit dice / death saves
- Ability blocks
- Saving throws
- Skills
- Proficient tool rows in the skill/proficiency region
- Weapons / attacks
- Spellcasting summary
- Spell list summary where available
- Equipment / inventory
- Currency
- Armor/weapon/tool/language proficiencies
- Conditions / exhaustion
- Class features
- Species traits
- Feats
- Narrative fields
- Optional companion placeholder block if data exists

Files to inspect first

apps/web/app/sheet/page.tsx
apps/web/app/builder/BuilderClient.tsx
apps/web/app/print/page.tsx
apps/web/app/api/export/pdf/route.ts
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/pdfExport.ts
scripts/web-smoke.mjs
scripts/smoke-fixture.mjs

Implementation guidance

- Keep /sheet HTML-first, readable, and easy to inspect.
- Prefer semantic grouping and simple CSS/layout rather than overengineering.
- Mirror the major reference-sheet sections without trying to clone the official art/design exactly.
- The route must remain payload-backed.
- Make the output useful for manual verification of current character state.

Constraints

- Do not change rules computation unless required for existing data exposure.
- Do not break /print.

Definition of done

- /sheet is substantially more complete and readable.
- It reflects the new fields and dynamic skills/tool rows.
- Web smoke and full harness remain green.

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
