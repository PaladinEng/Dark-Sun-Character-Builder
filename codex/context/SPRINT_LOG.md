# Sprint Log

Append one dated section per completed work block.

## 2026-03-11 - Dark Sun Bundle Ingest
- Scope: Ingest the repo-root `dark-sun-homebrew/` bundle into the native Dark Sun content pack, add setting-aware builder filtering/notes, and preserve unsupported mechanics as explicit stubs/TODO metadata.
- Result: PASS.
- Validation:
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `scripts/ingest-dark-sun-homebrew.mjs`
  - `apps/web/content/packs/darksun/**`
  - `apps/web/src/lib/packSettings.ts`
  - `apps/web/app/builder/page.tsx`
  - `apps/web/app/builder/BuilderClient.tsx`
  - `packages/content/src/proficiencies.ts`
  - `codex/context/*`
- Notable outcomes:
  - Elemental Cleric imported as native class + domain subclasses/features.
  - Dark Sun skills, Wild Talent table, language/tradition metadata, Preserver/Defiler metadata, Psionicist stub, and Athasian Bard stub were wired into the pack.
  - Cleric replacement is enforced through Dark Sun setting filtering instead of content-layer replacement to keep SRD cleric subclass references valid.

## 2026-03-11 - Dark Sun Smoke Test And Audit
- Scope: Audit the Dark Sun builder integration, verify the setting/content wiring, fix concrete Dark Sun smoke-test issues, and keep the harness green.
- Result: PASS.
- Validation:
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `apps/web/src/lib/packSettings.ts`
  - `apps/web/app/builder/BuilderClient.tsx`
  - `codex/context/*`
- Findings:
  - Dark Sun species, backgrounds, custom skills, setting metadata, and Elemental Cleric content were present.
  - The Dark Sun setting profile was loaded, but SRD `Cleric` was still visible because `classReplacements` were not being applied as class bans.
- Fixes:
  - Replaced classes are now hidden by the Dark Sun setting filter.
  - Dark Sun class restriction notes now render human-readable class names after filtering.
