Goal

Add optional builder support for narrative, currency, and attunement fields so the character sheet can be more fully populated.

Primary fields to support

Narrative
- appearance
- physicalDescription
- backstory
- alignment
- notes

Currency
- cp
- sp
- ep
- gp
- pp
- otherWealth

Attunement
- attunedItems (3-5 slots is fine; prefer a simple extensible list shape)

Files to inspect first

apps/web/app/builder/BuilderClient.tsx
apps/web/app/sheet/page.tsx
apps/web/app/api/export/pdf/route.ts
packages/rules/src/types.ts
packages/rules/src/validate.ts
packages/rules/src/pdfExport.ts

Implementation guidance

- Keep all these fields optional and non-blocking.
- Prefer a simple builder UI that is easy to wire into payloads.
- Ensure fields are preserved through export payloads.
- Make the attuned-item data shape reasonable for future extension.
- Do not overcomplicate validation; only enforce obvious shape correctness.

Constraints

- Do not redesign unrelated builder sections.
- Do not implement item attunement rules logic in this prompt.

Definition of done

- Builder supports editing these fields.
- Payload-backed /sheet and PDF flows can render them.
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
