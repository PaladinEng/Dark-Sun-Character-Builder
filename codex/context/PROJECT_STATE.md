# Project State

Last updated:
- 2026-03-11 EDT

## Current Objective
- Stabilize local Dark Sun validation after the tradition spell-list import, add focused Dark Sun smoke coverage, and harden the harness against flaky Next.js build/dev artifact failures.

## Repository Snapshot
- Branch: `main`
- HEAD at last context refresh: `9ea55db`
- Harness status for this pass:
  - `pnpm loop:check` -> `=== ALL_PASS ===`

## Completed Work (Current Session)
- Kept the normalized Dark Sun pack in place under `apps/web/content/packs/darksun` with:
  - 13 backgrounds
  - 8 Athasian species
  - Elemental Cleric class and elemental domain subclasses
  - Dark Sun skills, setting metadata, Wild Talent data, Psionicist stub, and Athasian Bard stub
- Audited Dark Sun setting selection and content filtering in the builder.
- Fixed the concrete Dark Sun bug found during the audit:
  - classes listed in `classReplacements` are now treated as unavailable in Dark Sun mode, so SRD `Cleric` no longer appears alongside `Elemental Cleric`
- Improved Dark Sun builder notes so restricted classes resolve to display names even after filtering.
- Reconfirmed the closed-loop harness with `pnpm loop:check`.
- Fixed internal workspace resolution for `@dark-sun/content` so web builds do not depend on a prebuilt `packages/content/dist` directory:
  - `packages/content/package.json` now exposes workspace source entrypoints
  - `apps/web/next.config.ts` now transpiles both `@dark-sun/content` and `@dark-sun/rules`
- Re-ran `pnpm install`, `pnpm --filter web build`, and `pnpm loop:check`.
- Added repo-level Vercel deployment guidance:
  - `vercel.json` now declares the monorepo install/build commands and `nextjs` framework preset without forcing an output directory
  - `README.md` now documents the expected Vercel project settings and explicitly warns against `Output Directory = public`
- Confirmed the remaining failure mode is a Vercel dashboard override, not a local build problem.
- Recreated the Vercel project from the CLI, connected the GitHub repo, and patched the live project settings to:
  - `framework = nextjs`
  - `rootDirectory = apps/web`
  - `installCommand = pnpm install`
  - `buildCommand = pnpm --filter web build`
  - `outputDirectory = Next.js default`
  - `sourceFilesOutsideRootDirectory = true`
- Removed the repo-root `vercel.json` because it conflicts with the new `apps/web` project root and causes an unnecessary Vercel CLI warning.
- Kept `.vercel` ignored in git via `.gitignore`.
- Fixed Dark Sun species/background availability so the setting now behaves as a replacement list instead of merging with SRD options:
  - `apps/web/src/lib/packSettings.ts` now supports setting-level `speciesReplacementIds` and `backgroundReplacementIds`
  - `apps/web/content/packs/darksun/settings/profile.json` now declares the exact Athasian species whitelist and Dark Sun background whitelist
  - `scripts/ingest-dark-sun-homebrew.mjs` now regenerates those replacement lists so the behavior is stable across future ingests
- Verified the replacement behavior locally:
  - Dark Sun species resolve to exactly 8 options
  - Dark Sun backgrounds resolve to exactly 13 options
  - SRD `Human` and SRD `Acolyte` no longer appear as builder option ids in Dark Sun mode
- Imported the repo-root `homebrew-spell-lists/` CSV dataset into local JSON/native content layers:
  - `homebrew-spell-lists/*.json` now preserve the full CSV rows plus native spell-id mappings
  - `apps/web/content/packs/darksun/spells/` now contains 425 generated native Dark Sun spell entities for rows not already covered by SRD spell ids
  - `apps/web/content/packs/darksun/spelllists/tradition-*.json` now provide native Arcane, Divine, Nature, Elemental, and Psionics tradition spell lists
  - `homebrew-spell-lists/elemental-cleric-vs-elemental-tradition-report.md` compares the existing Elemental Cleric lists against the elemental tradition CSV without changing the authoritative Elemental Cleric lists
- Added Dark Sun-only class spell-list overrides:
  - Wizard -> `darksun:spelllist:tradition:arcane`
  - Warlock -> `darksun:spelllist:tradition:arcane`
  - Druid -> `darksun:spelllist:tradition:nature`
  - Ranger -> `darksun:spelllist:tradition:nature`
  - Elemental Cleric remains on `darksun:spelllist:elemental-cleric:shared`
