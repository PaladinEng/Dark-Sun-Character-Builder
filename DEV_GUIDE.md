# Local Development

Start dev server:

`pnpm dev`

Key routes:

- http://localhost:3000/
- http://localhost:3000/builder
- http://localhost:3000/builder?sources=srd52
- http://localhost:3000/builder?sources=srd52,darksun

Run verification harness:

`pnpm loop:check`

Run forensic diagnostics:

`node scripts/dev-forensics.mjs`
