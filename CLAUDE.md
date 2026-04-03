# Dark Sun Character Builder

A browser-based D&D 2024 character builder for Alwyn's Dark Sun homebrew campaign, built as a TypeScript monorepo with Next.js frontend and a separated rules engine.

## Local Path
~/projects/dark-sun-character-builder

## GitHub
https://github.com/PaladinEng/Dark-Sun-Character-Builder

## Session Start
```bash
cd ~/projects/dark-sun-character-builder
cat context/STATUS.md
cat context/WORKQUEUE.md
```

## Session End
1. Update context/STATUS.md with work completed
2. Commit changes
3. Print FINISHED WORK

## Key Commands
- `pnpm install` — Install dependencies (requires Node 24)
- `pnpm loop:check` — **Mandatory** validation harness — must pass before every commit
- `pnpm start:dev` — Start dev server
- `pnpm verify` — Full verification

## Mandatory Rules
1. **Always run `pnpm loop:check`** after code changes. Never bypass it.
2. **Edit in place** — never create copy-style duplicate files.
3. **Never commit** unless `pnpm loop:check` is green.

## Monorepo Structure
- `apps/web` — Next.js UI
- `packages/rules` — Character rules engine
- `packages/content` — Content packs and normalization
- `scripts/loopdev-check.mjs` — Validation harness
- `context/` — Paladin compliance files (STATUS, WORKQUEUE, DECISIONS, AGENTS, meta)
