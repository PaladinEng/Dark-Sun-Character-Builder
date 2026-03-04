# Merge Notes (Outer -> Inner)

Destination repo: `dark-sun-builder/`

| File/Area | Action | Reason |
|---|---|---|
| `package.json` (inner root) | merged | Unified scripts for `verify`, `start:dev`, `typecheck`, `import:seed`, and workspace-only command paths. |
| `pnpm-workspace.yaml` | replaced | Restricted workspaces to `apps/*` and `packages/*` only. |
| `tsconfig.base.json` | merged | Added shared strict TS baseline for inner-only packages/apps. |
| `scripts/fetch_srd_5_2_1.ts` | merged | Kept SRD vendor downloader/checksum workflow in inner repo. |
| `scripts/import_srd521_seed.ts` | merged | Kept seed->normalized import pipeline with schema validation. |
| `packages/content/**` | merged | Consolidated schemas, loader, merge semantics, normalization, attribution helpers, and exports. |
| `packages/content/test/content.test.ts` | merged | Preserved merge/attribution/schema tests in inner package. |
| `packages/rules/**` | merged | Consolidated rules engine, advancement slots, ASI/feat application, and strict types. |
| `packages/rules/test/rules.test.ts` | merged | Preserved advancement-focused rules tests and strict `MergedContent` fixture pattern. |
| `apps/web/src/lib/content.ts` | merged | Unified deterministic multi-pack loading and merged content options in inner app. |
| `apps/web/app/page.tsx` | merged | Preserved homepage counts and links (`/builder`, `/licenses`) with workspace ping checks. |
| `apps/web/app/licenses/page.tsx` | merged | Preserved pack manifest + attribution rendering. |
| `apps/web/app/builder/**` | merged | Preserved current builder UI with feat/ASI advancement slots and dev debug panel. |
| `apps/web/app/debug/content/**` | merged | Preserved dev-only merged content inspector route. |
| `apps/web/content/packs/srd52/**` | merged | Preserved baseline pack manifest, seed file, and normalized entity samples. |
| `apps/web/content/packs/darksun/**` | merged | Preserved override/replacement demo pack for merge semantics. |
| outer `package.json` | replaced | Added guard scripts to prevent accidental execution from outer root. |
| outer `README_USE_INNER_REPO.md` | added | Added explicit instruction to run everything from `dark-sun-builder/`. |
