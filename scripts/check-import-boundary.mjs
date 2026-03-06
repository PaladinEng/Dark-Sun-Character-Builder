#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
      continue;
    }
    out.push(full);
  }
  return out;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, "/");
}

function hasUseClientDirective(content) {
  const trimmed = content.trimStart();
  return trimmed.startsWith("\"use client\";") || trimmed.startsWith("'use client';");
}

function collectImportSpecifiers(content) {
  const imports = [];
  const importRegex = /\bimport\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of content.matchAll(importRegex)) {
    imports.push(match[1]);
  }
  return imports;
}

async function main() {
  const violations = [];

  function pushViolation({ file, importPath, message, suggestion }) {
    violations.push({ file, importPath, message, suggestion });
  }

  const contentIndexPath = path.join(repoRoot, "packages/content/src/index.ts");
  const contentIndex = await readFile(contentIndexPath, "utf8");
  if (/from\s+["']\.\/load["']/.test(contentIndex) || /export\s+\{[^}]*\}\s+from\s+["']\.\/load["']/.test(contentIndex)) {
    pushViolation({
      file: relative(contentIndexPath),
      importPath: "./load",
      message: "Browser-safe barrel must not re-export Node-only loader module.",
      suggestion: 'Move loader exports to "@dark-sun/content/node".',
    });
  }

  const distIndexPath = path.join(repoRoot, "packages/content/dist/index.js");
  const distIndex = await readFile(distIndexPath, "utf8");
  if (distIndex.includes("./load") || /node:fs|node:path/.test(distIndex)) {
    pushViolation({
      file: relative(distIndexPath),
      importPath: "./load or node:*",
      message: "Built browser barrel contains Node-only loader references.",
      suggestion: 'Rebuild content package after ensuring "@dark-sun/content" exports are Node-free.',
    });
  }

  const webFiles = (await walk(path.join(repoRoot, "apps/web"))).filter((filePath) =>
    /\.(ts|tsx|js|jsx|mjs)$/.test(filePath)
  );

  for (const filePath of webFiles) {
    const content = await readFile(filePath, "utf8");
    const rel = relative(filePath);
    const importSpecifiers = collectImportSpecifiers(content);
    const importsNodeOnly = importSpecifiers.filter(
      (specifier) => specifier === "@dark-sun/content/node" || specifier.startsWith("node:")
    );

    if (hasUseClientDirective(content)) {
      for (const importPath of importsNodeOnly) {
        pushViolation({
          file: rel,
          importPath,
          message: "Client module imports a Node-only path.",
          suggestion:
            importPath === "@dark-sun/content/node"
              ? 'Use "@dark-sun/content" in client code and load Node data in server modules.'
              : "Remove node:* import from client module and move logic server-side.",
        });
      }
    }

    if (importSpecifiers.includes("@dark-sun/content/node")) {
      const serverOnlyAllowed =
        content.includes('import "server-only"') ||
        content.includes("import 'server-only'") ||
        rel.includes("/app/api/");
      if (!serverOnlyAllowed) {
        pushViolation({
          file: rel,
          importPath: "@dark-sun/content/node",
          message: "Node-only content loader import is missing an explicit server-only boundary.",
          suggestion: 'Add `import "server-only"` or move import under `app/api/*`.',
        });
      }
    }
  }

  const rulesFiles = (await walk(path.join(repoRoot, "packages/rules/src"))).filter((filePath) =>
    /\.(ts|tsx|js|jsx|mjs)$/.test(filePath)
  );
  for (const filePath of rulesFiles) {
    const content = await readFile(filePath, "utf8");
    const importSpecifiers = collectImportSpecifiers(content);
    if (importSpecifiers.includes("@dark-sun/content/node")) {
      pushViolation({
        file: relative(filePath),
        importPath: "@dark-sun/content/node",
        message: "Rules package must stay browser-safe and cannot depend on Node-only loader paths.",
        suggestion: 'Consume merged content data; do not import "@dark-sun/content/node" in rules.',
      });
    }
  }

  if (violations.length > 0) {
    console.error("[boundary:imports] FAIL");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.message}`);
      if (violation.importPath) {
        console.error(`  import: ${violation.importPath}`);
      }
      if (violation.suggestion) {
        console.error(`  suggestion: ${violation.suggestion}`);
      }
    }
    process.exit(1);
  }

  console.log("[boundary:imports] PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
