# CONTEXT — Dark Sun Character Builder
Created: 2026-03-28 | Owner: PaladinEng | Entity: paladin-robotics

## Overview
A browser-based D&D 2024 (5.5e) character builder tailored for Alwyn's Dark Sun
homebrew campaign. Dark Sun is a post-apocalyptic desert world with unique
races, classes, and magic restrictions — the builder captures all the
mechanical differences from standard 5.5e, including Athasian flavor
(defiler/preserver magic, psionics, elemental clerics, custom races like mul and
thri-kreen).

The project is a TypeScript monorepo with a Next.js frontend and a rules engine
that enforces character-creation rules, separated from the UI layer. A
closed-loop validation harness (`pnpm loop:check`) is the non-negotiable quality
gate — no commit is valid without passing it. The project was originally
developed with a Codex prompt-queue workflow for staged feature work; that
workflow is migrating to Claude Code via the Codex Project Orchestrator.

The long-term commercial goal is to generalize the system so other DMs can plug
in their own homebrew content packs, with the Dark Sun rules and content serving
as the reference implementation of what a content pack looks like.

## Goals
- Complete, accurate character creation for Alwyn's Dark Sun campaign
- Rules engine that enforces Athasian restrictions (no divine magic, defiler
  consequences, elemental cleric overhaul)
- Printable character sheet with correct layout for table use
- Codex/Claude automation workflow for staged development via prompt queue
- Long-term: generalized homebrew content-pack system for commercial use by other DMs

## Architecture
- **Frontend:** Next.js (TypeScript), browser-based — `apps/web`
- **Rules engine:** TypeScript, separated from UI — `packages/rules`
- **Content system:** content-pack abstraction (Dark Sun is the first pack) — `packages/content`
- **Validation:** `pnpm loop:check` — closed-loop harness, must pass before every commit (`scripts/loopdev-check.mjs`)
- **Monorepo:** pnpm workspaces, pinned to Node 24 (local, CI, Vercel)
- **Deploy:** Next.js app on Vercel, project root `apps/web`
- **GitHub:** https://github.com/PaladinEng/Dark-Sun-Character-Builder

## Background Knowledge
- Dark Sun 2nd Edition (1991) is the source setting; rules are bridged to D&D 5.5e (2024)
- Athasian scarcity is a core design constraint: metal is rare, magic corrupts the world
- Elemental Clerics are fully rewritten — they worship elemental forces, not gods
- Spells that trivialize Athasian scarcity (e.g. Create Food and Water) must be excluded or restricted
- The validation harness catches rule violations and duplicate content — never bypass it
- Duplicate file creation has caused bugs before — always edit in place, never create new files for existing content
- The Codex prompt-queue workflow stages work items as files in a queue directory and processes them one at a time
- Repo is pinned to Node 24 via `.nvmrc` / `.node-version`; Vercel project root is `apps/web` (no repo-root `vercel.json`)

## Key Files & Repos
- GitHub: https://github.com/PaladinEng/Dark-Sun-Character-Builder
- Working dir: ~/projects/dark-sun-character-builder
- Validation: `pnpm loop:check`

## Related Projects
- dark-sun-rag: provides lore/rules lookup for campaign use (not builder-integrated yet)
- dark-sun-assistant-gm: in-session tool that consumes character data from the builder
- codex-project-orchestrator: the workflow automation backbone being migrated to Claude Code
