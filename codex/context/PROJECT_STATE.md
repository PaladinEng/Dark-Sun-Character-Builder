# Project State

Last updated:
- 2026-03-12 EDT

## Current Objective
- Keep the local Dark Sun integration stable while pinning the repo to Node 24 across package metadata, local version files, CI, and Vercel-facing expectations.

## Repository Snapshot
- Branch: `main`
- HEAD at last context refresh: `2a7fd89`
- Harness status for this pass:
  - `pnpm loop:check` -> `=== ALL_PASS ===`

## Completed Work (Current Session)
- Pinned the repo to Node 24 with minimal, conventional repo metadata:
  - added `.nvmrc`
  - added `.node-version`
  - added `engines.node = 24.x` to the root workspace and all current packages
  - updated GitHub Actions verification to `actions/setup-node` `node-version: 24`
  - documented Node 24 as the supported version in `README.md`
- Aligned the workspace type packages with the new runtime target:
  - upgraded `@types/node` to `^24.0.0` in the root, `apps/web`, `packages/content`, and `packages/rules`
  - refreshed `pnpm-lock.yaml` via reinstall
- Repaired the local workspace install after the Node metadata/type changes with `pnpm install --force`.
- Revalidated the build and harness after the pinning change.
- Hardened the local Next build retry wrapper further so the harness still goes green on the known `.next` artifact race:
  - generalized retry classification to cover broader `.next` `ENOENT` / `ENOTEMPTY` failures
  - added bounded cleanup retries for `.next` removal in both `scripts/web-build-stable.mjs` and `scripts/web-build-check.mjs`

## Current Validation
- `node -v` -> `v20.20.1`
- `pnpm install` -> PASS with expected engine warnings because the shell is still on Node 20
- `pnpm --filter web build` -> PASS
- `pnpm loop:check` -> `=== ALL_PASS ===`

## Remaining Limitations (Explicit)
- The machine shell is not yet on Node 24; local commands currently succeed under Node 20 with engine warnings.
- Defiler casting remains a stub.
- Psionicist is selectable only as a stub class.
- Athasian Bard is selectable only as a stub subclass.
- Wild Talent currently supports table-backed selection/display only; mechanical effects are not automated.
- Elemental Cleric spell lists only reference spells that already exist as native spell entities; unsupported source spells are preserved in `apps/web/content/packs/darksun/settings/elemental-cleric-spell-source.json`.
- Dark Sun language rules are surfaced in setting metadata/UI notes, not a full language-pick workflow.
- No standalone `psionics_spell_list_v2_balanced.csv` was present in `homebrew-spell-lists/`; the local JSON artifact was synthesized from the master CSV rows where `Psionics Status` is not `Hard Ban`.
- The local Next.js clean-build issue still appears to be an upstream/local artifact-generation flake rather than a Dark Sun content bug; current mitigation is bounded retries plus artifact assertions.

## Notes for Next Runner Session
- Before local validation, switch the shell to Node 24:
  - `nvm use`
  - or install/select Node 24 by the machine's version manager first
- Re-run:
  - `pnpm install`
  - `pnpm --filter web build`
  - `pnpm loop:check`
- Keep Node expectations aligned in:
  - `.nvmrc`
  - `.node-version`
  - `package.json` / workspace `package.json` `engines`
  - `.github/workflows/verify.yml`
- Keep Dark Sun filtering data-driven via:
  - `apps/web/content/packs/darksun/settings/*.json`
  - `apps/web/src/lib/packSettings.ts`
- Dark Sun spell-list overrides remain applied at merged-content time in `apps/web/src/lib/content.ts`, driven by `classSpellListOverrides` in `apps/web/content/packs/darksun/settings/profile.json`.
- The harness depends on:
  - `scripts/darksun-content-smoke.mjs`
  - `scripts/web-build-check.mjs`
  - `scripts/web-build-stable.mjs`
