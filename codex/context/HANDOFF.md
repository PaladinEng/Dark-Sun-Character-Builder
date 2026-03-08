# Handoff

## Start-of-Session Checklist
1. Read `AGENTS.md`.
2. Read `codex/context/PROJECT_STATE.md`.
3. Read `codex/context/WORK_QUEUE.md`.
4. Check git status and current branch/tag state.

## Current SRD Status
- SRD class/subclass model includes Warlock and core patrons (Fiend, Archfey, Great Old One).
- Builder/subclass wiring remains content-driven; Warlock appears via pack content.
- Pact progression is implemented in rules slot derivation and accepted by validation.
- Warlock option support is now wired end-to-end:
  - invocation selection + prerequisite checks
  - pact boon selection + class/level checks
  - Mystic Arcanum tiered spell selection + spell-level/tier checks
  - option visibility in sheet/print/pdf via derived traits and selected-feature naming

## Validation Commands
1. `pnpm loop:check`
2. `LOOPDEV_STRICT=1 pnpm loop:check`

## Known Engine Boundaries
- Pact slots are represented in the existing 9-slot array by setting only the active pact-slot spell level.
- Invocation/pact/arcanum are modeled as tracked selections with validation and display; advanced bespoke mechanics are still limited to currently-supported effect types.

## Post-Integration Checklist
Use after substantial UI/export/content merges or when builder behavior looks inconsistent.

1. `pnpm clean:web` (or `rm -rf apps/web/.next`)
2. `pnpm --filter @dark-sun/content build`
3. Verify:
   - `/builder?sources=srd52`
   - `/builder?sources=srd52,darksun`
   - Open HTML Sheet
   - Download JSON
   - Download PDF
   - `/sheet?payload=...`
   - `/api/export/pdf`
4. Run:
   - `pnpm loop:check`
   - `LOOPDEV_STRICT=1 pnpm loop:check` (when practical)
5. Log notable findings in `codex/context/PROJECT_STATE.md` and `codex/context/SPRINT_LOG.md`.

# Codex Resume Instructions

Repository baseline:

Tag: codex-integration-20260308

Before any development work:

Run:

pnpm loop:check

If any stage fails:

1. identify failing stage
2. repair code
3. rerun harness

Do not proceed until ALL_PASS.

### Runtime Diagnostics

If Next.js dev instability occurs:

Run:

node scripts/dev-forensics.mjs

Artifacts will be written to:

codex/harness/dev-forensics

These artifacts capture:

- server logs
- emitted runtime artifacts
- vendor chunk generation
- first-hit route behavior

### Development Safety Rules

Never bypass the harness.

All commits must preserve:

- sheet invariants
- golden sheet tests
- dev-smoke runtime verification
- API smoke tests
