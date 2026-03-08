# Handoff

## Start-of-Session Checklist
1. Read `AGENTS.md`.
2. Read `codex/context/PROJECT_STATE.md`.
3. Read `codex/context/WORK_QUEUE.md`.
4. Check git status and current branch/tag state.

## Validation Commands
1. `pnpm loop:fast`
2. `pnpm loop:check`
3. `LOOPDEV_STRICT=1 pnpm loop:check`

## Guardrail Notes
- Duplicate-copy files named like `* 2.json`, `* 2.ts`, `* 2.tsx`, `* 2.md` are blocked by harness preflight.
- Do not widen exclusions to generated/vendor paths unless absolutely necessary and justified.
