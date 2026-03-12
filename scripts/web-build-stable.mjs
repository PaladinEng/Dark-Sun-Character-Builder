#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const webDir = path.join(repoRoot, "apps", "web");
const nextDir = path.join(webDir, ".next");
const MAX_ATTEMPTS = 10;

const KNOWN_FAILURE_PATTERNS = [
  /pages-manifest\.json/i,
  /\.next\/server\/.*\.nft\.json/i,
  /Cannot find module '.*\.next\/server\//i,
];

function isKnownArtifactFailure(output) {
  return KNOWN_FAILURE_PATTERNS.some((pattern) => pattern.test(output));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await rm(nextDir, { recursive: true, force: true });

    const result = spawnSync("pnpm", ["exec", "next", "build"], {
      cwd: webDir,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    const exitCode = typeof result.status === "number" ? result.status : 1;
    if (exitCode === 0) {
      if (attempt > 1) {
        console.log(`=== WEB_BUILD_STABLE_RETRY_SUCCESS: attempt ${attempt}/${MAX_ATTEMPTS} ===`);
      }
      return;
    }

    const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    if (!isKnownArtifactFailure(combinedOutput) || attempt === MAX_ATTEMPTS) {
      process.exit(exitCode);
    }

    console.error(
      `=== WEB_BUILD_STABLE_RETRY: known Next artifact failure on attempt ${attempt}/${MAX_ATTEMPTS} ===`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
