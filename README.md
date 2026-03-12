# Dark Sun Builder (Inner Repo)

This is the canonical workspace.

Use commands from this directory:

- `nvm use` (after installing Node 24)
- `pnpm install`
- `pnpm verify`
- `pnpm start:dev`

## Node Version

This repo is pinned to Node 24 for local development, Codex runs, CI, and Vercel builds.

- Supported Node version: `24.x`
- Repo version files: `.nvmrc` and `.node-version`
- If your shell is on a different major version, switch before running `pnpm install` or the validation harness

## Vercel Deployment

This repository deploys as a standard Next.js app from the monorepo, with the Vercel project rooted at `apps/web`.

- Vercel Project Root Directory: `apps/web`
- Install Command: `pnpm install`
- Build Command: `pnpm --filter web build`
- Output Directory: do not override this in the Vercel dashboard

The project is intentionally linked from the repo root so the build can still read shared workspace packages, but the live Vercel project settings should point at `apps/web`.

Do not keep a repo-root `vercel.json` for this project configuration. With `apps/web` as the project root, a root-level `vercel.json` causes the Vercel CLI to warn that the config file sits outside the configured app root.

If Vercel is configured with `Output Directory = public`, deployment will fail after a successful Next.js build because this app is not a static export.
