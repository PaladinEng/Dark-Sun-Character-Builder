Goal

Audit the SRD content packs against what the builder currently needs for robust SRD character creation within the engine's present scope.

This prompt should primarily identify gaps and fix obvious content/data issues that prevent end-to-end SRD builder coverage.

Use only SRD-authorized material.

Primary audit areas

- species
- backgrounds
- classes
- subclasses if supported by current engine/UI
- feats
- equipment
- weapons
- armor
- tools
- gaming sets
- instruments if modeled
- spells
- spell lists
- languages
- skill definitions
- proficiency grants
- starting equipment references
- class feature references
- dangling refs / broken refs / missing entities

Files to inspect first

apps/web/content/packs/srd52/_seed/seed.json
apps/web/content/packs/srd52/classes/*.json
apps/web/content/packs/srd52/species/*.json
apps/web/content/packs/srd52/backgrounds/*.json
apps/web/content/packs/srd52/equipment/*.json
apps/web/content/packs/srd52/features/*.json
apps/web/content/packs/srd52/spells/*.json
apps/web/content/packs/srd52/spelllists/*.json
packages/content/src/entities.ts
packages/content/src/lint.ts
packages/content/src/normalize.ts
packages/content/src/proficiencies.ts
packages/content/test/*.ts
apps/web/app/builder/BuilderClient.tsx
packages/rules/src/types.ts

Implementation guidance

- Produce concrete content fixes where the gap is obvious and low-risk.
- Improve lint/test coverage if needed to catch the identified class of issue.
- Stay within current engine/schema capabilities.
- Do not try to invent unsupported mechanics.
- Prefer fixing references, missing entities, and coverage holes that are clearly required by the builder.

Constraints

- Use only SRD-authorized content.
- Do not add non-SRD copyrighted material.
- Do not add broad new rules systems in this prompt.

Definition of done

- The SRD pack is better aligned with current builder expectations.
- Obvious coverage/ref issues are fixed.
- Harness remains green.
- If any meaningful gaps remain, they should be made obvious through code/tests/lint rather than hidden.

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
