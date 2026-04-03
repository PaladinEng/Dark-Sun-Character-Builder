# AGENTS — Dark Sun Character Builder

## Project Purpose
A browser-based D&D 2024 character builder tailored for Alwyn's Dark Sun homebrew campaign. Dark Sun is a post-apocalyptic desert world with unique races, classes, and magic restrictions. The builder captures all mechanical differences from standard D&D 5.5e, including Athasian flavor (defiler/preserver magic, psionics, elemental clerics, custom races like mul and thri-kreen).

Long-term goal: generalize the system so other DMs can plug in their own homebrew content packs.

## Key Paths
- `apps/web` — Next.js frontend
- `packages/rules` — Character rules engine
- `packages/content` — Content packs and normalization
- `scripts/loopdev-check.mjs` — Closed-loop validation harness
- `context/` — Paladin compliance context files

## Key Commands
- `pnpm install` — Install dependencies
- `pnpm loop:check` — Mandatory validation harness (MUST pass before any commit)
- `pnpm start:dev` — Start development server
- `pnpm verify` — Full verification

## Mandatory Rules
1. Run `pnpm loop:check` after any code modification. Work is NOT complete until it passes.
2. Edit existing files in place — never create copy-style siblings.
3. Never bypass the validation harness.

## Context Files
- [STATUS.md](./STATUS.md) — Current project state
- [WORKQUEUE.md](./WORKQUEUE.md) — Prioritized task queue
- [DECISIONS.md](./DECISIONS.md) — Architecture decision log
- [CONTEXT.md](../CONTEXT.md) — Architecture overview and background
- [meta.yaml](./meta.yaml) — Project metadata
