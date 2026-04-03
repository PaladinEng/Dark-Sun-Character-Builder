# DECISIONS — Dark Sun Character Builder

## Decision #1: Project created via PCP existing-repo mode
Date: 2026-04-03
Decision: Register existing Dark Sun Character Builder repo with Paladin Control Plane.
Rationale: Project already has a working codebase, validation harness, and development history. Existing-repo mode preserves all prior work while adding dashboard compliance files.

## Decision #2: Next.js as the frontend framework
Date: 2026-01-01
Decision: Next.js with TypeScript for the browser-based character builder UI.
Rationale: React component model suits character sheet UI. TypeScript-first. SSR/SSG available if needed.

## Decision #3: Separate TypeScript rules engine
Date: 2026-01-01
Decision: Rules engine is a separate package from the UI layer.
Rationale: Complex character rules need isolated testing. Enables validation harness to test rules independently of rendering.

## Decision #4: pnpm loop:check as non-negotiable validation gate
Date: 2026-01-01
Decision: Closed-loop harness mandatory before every commit.
Rationale: Previous development produced hard-to-trace bugs from partial states and duplicate content.

## Decision #5: Content pack abstraction
Date: 2026-02-01
Decision: Dark Sun content is the first content pack; system designed for extensibility.
Rationale: Commercial goal requires usability by other DMs.

## Decision #6: Edit-in-place policy
Date: 2026-02-01
Decision: Always edit existing files, never create parallel copies.
Rationale: AI agents tend to create new files rather than editing. This caused bugs.
