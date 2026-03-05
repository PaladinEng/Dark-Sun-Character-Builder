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
