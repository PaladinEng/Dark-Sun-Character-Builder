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

## Immediate Next-Step Commands
1. `git status --short`
2. `pnpm loop:check`
3. `git log --oneline --decorate -5`
