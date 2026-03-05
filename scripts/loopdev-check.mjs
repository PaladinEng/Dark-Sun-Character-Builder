#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import process from "node:process";

const STAGES = [
  {
    name: "content:lint",
    command: ["pnpm", "content:lint"],
  },
  {
    name: "rules:typecheck",
    command: ["pnpm", "--filter", "@dark-sun/rules", "typecheck"],
  },
  {
    name: "rules:unit",
    command: ["pnpm", "--filter", "@dark-sun/rules", "test:unit"],
  },
  {
    name: "sheet:golden",
    command: ["pnpm", "sheet:golden"],
  },
  {
    name: "sheet:invariants",
    command: ["pnpm", "sheet:invariants"],
  },
];

function firstLines(text, count = 200) {
  return text.split(/\r?\n/g).slice(0, count).join("\n");
}

for (const stage of STAGES) {
  const commandText = stage.command.join(" ");
  const [exe, ...args] = stage.command;

  console.log(`=== STAGE: ${stage.name} ===`);
  const result = spawnSync(exe, args, {
    cwd: process.cwd(),
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
  if (exitCode !== 0) {
    const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    console.log("=== RESULT: FAIL ===");
    console.log(`=== FAILED_COMMAND: ${commandText} ===`);
    console.log(`=== EXIT_CODE: ${exitCode} ===`);
    console.log("=== FAILURE_OUTPUT_FIRST_200_LINES ===");
    if (combinedOutput.length > 0) {
      process.stdout.write(`${firstLines(combinedOutput, 200)}\n`);
    } else {
      console.log("(no output captured)");
    }
    console.log(`=== FIRST_FAILURE: ${stage.name} ===`);
    process.exit(1);
  }

  console.log("=== RESULT: PASS ===");
}

console.log("=== ALL_PASS ===");
