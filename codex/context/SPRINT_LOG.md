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

## 2026-03-11 - Dark Sun Regression Investigation And Harness Hardening
- Scope: Reproduce the local regression after the tradition spell-list import, harden the harness so the failure mode is visible earlier, and add focused Dark Sun override smoke coverage without pushing.
- Result: PASS.
- Validation:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `apps/web/next.config.ts`
  - `apps/web/package.json`
  - `apps/web/app/not-found.tsx`
  - `apps/web/pages/_app.tsx`
  - `apps/web/pages/_document.tsx`
  - `apps/web/pages/_error.tsx`
  - `apps/web/pages/404.tsx`
  - `package.json`
  - `pnpm-lock.yaml`
  - `scripts/loopdev-check.mjs`
  - `scripts/web-build-check.mjs`
  - `scripts/web-build-stable.mjs`
  - `scripts/darksun-content-smoke.mjs`
  - `codex/context/*`
- Findings:
  - The local regression was not a Dark Sun data-reference break. The concrete failure was flaky Next.js artifact generation on this machine:
    - missing `.next/server/pages-manifest.json`
    - missing `.next/server/**/*.nft.json`
  - The old `apps/web` build script masked this by retrying inline, so the harness could not classify the first failure clearly.
  - After adding `caniuse-lite`, the workspace symlink graph needed a forced reinstall before Vitest and Next dev resolved consistently again.
- Fixes:
  - Added a dedicated Dark Sun merged-content smoke script that validates species/background replacement and class spell-list overrides.
  - Added a dedicated web build check that verifies required build artifacts and reports explicit artifact failure classes.
  - Switched the developer-facing `pnpm --filter web build` command to a bounded clean-retry wrapper, while keeping the harness responsible for artifact assertions.
  - Added minimal app/pages fallback files plus `outputFileTracingRoot` and a `runAfterProductionCompile` placeholder hook to stabilize the hybrid app/pages local build path.
  - Added `caniuse-lite` to the web workspace and repaired the install with `pnpm install --force` after a transient broken pnpm symlink state.

## 2026-03-12 - Node 24 Pinning
- Scope: Pin the repo to Node 24 across local version files, package metadata, CI, and repo docs without pushing, then revalidate the local build/harness.
- Result: PASS.
- Validation:
  - `node -v` -> `v20.20.1` (manual machine switch to Node 24 still pending)
  - `pnpm install` -> PASS with engine warnings
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `.nvmrc`
  - `.node-version`
  - `package.json`
  - `apps/web/package.json`
  - `packages/content/package.json`
  - `packages/rules/package.json`
  - `.github/workflows/verify.yml`
  - `README.md`
  - `pnpm-lock.yaml`
  - `scripts/web-build-check.mjs`
  - `scripts/web-build-stable.mjs`
  - `codex/context/*`
- Findings:
  - The repo had no committed local version files and CI was still pinned to Node 20.
  - The current shell remains on Node 20, so the new engine pin emits warnings until the machine switches to Node 24.
  - The existing local Next artifact race needed one more round of retry/cleanup hardening to keep the harness green after the reinstall.
- Fixes:
  - Added `.nvmrc` and `.node-version` with `24`.
  - Added `engines.node = 24.x` across the root workspace and all current packages.
  - Upgraded `@types/node` to `^24.0.0` across the same packages.
  - Updated GitHub Actions verification to use Node 24.
  - Documented Node 24 as the supported version in `README.md`.
  - Generalized the web-build retry classifier to cover broader `.next` `ENOENT`/`ENOTEMPTY` races and added bounded cleanup retries for `.next` removal.

## 2026-03-12 - Verify Fix For Content Typecheck
- Scope: Fix the `@dark-sun/content` typecheck regression in `verify.yml`, then make `pnpm verify` non-destructive so it no longer rewrites the checked-in SRD pack during validation.
- Result: PASS.
- Validation:
  - `pnpm --filter @dark-sun/content typecheck` -> PASS
  - `pnpm verify` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`
- Files touched:
  - `packages/content/test/content.test.ts`
  - `scripts/import_srd521_seed.ts`
  - `package.json`
  - `codex/context/*`
- Findings:
  - The immediate CI/typecheck failure came from a test helper type mismatch: `makePack()` rejected `manifest`, but the attribution test passed a manifest override.
  - `pnpm verify` also ran a destructive seed import into `apps/web/content/packs/srd52`, and the seed source is intentionally incomplete compared with the checked-in enriched SRD pack, so later validation failed after `verify` mutated the repo.
- Fixes:
  - Allowed partial manifest overrides in the content test helper and removed the unnecessary `as any` cast.
  - Added a non-destructive `--check` mode to `scripts/import_srd521_seed.ts` that imports into `codex/harness/import-seed-check/srd52`.
  - Changed `verify` to use `import:seed:check`, while keeping manual `import:seed` behavior unchanged.
