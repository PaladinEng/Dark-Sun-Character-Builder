# Chat Context - 2026-03-08

## Problem Summary
Local Next.js dev runtime intermittently failed even when `web:build` and smoke checks passed.

Observed signatures included:

- `Cannot find module './vendor-chunks/...'`
- `Cannot find module './vendor-chunks/@swc+helpers...'`
- `ENOENT ... next-font-manifest.json`
- `ENOENT ... pages-manifest.json`
- `ENOENT ... app-paths-manifest.json`
- `Cannot find module ... app/page.js`

## Runtime Behavior Identified
Next.js dev emits `.next/server` artifacts lazily on first request.

During failing cases, the first-hit request window was the critical period where runtime modules/manifests were required while artifact emission was still converging.

## Debugging Process
1. Reproduced the direct local path repeatedly:
   - `pkill -f "next dev" || true`
   - `pnpm clean:web`
   - `pnpm --filter @dark-sun/content build`
   - `pnpm --filter web dev --hostname 127.0.0.1 --port 3000`
2. Captured route responses for first-hit requests:
   - `/`
   - `/builder`
   - `/builder?sources=srd52`
   - `/builder?sources=srd52,darksun`
3. Captured before/after artifact snapshots under `.next/server`.
4. Scanned logs for missing module/manifest signatures.

## Forensic Harness Added
Created `scripts/dev-forensics.mjs` to run deterministic multi-run cold-start diagnostics.

Artifacts saved under:

- `codex/harness/dev-forensics/<timestamp>`

Captured data includes:

- startup and per-request server logs
- before-first-request and after-first-request artifact snapshots
- route status and body previews
- vendor-chunk inventory

## Harness Reliability Improvements
`web:dev-smoke` was hardened so it cannot false-green when first-hit runtime is broken.

Key changes:

- readiness uses port-listen detection rather than startup HTTP probe
- first-hit route checks are explicit
- missing runtime signature scanning is stricter
- artifact expectations include manifest and vendor-chunk coverage

## Version Isolation Experiment
Controlled A/B/C matrix tested with exact pins and clean reinstalls.

Results:

- Set A (`next 15.5.12`, `react 19.2.4`) -> PASS
- Set B (`next 15.2.0`, `react 19.0.0`) -> PASS
- Set C (`next 14.2.25`, `react 18.3.1`) -> FAIL startup (`next.config.ts` unsupported in that line)

## Dependency Pinning Decision
Pinned working set kept at:

- `next: 15.5.12`
- `react: 19.2.4`
- `react-dom: 19.2.4`
- `eslint-config-next: 15.5.12`

This pin was chosen as the stable checkpoint for current repository tooling and runtime behavior.
