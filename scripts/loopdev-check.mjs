#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const FULL_STAGES = [
  { name: "repo:duplicate-suffix", command: ["pnpm", "guard:duplicates"] },
  { name: "content:lint", command: ["pnpm", "content:lint"] },
  { name: "content:darksun-smoke", command: ["pnpm", "darksun:smoke"] },
  { name: "rules:typecheck", command: ["pnpm", "--filter", "@dark-sun/rules", "typecheck"] },
  { name: "rules:unit", command: ["pnpm", "--filter", "@dark-sun/rules", "test:unit"] },
  { name: "sheet:golden", command: ["pnpm", "sheet:golden"] },
  { name: "sheet:invariants", command: ["pnpm", "sheet:invariants"] },
  {
    name: "web:build",
    command: ["pnpm", "web:build-check"],
    forbiddenOutput: [/⨯ ESLint:/i],
    warningPatterns: [/Warning:/i, /react-hooks\/exhaustive-deps/i, /ESLint warning/i],
    strictWarningsFail: true,
  },
  { name: "web:smoke", command: ["pnpm", "web:smoke"] },
  { name: "web:dev-smoke", command: ["pnpm", "web:dev-smoke"] },
  { name: "api:smoke", command: ["pnpm", "api:smoke"] },
  { name: "pdf:sanity", command: ["pnpm", "pdf:sanity"] },
  { name: "boundary:imports", command: ["pnpm", "boundary:imports"] },
];

const FAST_STAGE_NAMES = new Set([
  "repo:duplicate-suffix",
  "content:lint",
  "content:darksun-smoke",
  "rules:typecheck",
  "rules:unit",
  "sheet:golden",
  "sheet:invariants",
  "boundary:imports",
]);

const SUMMARY_PATH = path.join(process.cwd(), "codex", "harness", "loopdev-summary.json");
const isStrict = process.env.LOOPDEV_STRICT === "1";
const isFast = process.argv.includes("--fast");
const selectedStages = isFast ? FULL_STAGES.filter((stage) => FAST_STAGE_NAMES.has(stage.name)) : FULL_STAGES;

function firstLines(text, count = 200) {
  return text.split(/\r?\n/g).slice(0, count).join("\n");
}

function tailLines(text, count = 20) {
  if (!text) {
    return [];
  }
  const lines = text.split(/\r?\n/g).filter((line) => line.length > 0);
  return lines.slice(Math.max(0, lines.length - count));
}

function uniqueLines(lines) {
  return [...new Set(lines)];
}

function hasForbiddenOutput(stage, output) {
  const patterns = stage.forbiddenOutput ?? [];
  for (const pattern of patterns) {
    if (pattern.test(output)) {
      return pattern.toString();
    }
  }
  return null;
}

function collectWarningLines(stage, output) {
  const patterns = stage.warningPatterns ?? [];
  if (patterns.length === 0) {
    return [];
  }

  const hits = output
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => patterns.some((pattern) => pattern.test(line)));

  return uniqueLines(hits);
}

function writeSummary(summary) {
  mkdirSync(path.dirname(SUMMARY_PATH), { recursive: true });
  writeFileSync(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}

function printFinalSummary(summary) {
  console.log("=== SUMMARY ===");
  for (const stage of summary.stages) {
    console.log(`- ${stage.name}: ${stage.status} (${stage.durationMs}ms)`);
  }
  console.log(`=== FINAL_STATUS: ${summary.pass ? "PASS" : "FAIL"} ===`);
  console.log(`=== TOTAL_DURATION_MS: ${summary.totalDurationMs} ===`);
  console.log(`=== FIRST_FAILURE: ${summary.firstFailure ?? "none"} ===`);

  const warningStages = summary.stages.filter((stage) => stage.warningCount > 0);
  if (warningStages.length > 0) {
    console.log("=== WARNINGS ===");
    for (const stage of warningStages) {
      console.log(`- ${stage.name}: ${stage.warningCount}`);
    }
  } else {
    console.log("=== WARNINGS ===");
    console.log("- none");
  }

  const webBuildStage = summary.stages.find((stage) => stage.name === "web:build");
  if (webBuildStage) {
    console.log(`warnings detected in web:build: ${webBuildStage.warningCount}`);
    if (webBuildStage.warningLines.length > 0) {
      console.log(`first warning: ${webBuildStage.warningLines[0]}`);
    }
  }

  console.log(`=== STRICT_MODE: ${isStrict ? "ON" : "OFF"} ===`);
  console.log(`=== SUMMARY_JSON: ${SUMMARY_PATH} ===`);
}

const startedAt = new Date();
const summary = {
  startedAt: startedAt.toISOString(),
  finishedAt: null,
  pass: false,
  firstFailure: null,
  totalDurationMs: 0,
  strictMode: isStrict,
  mode: isFast ? "fast" : "full",
  stages: [],
};

for (const stage of selectedStages) {
  const commandText = stage.command.join(" ");
  const [exe, ...args] = stage.command;
  const stageStart = process.hrtime.bigint();

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

  const durationMs = Number(process.hrtime.bigint() - stageStart) / 1e6;
  const rawExitCode = typeof result.status === "number" ? result.status : 1;
  const combinedOutput = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const forbiddenOutputPattern = hasForbiddenOutput(stage, combinedOutput);
  const warningLines = collectWarningLines(stage, combinedOutput);
  const warningCount = warningLines.length;
  const strictWarningFailure = Boolean(stage.strictWarningsFail) && isStrict && warningCount > 0;
  const exitCode = forbiddenOutputPattern || strictWarningFailure ? 1 : rawExitCode;

  const stageSummary = {
    name: stage.name,
    command: commandText,
    durationMs: Number(durationMs.toFixed(2)),
    exitCode,
    status: exitCode === 0 ? "PASS" : "FAIL",
    warningCount,
    warningLines: warningLines.slice(0, 20),
    stderrTail: tailLines(result.stderr ?? "", 20),
  };
  summary.stages.push(stageSummary);

  if (exitCode !== 0) {
    console.log("=== RESULT: FAIL ===");
    console.log(`=== FAILED_COMMAND: ${commandText} ===`);
    console.log(`=== EXIT_CODE: ${rawExitCode} ===`);
    if (forbiddenOutputPattern) {
      console.log(`=== FORBIDDEN_OUTPUT: ${forbiddenOutputPattern} ===`);
    }
    if (strictWarningFailure) {
      console.log(`=== STRICT_WARNING_FAILURE: ${stage.name} has ${warningCount} warning(s) ===`);
      if (warningLines.length > 0) {
        console.log(`=== FIRST_WARNING: ${warningLines[0]} ===`);
      }
    }
    console.log("=== FAILURE_OUTPUT_FIRST_200_LINES ===");
    if (combinedOutput.length > 0) {
      process.stdout.write(`${firstLines(combinedOutput, 200)}\n`);
    } else {
      console.log("(no output captured)");
    }

    summary.pass = false;
    summary.firstFailure = stage.name;
    summary.finishedAt = new Date().toISOString();
    summary.totalDurationMs = Number((Date.now() - startedAt.getTime()).toFixed(2));
    writeSummary(summary);
    printFinalSummary(summary);
    process.exit(1);
  }

  console.log("=== RESULT: PASS ===");
}

summary.pass = true;
summary.finishedAt = new Date().toISOString();
summary.totalDurationMs = Number((Date.now() - startedAt.getTime()).toFixed(2));
writeSummary(summary);

printFinalSummary(summary);
console.log("=== ALL_PASS ===");
