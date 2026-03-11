# Dark Sun Builder (Inner Repo)

This is the canonical workspace.

Use commands from this directory:

- `pnpm install`
- `pnpm verify`
- `pnpm start:dev`

## Vercel Deployment

This repository deploys as a standard Next.js app from the monorepo root.

- Root Directory: `/`
- Install Command: `pnpm install`
- Build Command: `pnpm --filter web build`
- Output Directory: do not override this in the Vercel dashboard

If Vercel is configured with `Output Directory = public`, deployment will fail after a successful Next.js build because this app is not a static export.
