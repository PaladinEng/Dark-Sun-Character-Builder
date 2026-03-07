Goal

Harden the PDF renderer against overflow and improve spacing/alignment so the generated PDF is more robust and visually consistent.

Primary goals

- Add helper logic for page-space checking and page breaks where needed.
- Prevent overlapping text.
- Normalize margins, spacing, borders, and section rhythm.
- Improve alignment of tables/columns.
- Keep the layout readable across a wider range of characters.

Files to inspect first

packages/rules/src/pdfExport.ts
apps/web/app/api/export/pdf/route.ts
scripts/api-smoke.mjs
scripts/pdf-sanity.mjs
codex/harness/pdf-sanity.json

Implementation guidance

- Prefer small helper abstractions such as ensurePageSpace(height) if appropriate.
- Build on the current renderer rather than replacing it wholesale.
- Keep the output deterministic.
- Favor robustness over excessive ornamentation.

Constraints

- Do not change rules logic.
- Do not reduce existing field coverage.

Definition of done

- PDFs are less likely to overflow/overlap.
- Layout spacing is noticeably improved.
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
