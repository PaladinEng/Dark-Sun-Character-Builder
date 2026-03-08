#!/usr/bin/env node

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SCAN_ROOTS = [
  "apps",
  "packages",
  "scripts",
  "fixtures",
  "docs",
  "codex/prompts",
  "codex/context",
];

const EXCLUDED_DIR_NAMES = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".pnpm-store",
]);

const EXCLUDED_PATH_PREFIXES = ["codex/runs", "codex/harness", "vendor"];
const DUPLICATE_SUFFIX_PATTERN = / 2\.(json|ts|tsx|md)$/i;

function shouldSkipDir(relativePath, directoryName) {
  if (EXCLUDED_DIR_NAMES.has(directoryName)) {
    return true;
  }
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`)
  );
}

function walkDirectory(absDir, relDir, duplicates) {
  const entries = readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (shouldSkipDir(relPath, entry.name)) {
        continue;
      }
      walkDirectory(path.join(absDir, entry.name), relPath, duplicates);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (DUPLICATE_SUFFIX_PATTERN.test(entry.name)) {
      duplicates.push(relPath);
    }
  }
}

function main() {
  const cwd = process.cwd();
  const duplicates = [];

  for (const scanRoot of SCAN_ROOTS) {
    const absRoot = path.join(cwd, scanRoot);
    if (!existsSync(absRoot)) {
      continue;
    }
    walkDirectory(absRoot, scanRoot, duplicates);
  }

  if (duplicates.length > 0) {
    console.error("=== DUPLICATE_SUFFIX_FILES: FAIL ===");
    for (const filePath of duplicates.sort()) {
      console.error(`- ${filePath}`);
    }
    console.error("Rename or delete duplicate-copy files before running the harness.");
    process.exit(1);
  }

  console.log("=== DUPLICATE_SUFFIX_FILES: PASS ===");
}

main();
