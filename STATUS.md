# STATUS — Dark Sun Character Builder
Updated: 2026-03-28

## Current State
Builder core is working with the closed-loop validation harness passing. /sheet HTML layout and printable PDF layout both need improvement. The Codex prompt queue workflow that drove development needs migration to Claude Code.

## Last Session
Date: ~early 2026
Done:
- Elemental Cleric class rewrite completed
- Master spell list through level 9 completed
- Closed-loop validation harness operational
- Codex prompt queue workflow established

## In Progress
- /sheet HTML layout improvement (P1)
- Printable PDF layout improvement (P1)

## Blocked
- Codex prompt queue workflow blocked on Codex deprecation — needs Claude Code migration via codex-project-orchestrator

## Next Session Should Start With
Run `pnpm loop:check` to confirm baseline passes, then work on /sheet HTML layout improvement.
