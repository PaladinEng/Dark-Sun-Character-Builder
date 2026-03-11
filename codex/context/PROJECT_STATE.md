# Project State

Last updated:
- 2026-03-11 EDT

## Current Objective
- Keep the Dark Sun builder deployment-ready by aligning the committed repo guidance with the live Vercel project settings: Next.js app root `apps/web`, explicit pnpm commands, and no repo-root Vercel config.

## Repository Snapshot
- Branch: `main`
- HEAD at last context refresh: `3368502`
- Harness status for this pass:
  - `pnpm install` -> PASS
  - `pnpm --filter web build` -> PASS
  - `pnpm loop:check` -> `=== ALL_PASS ===` after Vercel follow-up cleanup

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

## Remaining Limitations (Explicit)
- Defiler casting remains a stub.
- Psionicist is selectable only as a stub class.
- Athasian Bard is selectable only as a stub subclass.
- Wild Talent currently supports table-backed selection/display only; mechanical effects are not automated.
- Elemental Cleric spell lists only reference spells that already exist as native spell entities; unsupported source spells are preserved in `apps/web/content/packs/darksun/settings/elemental-cleric-spell-source.json`.
- Dark Sun language rules are surfaced in setting metadata/UI notes, not a full language-pick workflow.

## Notes for Next Runner Session
- If the Dark Sun source bundle changes, regenerate with:
  - `node scripts/ingest-dark-sun-homebrew.mjs`
- Keep Dark Sun filtering data-driven via:
  - `apps/web/content/packs/darksun/settings/*.json`
  - `apps/web/src/lib/packSettings.ts`
- Keep internal workspace packages consumable from source for web builds unless a deliberate dist-build pipeline replaces that approach.
- For Vercel, keep the project rooted at `apps/web`, keep `Output Directory` unset, and rely on the live project settings rather than a repo-root `vercel.json`.
- Re-run `pnpm loop:check` after any content, builder, or context edit.
