Goal

Populate the SRD content packs so the builder can support fuller SRD character creation within the current engine and schema scope.

Use only SRD-authorized material.

Scope

Populate or complete SRD content for currently supported builder capabilities, including as applicable:

- species
- backgrounds
- classes
- subclasses if already supported
- class features
- feats
- skill definitions
- equipment
- weapons
- armor
- tools / kits / gaming sets
- proficiencies
- languages
- spells
- spell lists
- starting equipment references

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
apps/web/app/builder/BuilderClient.tsx
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
fixtures/characters/

Implementation guidance

- Build on the results of the SRD audit prompt.
- Only add content that is compatible with the current engine/schema.
- Prefer broad SRD builder completeness over niche edge-case mechanics.
- Keep IDs, references, and normalization coherent.
- Add or update tests/fixtures if needed to protect the added content coverage.

Constraints

- Use only SRD-authorized content.
- Do not add non-SRD copyrighted material.
- Do not add unsupported mechanics just to force content in.

Definition of done

- SRD content coverage is materially more complete for actual builder use.
- Content lint remains green.
- Full harness remains green.

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
