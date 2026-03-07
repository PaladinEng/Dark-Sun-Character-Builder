Goal

List tool proficiencies with the other skills in the character sheet/builder display region, but only show a tool proficiency if the character is actually proficient.

This includes kits and gaming sets.

Primary goals

- Add a derived display model for proficient tool rows.
- Show tool proficiencies in the same broad visual area as skills.
- Only render a tool row if the character is proficient.
- Include kits and gaming sets if they are modeled as tools/proficiencies.
- Keep normal skills and proficient tool rows conceptually distinct in the data model unless a cleaner unified display abstraction is preferable.

Files to inspect first

apps/web/app/builder/BuilderClient.tsx
apps/web/app/sheet/page.tsx
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
packages/content/src/proficiencies.ts
packages/content/src/entities.ts
packages/content/src/lint.ts
packages/rules/src/pdfExport.ts

Implementation guidance

- Prefer adding a derived "display rows" abstraction if that simplifies rendering.
- Do not show non-proficient tools.
- Preserve the normal skill list behavior.
- Keep the model extensible for future homebrew tool additions.
- Ensure builder, /sheet, and PDF use the same derived display logic where practical.

Constraints

- Do not turn all tools into base skills unless that is clearly justified by the existing architecture.
- Do not add unsupported gameplay logic.

Definition of done

- Proficient tool rows appear in the same skill/proficiency region.
- Non-proficient tools do not appear.
- Kits and gaming sets are included if proficient.
- Harness remains green.

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
