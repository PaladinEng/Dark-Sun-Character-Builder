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

## Known Issues
<!-- Auto-updated by AERS on blocker resolution. Do not remove this section. -->
_No known issues at this time._


## Paladin Orchestration

This project is managed by the Paladin Control Plane (PCP).
Dashboard: https://dashboard.paladinrobotics.com

### Execution conventions
- Print FINISHED WORK as your absolute last action — after all commits
- Commit at each logical checkpoint during a task, not at the end
- Use conventional commit format: type(scope): description [ckpt N]
- Write blocker.json to the active task directory if you cannot proceed
- Read context/AGENTS.md and context/STATUS.md at every session start
- Update context/STATUS.md and context/WORKQUEUE.md before exiting

### Blocker reporting
If blocked, write ~/dev/queue/active/{task_name}/blocker.json:
  type: one of github-auth, api-down, missing-credential, path-issue,
        git-conflict, disk-full, service-crash, network-unreachable,
        missing-dependency, permission-denied, trust-prompt, unknown
  description: one sentence — what failed and why
  fix_instructions: exact steps to resolve
  resumable: true
  checkpoint_commit: last commit hash before blocker, or null
  completed_steps: list of steps already done
  remaining_steps: list of steps still to do
Then print FINISHED WORK and exit cleanly.

### Context schema
paladin-context-system v1.0
Schema reference: ~/projects/paladin-context-system/SCHEMA.md
Patterns library: ~/projects/paladin-context-system/patterns/

### Known Issues
<!-- Auto-updated by AERS on blocker resolution. Do not remove. -->
_No known issues at this time._
