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

## 2026-03-11 - Vercel Workspace Resolution Fix
- Scope: Fix `@dark-sun/content` monorepo resolution so Next/Vercel builds do not fail when `packages/content/dist` is absent.
- Result: PASS.
- Validation:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `packages/content/package.json`
  - `apps/web/next.config.ts`
  - `codex/context/*`
- Fixes:
  - `@dark-sun/content` now exposes workspace source entrypoints instead of requiring prebuilt dist output.
  - Next now transpiles both internal workspace packages consumed by the app: `@dark-sun/content` and `@dark-sun/rules`.

## 2026-03-11 - Vercel Next.js Deployment Settings
- Scope: Align the monorepo's committed Vercel config/docs with a standard Next.js deployment and document the dashboard settings required to avoid static-site output errors.
- Result: PASS.
- Validation:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `vercel.json`
  - `README.md`
  - `codex/context/*`
- Findings:
  - No committed repo config was forcing `Output Directory = public`.
  - The bad `public` output expectation is consistent with a Vercel dashboard override on the project itself.
- Fixes:
  - Added repo-level Vercel config for `framework`, `installCommand`, and `buildCommand` without setting `outputDirectory`.
  - Documented the required dashboard settings and the fact that `Output Directory` must remain unset for this Next.js deployment.

## 2026-03-11 - Vercel Project Recreation And Cleanup
- Scope: Recreate the Vercel project from the CLI, connect GitHub, patch the live monorepo settings to the real app root, and remove the now-conflicting repo-root Vercel config.
- Result: PASS.
- Validation:
  - Production deployment `https://dark-sun-character-builder.vercel.app` -> READY
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `.gitignore`
  - `README.md`
  - `codex/context/*`
- Fixes:
  - Live Vercel project now uses `apps/web` as the root directory with `Next.js` framework detection and explicit pnpm commands.
  - Git auto-deploy is connected to `PaladinEng/Dark-Sun-Character-Builder` on branch `main`.
  - Removed the need for a repo-root `vercel.json`, which only generated warnings once the project root moved to `apps/web`.

## 2026-03-11 - Dark Sun Species And Background Replacement
- Scope: Fix Dark Sun setting behavior so species and backgrounds are replaced by setting-defined whitelists instead of merging with SRD content.
- Result: PASS.
- Validation:
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `apps/web/src/lib/packSettings.ts`
  - `apps/web/content/packs/darksun/settings/profile.json`
  - `scripts/ingest-dark-sun-homebrew.mjs`
  - `codex/context/*`
- Findings:
  - Class restrictions were already applied in the setting filter, but species/backgrounds still came from the merged content pool because the setting profile had no replacement ids for those categories.
- Fixes:
  - Added `speciesReplacementIds` and `backgroundReplacementIds` to Dark Sun setting parsing and restriction application.
  - Declared the exact 8 Athasian species ids and 13 Dark Sun background ids in the Dark Sun profile.
  - Updated the ingest script so future Dark Sun regenerations preserve the replacement behavior.

## 2026-03-11 - Dark Sun Tradition Spell Lists
- Scope: Convert the repo-root `homebrew-spell-lists/` CSV data into preserved JSON artifacts plus native Dark Sun spell/spell-list content, then override class spell lists only in Dark Sun mode.
- Result: PASS.
- Validation:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `scripts/import-homebrew-spell-lists.mjs`
  - `packages/content/src/entities.ts`
  - `apps/web/src/lib/packSettings.ts`
  - `apps/web/src/lib/content.ts`
  - `apps/web/content/packs/darksun/settings/profile.json`
  - `apps/web/content/packs/darksun/spells/**`
  - `apps/web/content/packs/darksun/spelllists/tradition-*.json`
  - `homebrew-spell-lists/*.json`
  - `homebrew-spell-lists/elemental-cleric-vs-elemental-tradition-report.md`
  - `scripts/ingest-dark-sun-homebrew.mjs`
  - `codex/context/*`
- Findings:
  - Native class spell-list wiring is simple: classes reference `spellListRefIds`, so Dark Sun overrides can be applied centrally by rewriting merged class spell-list refs instead of replacing class JSON.
  - No `psionics_spell_list_v2_balanced.csv` was present in the source folder; the local psionics JSON artifact was synthesized from master rows where `Psionics Status` is not `Hard Ban`.
- Fixes:
  - Added entity-level `metadata` support so generated native spells/spell lists can retain import provenance and source row details.
  - Generated 425 native Dark Sun spell entities for master-row spells not already covered by SRD ids and reused 92 existing SRD spell ids.
  - Added Dark Sun Arcane/Nature/Divine/Elemental/Psionics native spell lists, but only Arcane and Nature are active class overrides in Dark Sun mode.
  - Kept Elemental Cleric on the existing separately-developed spell lists and wrote a comparison report for later analysis.
