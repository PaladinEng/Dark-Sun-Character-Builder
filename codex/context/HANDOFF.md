# Handoff

## Start-of-Session Checklist
1. Read `AGENTS.md`.
2. Read `codex/context/PROJECT_STATE.md`.
3. Read `codex/context/WORK_QUEUE.md`.
4. Check git status and current branch/tag state.

## Current Dark Sun Status
- `apps/web/content/packs/darksun` now reflects the repo-root `dark-sun-homebrew/` bundle in native pack format.
- `apps/web/src/lib/packSettings.ts` loads Dark Sun setting metadata from `apps/web/content/packs/darksun/settings/`.
- Builder behavior now filters Dark Sun class/subclass availability, hides classes replaced by setting rules, and surfaces Wild Talent + setting notes when `darksun` is enabled.
- `@dark-sun/content` is now consumed from workspace source, and `apps/web/next.config.ts` transpiles both internal packages needed for Next builds.
- `vercel.json` now pins the monorepo to `pnpm install` + `pnpm --filter web build` with the `nextjs` framework preset and no explicit output directory.
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
- A Vercel dashboard-level `Output Directory` override can still break deployment even though the repo config is now correct; it must be unset for this Next.js app.

## Immediate Next-Step Commands
1. `git status --short`
2. `pnpm --filter web build`
3. `pnpm loop:check`
