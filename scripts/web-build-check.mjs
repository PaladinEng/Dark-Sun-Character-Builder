#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, rm } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const nextDir = path.join(repoRoot, "apps", "web", ".next");
const CLEANUP_ATTEMPTS = 5;

const REQUIRED_ARTIFACTS = [
  ".next/server/pages-manifest.json",
  ".next/server/next-font-manifest.json",
  ".next/server/pages/_document.js",
  ".next/server/app/page.js",
  ".next/server/app/_not-found/page.js",
  ".next/server/app/_not-found/page.js.nft.json",
];

const FAILURE_PATTERNS = [
  {
    id: "missing-pages-manifest",
    pattern: /pages-manifest\.json/i,
    help: "Next did not materialize pages-router server artifacts during page-data collection.",
  },
  {
    id: "missing-not-found-trace",
    pattern: /_not-found\/page\.js\.nft\.json/i,
    help: "Next failed while collecting build traces for the app-router not-found entry.",
  },
  {
    id: "missing-server-trace",
    pattern: /\.next\/server\/.*\.nft\.json/i,
    help: "Next failed while collecting output trace JSON for a server entrypoint.",
  },
  {
    id: "next-artifact-race",
    pattern: /E(?:NOENT|NOTEMPTY): .*\.next\//i,
    help: "Next hit a transient filesystem race while moving or cleaning build artifacts under .next.",
  },
  {
    id: "missing-app-route-bundle",
    pattern: /Cannot find module '.*\.next\/server\/app\/.*\/page\.js'/i,
    help: "Next attempted to prerender an app route before its server bundle was available.",
  },
  {
    id: "missing-pages-bundle-during-finalize",
    pattern: /ENOENT: no such file or directory, unlink '.*\.next\/server\/pages\/.*\.js'/i,
    help: "Next removed a pages-router server bundle before the production build fully finalized.",
  },
  {
    id: "missing-404-pages-bundle",
    pattern: /Cannot find module '.*\.next\/server\/pages\/404\.js'/i,
    help: "Next attempted to prerender the pages-router 404 entry before its server bundle was available.",
  },
  {
    id: "missing-404-export-artifact",
    pattern: /ENOENT: no such file or directory, rename '.*\.next\/export\/404\.html' -> '.*\.next\/server\/pages\/404\.html'/i,
    help: "Next dropped the temporary 404 export artifact before finishing the server-pages handoff.",
  },
];

async function assertExists(relativePath) {
  const absolutePath = path.join(repoRoot, "apps", "web", relativePath);
  try {
    await access(absolutePath, constants.F_OK);
  } catch {
    throw new Error(`[web:build-check] Missing required build artifact: ${relativePath}`);
  }
}

function detectFailureClass(output) {
  for (const entry of FAILURE_PATTERNS) {
    if (entry.pattern.test(output)) {
      return entry;
    }
  }
  return null;
}

function isKnownCleanupFailure(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ENOTEMPTY" || error.code === "ENOENT"),
  );
}

async function sleep(ms) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function cleanNextDir() {
  for (let attempt = 1; attempt <= CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      await rm(nextDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isKnownCleanupFailure(error) || attempt === CLEANUP_ATTEMPTS) {
        throw error;
      }
      await sleep(50 * attempt);
    }
  }
}

async function main() {
  await cleanNextDir();

  const result = spawnSync("pnpm", ["--filter", "web", "build"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const exitCode = typeof result.status === "number" ? result.status : 1;

  if (exitCode !== 0) {
    const failureClass = detectFailureClass(combinedOutput);
    if (failureClass) {
      console.error(`=== WEB_BUILD_FAILURE_CLASS: ${failureClass.id} ===`);
      console.error(`=== WEB_BUILD_FAILURE_HELP: ${failureClass.help} ===`);
    } else {
      console.error("=== WEB_BUILD_FAILURE_CLASS: unknown ===");
    }
    process.exit(exitCode);
  }

  const retryMatches = combinedOutput.match(/=== WEB_BUILD_STABLE_RETRY:/g) ?? [];
  if (retryMatches.length > 0) {
    console.log(`=== WEB_BUILD_RETRIES_USED: ${retryMatches.length} ===`);
  }

  for (const artifact of REQUIRED_ARTIFACTS) {
    await assertExists(artifact);
  }

  console.log("=== WEB_BUILD_ARTIFACTS_OK ===");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
