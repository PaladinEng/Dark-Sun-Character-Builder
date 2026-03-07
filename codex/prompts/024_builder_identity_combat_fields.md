Goal

Add builder support for the newly required identity and combat-adjacent fields so they can be edited, persisted in payloads, and displayed in /sheet and PDF.

Primary fields to support

Identity
- subclass
- xp
- heroicInspiration

Combat / survivability
- tempHP
- hitDiceTotal
- hitDiceSpent
- deathSaveSuccesses
- deathSaveFailures
- exhaustionLevel

Files to inspect first

apps/web/app/builder/BuilderClient.tsx
apps/web/app/print/page.tsx
apps/web/app/sheet/page.tsx
apps/web/app/api/export/pdf/route.ts
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
packages/rules/src/pdfExport.ts

Implementation guidance

- Add these as builder-editable state where appropriate.
- Ensure they round-trip through payload encoding/decoding.
- Keep UI simple and functional; this prompt is about support, not final polish.
- If subclass is already implicitly derivable from class content, still expose it in a way the sheet/PDF can display it clearly.
- Validate obvious numeric ranges where appropriate, but do not overbuild validation.

Constraints

- Do not redesign the whole builder UI.
- Do not introduce gameplay automation.

Definition of done

- These fields can be entered or carried through the builder.
- They appear in payload-backed flows.
- /sheet and PDF can consume them.
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
