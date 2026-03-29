# DECISIONS — Dark Sun Character Builder

## Decision: Next.js as the frontend framework
Date: 2026-01-01
Options considered:
- Option A: Plain HTML/JS — simple, no framework overhead
- Option B: Next.js — React-based, TypeScript-first, good component architecture
- Option C: SvelteKit — lighter, but less TypeScript ecosystem depth
Decision: Next.js
Rationale: React component model suits the character sheet UI. TypeScript support is first-class. Good tooling. SSR/SSG available if export is needed.
Consequences: Heavier bundle, but the audience is always online (browser tool, not mobile app).

## Decision: TypeScript rules engine separated from UI
Date: 2026-01-01
Options considered:
- Option A: Rules logic inline in React components — faster to write, impossible to unit test
- Option B: Separate TypeScript rules engine — testable, reusable across UI and validation harness
Decision: Separate rules engine
Rationale: Character rules are complex and need isolated testing. Separation allows the validation harness to test rules independently of rendering. Enables future non-browser consumers.
Consequences: More abstraction, but validation harness makes this sustainable.

## Decision: pnpm loop:check as non-negotiable validation gate
Date: 2026-01-01
Options considered:
- Option A: Run tests manually before committing
- Option B: Closed-loop harness (`pnpm loop:check`) mandatory before every commit
Decision: pnpm loop:check mandatory
Rationale: Previous development runs produced hard-to-trace bugs from partial states and duplicate content. The harness is the single source of truth for "is this correct."
Consequences: Never bypass. If it fails, fix it — don't skip it.

## Decision: Content pack system for portability
Date: 2026-02-01
Options considered:
- Option A: Hardcode Dark Sun content everywhere — fast, but locks tool to one campaign
- Option B: Content pack abstraction — Dark Sun is the first pack, others can follow
Decision: Content pack abstraction
Rationale: Commercial goal requires usability by other DMs. Dark Sun content must be loadable/unloadable without touching the rules engine.
Consequences: More design work upfront. Dark Sun becomes the reference pack implementation.

## Decision: Duplicate file prevention as a hard guardrail
Date: 2026-02-01
Options considered:
- Option A: Trust the developer not to create duplicates
- Option B: Explicit rule: always edit existing files, never create new files for existing content
Decision: Explicit guardrail
Rationale: Codex (and AI agents generally) tend to create new files rather than edit existing ones. This caused bugs. Rule: if content already exists in a file, edit that file — never create a parallel one.
Consequences: Agents must search for the existing file before creating anything. Validation harness catches duplicates but prevention is better.

## Decision: Migrate Codex prompt queue to Claude Code
Date: 2026-03-28
Options considered:
- Option A: Keep Codex — deprecated, not viable long-term
- Option B: Migrate to Claude Code — aligns with Paladin Robotics platform choice
Decision: Migrate to Claude Code
Rationale: OpenAI Codex is being deprecated. Claude Code is the primary development AI. The filesystem-driven queue workflow from codex-project-orchestrator translates directly.
Consequences: Need to adapt the queue runner to invoke Claude Code instead of Codex. Core workflow structure preserved.
