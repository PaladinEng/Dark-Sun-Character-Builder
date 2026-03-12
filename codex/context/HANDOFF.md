# Handoff

## Start-of-Session Checklist
1. Read `AGENTS.md`.
2. Read `codex/context/PROJECT_STATE.md`.
3. Read `codex/context/WORK_QUEUE.md`.
4. Check git status and current branch/tag state.

## Current Dark Sun Status
- `apps/web/content/packs/darksun` now reflects the repo-root `dark-sun-homebrew/` bundle in native pack format.
- `apps/web/src/lib/packSettings.ts` loads Dark Sun setting metadata from `apps/web/content/packs/darksun/settings/`.
- Builder behavior now filters Dark Sun class/subclass availability, hides classes replaced by setting rules, replaces species/backgrounds via setting-defined whitelist ids, and surfaces Wild Talent + setting notes when `darksun` is enabled.
- Dark Sun spell-list overrides are now applied in `apps/web/src/lib/content.ts` after pack merge, driven by `classSpellListOverrides` in `apps/web/content/packs/darksun/settings/profile.json`.
- `scripts/import-homebrew-spell-lists.mjs` converts `homebrew-spell-lists/*.csv` into:
  - preserved JSON artifacts in `homebrew-spell-lists/*.json`
  - native Dark Sun spell entities in `apps/web/content/packs/darksun/spells/`
  - native tradition spell lists in `apps/web/content/packs/darksun/spelllists/tradition-*.json`
  - `homebrew-spell-lists/elemental-cleric-vs-elemental-tradition-report.md`
- `@dark-sun/content` is now consumed from workspace source, and `apps/web/next.config.ts` transpiles both internal packages needed for Next builds.
- The live Vercel project is now configured directly with:
  - root directory `apps/web`
  - framework `Next.js`
  - install command `pnpm install`
  - build command `pnpm --filter web build`
  - default Next.js output handling
- Unsupported systems remain explicit stubs:
  - Defiler casting
  - Psionicist mechanics
  - Athasian Bard mechanics
  - Wild Talent effects beyond selection/display
- Local regression coverage has been expanded:
  - `scripts/darksun-content-smoke.mjs` validates Dark Sun species/background replacement plus class spell-list overrides for Wizard, Warlock, Druid, Ranger, and Elemental Cleric.
  - `scripts/web-build-check.mjs` validates the Next build path and checks required `.next/server` artifacts.
  - `scripts/web-build-stable.mjs` is the developer-facing bounded clean-retry wrapper behind `pnpm --filter web build`.
- The hybrid app/pages local Next setup now also includes:
  - `apps/web/app/not-found.tsx`
  - `apps/web/pages/_app.tsx`
  - `apps/web/pages/_document.tsx`
  - `apps/web/pages/_error.tsx`
  - `apps/web/pages/404.tsx`
- `apps/web/next.config.ts` now sets `outputFileTracingRoot` and uses `compiler.runAfterProductionCompile` to materialize baseline placeholder files needed by later build phases on this machine.
- `apps/web/package.json` now includes `caniuse-lite` so `next dev` can resolve its compiled `browserslist` dependency chain consistently.

## Validation Commands
1. `pnpm install`
2. `pnpm --filter web build`
3. `pnpm loop:check`

## Known Engine Boundaries
- Dark Sun spell lists only include spells that already exist as native spell entities.
- Full language-pick enforcement is not yet implemented; the setting is currently surfaced as metadata and notes.
- Preserver/Defiler behavior is preserved in settings JSON, not automated in rules resolution.
- A Vercel dashboard-level `Output Directory` override can still break deployment; it must remain unset for this Next.js app.
- Do not reintroduce a repo-root `vercel.json` unless the Vercel project root moves back to `/`.
- Dark Sun species/background replacement now depends on `speciesReplacementIds` and `backgroundReplacementIds` in `apps/web/content/packs/darksun/settings/profile.json`.
- No explicit psionics CSV is present in `homebrew-spell-lists/`; the local psionics JSON artifact is synthesized from master status data and should be replaced if a real CSV arrives.
- Elemental Cleric still uses `darksun:spelllist:elemental-cleric:*`; the elemental tradition CSV is preserved separately and compared in the report only.
- The local Next.js artifact flake still appears to be upstream/framework behavior rather than a Dark Sun content bug; current mitigation is bounded clean retries plus artifact assertions.

## Immediate Next-Step Commands
1. `git status --short`
2. `pnpm loop:check`
3. `pnpm --filter web build`
