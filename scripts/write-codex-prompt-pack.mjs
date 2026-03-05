#!/usr/bin/env node
/**
 * Writes the 20-sprint Codex prompt pack into codex/prompts/.
 * Creates codex/prompts if missing.
 * Overwrites existing files with the same names.
 */

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const promptsDir = path.join(repoRoot, "codex", "prompts");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(rel, content) {
  const full = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log(`Wrote ${rel}`);
}

ensureDir(promptsDir);

const files = new Map();

// 000 smoke test
files.set(
  "codex/prompts/000_smoke_test.md",
`Dark Sun Character Builder — Sprint 000: Smoke Test (No Code Changes)

Repo root:
 /Users/alwyn/Documents/Character Builder - Dark Sun/dark-sun-builder

MANDATORY DEVELOPMENT LOOP:
Run:
  pnpm loop:check

If it fails, fix and rerun until it prints:

=== ALL_PASS ===

Rules:
- Do NOT modify any files in this sprint.
- Only run pnpm loop:check and report the output.

Final line of your final message MUST include EXACTLY:

=== ALL_PASS ===
`
);

// Minimal placeholder template for the rest of the prompts
function sprintPrompt(n) {
  const id = String(n).padStart(3,"0");
  return `Dark Sun Character Builder — Sprint ${id}

Repo root:
 /Users/alwyn/Documents/Character Builder - Dark Sun/dark-sun-builder

CONTEXT:
Read codex/context/PROJECT_STATE.md at start.
Update PROJECT_STATE.md and append SPRINT_LOG.md at end.

MANDATORY DEVELOPMENT LOOP:
After ANY code modification run:

pnpm loop:check

Fix failures until:

=== ALL_PASS ===

GOAL
Implement the tasks defined for sprint ${id} in the Codex roadmap.

REQUIREMENTS
- Prefer minimal diffs
- Preserve strict TypeScript safety
- Do not introduce dependencies unless necessary
- Maintain deterministic DerivedState behavior
- Update golden fixtures when derived outputs change

DELIVERABLES
- pnpm loop:check passes
- Update PROJECT_STATE.md
- Append entry to SPRINT_LOG.md

Final message MUST end with:

=== ALL_PASS ===
`;
}

// Generate prompts 001–020
for (let i = 1; i <= 20; i++) {
  const name = `codex/prompts/${String(i).padStart(3,"0")}_sprint_${String(i).padStart(3,"0")}.md`;
  files.set(name, sprintPrompt(i));
}

for (const [rel, content] of files.entries()) {
  writeFile(rel, content);
}

console.log("\nPrompt pack written to codex/prompts/");
console.log("Verify with: ls codex/prompts");
