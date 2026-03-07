Goal

Expand the builder/export state and PDF snapshot schema so the system can represent the major fields present in the official 5E 2024 character sheet.

Reference asset

Use this file as the layout/field reference only:
apps/web/assets/sheets/DLDM - 5E24 CHARACTER SHEET - 5pg - Updated Form Fields.pdf

Do NOT copy protected text from it into source. Use it only to understand which fields exist and where they belong.

Primary goals

Add support or placeholder support for the following field groups:

Identity
- subclass
- xp
- heroicInspiration

Combat / survivability
- shieldAC or distinct shield contribution if appropriate
- tempHP
- hitDiceTotal
- hitDiceSpent
- deathSaveSuccesses
- deathSaveFailures
- exhaustionLevel

Spellcasting summary
- spellcastingAbility
- spellcastingModifier

Equipment / proficiencies
- armorProficiencies
- weaponProficiencies
- toolProficiencies
- languages

Currency
- cp
- sp
- ep
- gp
- pp
- otherWealth

Attunement
- attunedItems

Narrative
- appearance
- physicalDescription
- backstory
- alignment
- notes

Companion / familiar placeholder support
- optional companion/familiar section placeholder fields only
- do not implement full companion rules engine logic in this prompt

Files to inspect first

package.json
scripts/loopdev-check.mjs
apps/web/app/builder/BuilderClient.tsx
apps/web/app/api/export/pdf/route.ts
apps/web/app/sheet/page.tsx
packages/rules/src/types.ts
packages/rules/src/index.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
packages/rules/src/pdfExport.ts

Implementation guidance

- Make the smallest coherent schema changes needed.
- Prefer exposing already derivable values rather than inventing new rules logic.
- If a field is not yet truly modeled, add it as an optional placeholder in state/export shape rather than forcing fake computation.
- Keep backward compatibility where practical.
- Do not make broad refactors unless required to keep the design coherent.

Constraints

- Do not introduce gameplay automation.
- Do not add non-SRD content.
- Do not attempt to fully implement companion mechanics.
- Keep rules deterministic.

Definition of done

- Builder/export/schema shapes can carry all listed fields or placeholders.
- PDF and /sheet consumers can safely read the new fields without shape errors.
- Existing harness remains green.

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
