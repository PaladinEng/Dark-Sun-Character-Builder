Goal

Add or improve extended spell-list pages in the PDF so characters with larger spell lists can be rendered usefully.

Primary goals

- Add a more complete spell list table.
- Support extended spell lists across additional page space.
- Render as many of these fields as are available from content/state:
  - level
  - name
  - school
  - casting time
  - range
  - duration
  - components
  - notes
  - page/reference

Files to inspect first

apps/web/app/api/export/pdf/route.ts
packages/rules/src/pdfExport.ts
packages/rules/src/types.ts
packages/content/src/entities.ts
apps/web/src/lib/spells.ts
scripts/api-smoke.mjs
scripts/pdf-sanity.mjs

Implementation guidance

- Keep the table readable.
- Use continuation pages if needed.
- Do not require all metadata fields to exist; degrade gracefully.
- Prefer deterministic, well-structured output over visual complexity.

Constraints

- Do not break the simpler non-caster PDFs.
- Do not overcouple rendering to optional metadata.

Definition of done

- Larger spell lists have usable PDF space.
- Available spell metadata is shown where present.
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
