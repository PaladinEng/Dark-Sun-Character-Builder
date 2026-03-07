Goal

Convert skills from a hardcoded UI/rendering list into a content-driven system so that homebrew packs can add new skills.

Primary goals

- Skill definitions should come from content, not hardcoded arrays in the UI.
- The builder, /sheet, and PDF export should iterate over dynamic skill definitions.
- Homebrew packs must be able to add new skills.
- Each skill definition should include, at minimum:
  - id
  - name
  - governing ability
  - optional description/metadata if needed

Files to inspect first

apps/web/app/builder/BuilderClient.tsx
apps/web/src/lib/content.ts
apps/web/lib/content-packs.ts
packages/content/src/entities.ts
packages/content/src/normalize.ts
packages/content/src/seed.ts
packages/content/src/lint.ts
packages/content/src/index.ts
packages/rules/src/types.ts
packages/rules/src/compute.ts
packages/rules/src/validate.ts
apps/web/app/sheet/page.tsx
packages/rules/src/pdfExport.ts

Implementation guidance

- Keep the design content-driven and deterministic.
- Add the minimum schema support needed for a new "skill definition" entity shape if it does not already exist.
- Prefer adding skill-definition support in content/normalization/lint rather than hardcoding exceptions in the builder.
- Preserve existing SRD skills while allowing additional homebrew skills.
- Ensure skill modifiers are still computed correctly from the governing ability and proficiency state.
- Update /sheet and PDF consumers to render dynamic rows rather than fixed skill lists where appropriate.

Constraints

- Do not add non-SRD content in this prompt.
- Do not mix tool proficiencies into the base skill-definition model unless it is clearly the cleanest architecture.
- Keep public behavior backward compatible where possible.

Definition of done

- Skills are content-driven.
- Existing standard skills still render correctly.
- New homebrew skills can be added through content packs.
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
