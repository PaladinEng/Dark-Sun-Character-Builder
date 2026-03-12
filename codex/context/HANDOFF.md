# Handoff

## Start-of-Session Checklist
1. Read `AGENTS.md`.
2. Read `codex/context/PROJECT_STATE.md`.
3. Read `codex/context/WORK_QUEUE.md`.
4. Check git status and current branch/tag state.

## Current Dark Sun / Tooling Status
- Dark Sun species/background replacement and spell-list overrides are still active and validated.
- `pnpm verify` is green again.
- The repo is now pinned to Node 24 through:
  - `.nvmrc`
  - `.node-version`
  - root/workspace `package.json` `engines.node`
  - `.github/workflows/verify.yml`
  - `README.md`
- `@types/node` is now aligned to Node 24 across the root workspace and current packages.
- The local shell used for the last validation was still `v20.20.1`, so engine warnings are expected until the machine switches to Node 24.
- `scripts/web-build-stable.mjs` and `scripts/web-build-check.mjs` now retry and classify broader `.next` artifact races, including cleanup failures while removing `.next`.
- `verify` now uses a non-destructive SRD seed import check:
  - `pnpm import:seed` still writes into `apps/web/content/packs/srd52`
  - `pnpm import:seed:check` writes into `codex/harness/import-seed-check/srd52`
  - `pnpm verify` calls `import:seed:check`
- `packages/content/test/content.test.ts` now allows partial manifest overrides in `makePack()`, which fixed the content-package typecheck failure.

## Validation Commands
1. `node -v`
2. `pnpm --filter @dark-sun/content typecheck`
3. `pnpm verify`
4. `pnpm install`
5. `pnpm --filter web build`
6. `pnpm loop:check`

## Immediate Next-Step Commands
1. `nvm use`
2. `node -v`
3. `pnpm loop:check`

## Known Boundaries
- Do not push unless explicitly asked.
- Do not deploy unless explicitly asked.
- Elemental Cleric still uses the authored `darksun:spelllist:elemental-cleric:*` lists, not the elemental tradition CSV.
- No explicit psionics CSV is present in `homebrew-spell-lists/`; the local psionics JSON artifact is synthesized from master status data.
- The local Next.js artifact flake still appears to be upstream/framework behavior rather than a Dark Sun content bug; current mitigation is bounded clean retries plus artifact assertions.