- Reconfirmed locally that SRD-only mode keeps the original SRD core spell lists for Wizard, Warlock, Druid, and Ranger.
- Investigated the current local regression after the spell-list import:
  - clean `next build` oscillated between missing `.next/server/pages-manifest.json` and missing `.nft.json` trace files
  - the old `apps/web` build script masked that by retrying inline
- Added focused local regression coverage:
  - `scripts/darksun-content-smoke.mjs` validates merged-content generation for `srd52` and `srd52,darksun`
  - the smoke asserts Dark Sun species replacement, Dark Sun background replacement, and Dark Sun class spell-list overrides for Wizard, Warlock, Druid, Ranger, and Elemental Cleric
- Hardened the harness/build path:
  - `scripts/web-build-check.mjs` now reports explicit Next artifact failure classes and verifies required `.next/server` artifacts
  - `scripts/loopdev-check.mjs` now runs the Dark Sun smoke stage before the web stages
  - `scripts/web-build-stable.mjs` now provides a bounded clean-retry wrapper for `pnpm --filter web build` so manual local builds can recover from the known Next artifact flake
- Added local Next.js stabilization files/config for the hybrid app/pages setup:
  - `apps/web/pages/_app.tsx`
  - `apps/web/pages/_document.tsx`
  - `apps/web/pages/_error.tsx`
  - `apps/web/pages/404.tsx`
  - `apps/web/app/not-found.tsx`
  - `apps/web/next.config.ts` now sets `outputFileTracingRoot` and uses `compiler.runAfterProductionCompile` to materialize baseline manifest/trace placeholders needed by later build phases on this machine
- Repaired the workspace install after adding `caniuse-lite` for Next dev bootstrap:
  - `apps/web/package.json` now includes `caniuse-lite`
  - `pnpm install --force` repaired the workspace symlink graph after a transient broken install state
- Final local validation for this pass:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===`

## Remaining Limitations (Explicit)
- Defiler casting remains a stub.
- Psionicist is selectable only as a stub class.
- Athasian Bard is selectable only as a stub subclass.
- Wild Talent currently supports table-backed selection/display only; mechanical effects are not automated.
- Elemental Cleric spell lists only reference spells that already exist as native spell entities; unsupported source spells are preserved in `apps/web/content/packs/darksun/settings/elemental-cleric-spell-source.json`.
- Dark Sun language rules are surfaced in setting metadata/UI notes, not a full language-pick workflow.
- The repo-root `homebrew-spell-lists/` directory remains local and untracked in git for this pass.
- No standalone `psionics_spell_list_v2_balanced.csv` was present in `homebrew-spell-lists/`; the local JSON artifact was synthesized from the master CSV rows where `Psionics Status` is not `Hard Ban`.
- The Next.js clean-build issue appears to be an upstream/local artifact-generation flake rather than a Dark Sun content bug; local builds are currently stabilized by bounded retries plus artifact assertions, not by a confirmed upstream root-cause fix.

## Notes for Next Runner Session
- If the Dark Sun source bundle changes, regenerate with:
  - `node scripts/ingest-dark-sun-homebrew.mjs`
- Keep Dark Sun filtering data-driven via:
  - `apps/web/content/packs/darksun/settings/*.json`
  - `apps/web/src/lib/packSettings.ts`
- For Dark Sun mode, species/background availability is now controlled by setting-level replacement ids rather than pack-merging alone.
- Dark Sun spell-list overrides are now applied at merged-content time in `apps/web/src/lib/content.ts`, driven by `classSpellListOverrides` in `apps/web/content/packs/darksun/settings/profile.json`.
- Full CSV preservation now lives in `homebrew-spell-lists/*.json`; native builder spell data uses `metadata` on generated spell and spell-list entities for source retention.
- Keep internal workspace packages consumable from source for web builds unless a deliberate dist-build pipeline replaces that approach.
- For Vercel, keep the project rooted at `apps/web`, keep `Output Directory` unset, and rely on the live project settings rather than a repo-root `vercel.json`.
- The harness now depends on:
  - `scripts/darksun-content-smoke.mjs`
  - `scripts/web-build-check.mjs`
  - `scripts/web-build-stable.mjs`
- If the Next artifact flake resurfaces more aggressively, inspect the retry output from `pnpm --filter web build` first before changing Dark Sun content wiring.
- Re-run `pnpm loop:check` after any content, builder, or context edit.
