# Codex Development Contract

Project: Dark Sun Character Builder

Primary commands:
- pnpm verify
- pnpm start:dev

Rules:
1. Always run pnpm verify after changes.
2. Fix failures before making additional changes.
3. Do not introduce new dependencies without justification.
4. Maintain strict TypeScript type safety.
5. Content packs must obey replacement rules (one replacer per entity).
6. Backgrounds must grant an origin feat under strict 2024 RAW.

Structure:
apps/web -> Next.js frontend
packages/rules -> rules engine
packages/content -> content loader/merge
content packs -> apps/web/content/packs
