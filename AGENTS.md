# Dark Sun Character Builder — Agent Instructions

This repository uses a closed-loop development harness to validate code changes.

## MANDATORY DEVELOPMENT LOOP

After any code modification, run:

pnpm loop:check

If it fails:

1. Identify the first failing stage.
2. Fix the root cause.
3. Re-run pnpm loop:check.
4. Repeat until all stages pass.

Work is NOT complete until pnpm loop:check passes.

Do not commit changes unless pnpm loop:check is green.

## Edit-In-Place Policy

- Edit existing files in place whenever the target file already exists.
- Do not create copy-style siblings like `* 2.ts`, `* 2.tsx`, `* 2.json`, `* 2.md`.
- When replacing behavior, modify the canonical file path and delete obsolete duplicates.
- If a new file is required, create it at the intended final path only (no temporary copy names).

## Harness

Entrypoint:

scripts/loopdev-check.mjs

Alias:

pnpm loop:check

Execution steps:

1) Rules engine type safety
pnpm --filter @dark-sun/rules typecheck

2) Rules engine unit tests
pnpm --filter @dark-sun/rules test:unit

3) Character sheet golden tests
pnpm sheet:golden

4) Character sheet invariant tests
pnpm sheet:invariants

5) Duplicate-copy file guard
pnpm guard:duplicates

## Development Policy

When the harness fails:

1. Identify the first failing stage.
2. Fix the root cause.
3. Re-run pnpm loop:check.
4. Repeat until all checks pass.

Never consider work complete unless the harness succeeds.

## Repository Structure

apps/web
  Next.js UI

packages/rules
  Character rules engine

packages/content
  Content packs and normalization

scripts/loopdev-check.mjs
  Closed-loop validation harness

codex/context
  Persistent session context

## Allowed Write Zones

Default writable paths for development work:

- apps/**
- packages/**
- scripts/**
- fixtures/**
- docs/**
- codex/prompts/**
- codex/context/**
- Root project docs/configs (`AGENTS.md`, `README.md`, `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`)

Avoid writing outside these zones unless the task explicitly requires it.

## Excluded Generated/Vendor Paths

Do not edit or validate duplicate-file guardrails against generated/vendor paths:

- .git/**
- node_modules/**
- .next/** and apps/web/.next/**
- packages/**/dist/**
- codex/runs/**
- codex/harness/**
- coverage/**
- vendor/**

## Design Goals

Strict D&D 2024 RAW rules implementation.

Content packs support:

- SRD
- Dark Sun homebrew
- future campaign sources

## Safety Constraints

Do not introduce new dependencies without justification.

Do not modify build tooling unless necessary.

Always prefer minimal diffs.

## Persistent Context Responsibilities

Before ending a work session that changes project state:

1. Update `codex/context/PROJECT_STATE.md` with current objective, branch/commit, latest harness status, and key risks.
2. Update `codex/context/WORK_QUEUE.md` so the next 1-3 actionable tasks are explicit and ordered.
3. Append a dated entry to `codex/context/SPRINT_LOG.md` summarizing what changed and validation results.
4. Refresh `codex/context/HANDOFF.md` with immediate next-step commands and any blockers/assumptions.

Keep context concise, factual, and durable across fresh Codex sessions.

## Post-Integration Verification Checklist

After substantial UI/export/content integration work (or if builder behavior looks inconsistent), run:

1. `pnpm clean:web` (or `rm -rf apps/web/.next`)
2. `pnpm --filter @dark-sun/content build`
3. Verify routes:
   - `/builder?sources=srd52`
   - `/builder?sources=srd52,darksun`
   - `/sheet?payload=...`
   - `/api/export/pdf`
4. Verify builder actions:
   - Open HTML Sheet
   - Download JSON
   - Download PDF
5. Run `pnpm loop:check`
6. When applicable, run `LOOPDEV_STRICT=1 pnpm loop:check`
7. Record significant findings in `codex/context/HANDOFF.md` and `codex/context/PROJECT_STATE.md`.

## Mandatory Development Loop

All development must follow this loop:

1. run `pnpm loop:check`
2. identify failing stage
3. repair code
4. repeat until ALL_PASS

Never commit changes that fail the harness.
