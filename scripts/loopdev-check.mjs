#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const TASKS = {
  "rules:typecheck": {
    command: ["pnpm", "--filter", "@dark-sun/rules", "typecheck"],
    category: "typecheck/build",
    priority: 1,
    rerun: "pnpm --filter @dark-sun/rules typecheck"
  },
  "web:typecheck": {
    command: ["pnpm", "--filter", "web", "typecheck"],
    category: "typecheck/build",
    priority: 1,
    rerun: "pnpm --filter web typecheck"
  },
  "content:typecheck": {
    command: ["pnpm", "--filter", "@dark-sun/content", "typecheck"],
    category: "typecheck/build",
    priority: 1,
    rerun: "pnpm --filter @dark-sun/content typecheck"
  },
  "rules:unit": {
    command: ["pnpm", "--filter", "@dark-sun/rules", "test:unit"],
    category: "unit-tests",
    priority: 2,
    rerun: "pnpm --filter @dark-sun/rules test:unit"
  },
  "content:unit": {
    command: ["pnpm", "--filter", "@dark-sun/content", "test"],
    category: "unit-tests",
    priority: 2,
    rerun: "pnpm --filter @dark-sun/content test"
  },
  "sheet:golden": {
    command: ["pnpm", "sheet:golden"],
    category: "sheet-golden-diff",
    priority: 3,
    rerun: "pnpm sheet:golden"
  },
  "sheet:invariants": {
    command: ["pnpm", "sheet:invariants"],
    category: "sheet-invariants",
    priority: 4,
    rerun: "pnpm sheet:invariants"
  }
};

const DEFAULT_CONFIG = {
  fixturesDependOnContent: false,
  watchPaths: {
    rulesOrBuilder: ["packages/rules/src/", "apps/web/app/builder/"],
    content: ["packages/content/"],
    fixtures: ["fixtures/characters/"]
  }
};

const REPO_ROOT = process.cwd();
const LOOPDEV_DIR = path.join(REPO_ROOT, ".loopdev");
const CONFIG_PATH = path.join(LOOPDEV_DIR, "config.json");
const RUN_PATH = path.join(LOOPDEV_DIR, "run.json");
const NEXT_PATH = path.join(LOOPDEV_DIR, "next.json");

function dedupe(values) {
  return [...new Set(values)];
}

function parseConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    return {
      fixturesDependOnContent:
        parsed.fixturesDependOnContent === true
          ? true
          : DEFAULT_CONFIG.fixturesDependOnContent,
      watchPaths: {
        rulesOrBuilder: Array.isArray(parsed.watchPaths?.rulesOrBuilder)
          ? parsed.watchPaths.rulesOrBuilder
          : DEFAULT_CONFIG.watchPaths.rulesOrBuilder,
        content: Array.isArray(parsed.watchPaths?.content)
          ? parsed.watchPaths.content
          : DEFAULT_CONFIG.watchPaths.content,
        fixtures: Array.isArray(parsed.watchPaths?.fixtures)
          ? parsed.watchPaths.fixtures
          : DEFAULT_CONFIG.watchPaths.fixtures
      }
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function parseChangedFilesFromArgs(argv) {
  const files = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--changed") {
      const value = argv[i + 1] ?? "";
      i += 1;
      files.push(...value.split(","));
      continue;
    }
    if (token.startsWith("--changed=")) {
      files.push(...token.slice("--changed=".length).split(","));
    }
  }

  return files
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseChangedFilesFromEnv() {
  const raw = process.env.LOOPDEV_CHANGED_FILES;
  if (!raw) return [];

  return raw
    .split(/[,\n]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseGitChangedFiles() {
  const status = spawnSync("git", ["status", "--porcelain"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  if (status.status !== 0) {
    return [];
  }

  return (status.stdout ?? "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3))
    .map((entry) => {
      const renameParts = entry.split(" -> ");
      return renameParts[renameParts.length - 1] ?? entry;
    })
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function startsWithAny(value, prefixes) {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

function selectTasks(changedFiles, config) {
  const rulesOrBuilderTouched = changedFiles.some((file) =>
    startsWithAny(file, config.watchPaths.rulesOrBuilder)
  );
  const contentTouched = changedFiles.some((file) =>
    startsWithAny(file, config.watchPaths.content)
  );
  const fixturesTouched = changedFiles.some((file) =>
    startsWithAny(file, config.watchPaths.fixtures)
  );

  const contentOnly =
    changedFiles.length > 0 &&
    changedFiles.every((file) => startsWithAny(file, config.watchPaths.content));

  const selected = [];

  if (rulesOrBuilderTouched) {
    selected.push("rules:typecheck");
    if (changedFiles.some((file) => file.startsWith("apps/web/app/builder/"))) {
      selected.push("web:typecheck");
    }
    selected.push("rules:unit", "sheet:golden", "sheet:invariants");
  } else if (contentOnly) {
    selected.push("content:typecheck", "content:unit");
    if (config.fixturesDependOnContent) {
      selected.push("sheet:golden");
    }
  } else if (fixturesTouched) {
    selected.push("sheet:golden", "sheet:invariants");
  } else {
    selected.push("rules:typecheck", "rules:unit", "sheet:golden", "sheet:invariants");
  }

  return dedupe(selected).sort((a, b) => TASKS[a].priority - TASKS[b].priority);
}

function tail(text, maxLines = 40) {
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);

  return lines.slice(-maxLines);
}

function runTask(taskId) {
  const task = TASKS[taskId];
  const [exe, ...args] = task.command;

  const startedAt = Date.now();
  const result = spawnSync(exe, args, {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  const durationMs = Date.now() - startedAt;

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const exitCode = typeof result.status === "number" ? result.status : 1;
  const status = exitCode === 0 ? "passed" : "failed";
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  return {
    taskId,
    category: task.category,
    priority: task.priority,
    command: [exe, ...args],
    rerun: task.rerun,
    status,
    exitCode,
    durationMs,
    outputTail: tail(output)
  };
}

function writeArtifacts(runPayload, nextPayload) {
  mkdirSync(LOOPDEV_DIR, { recursive: true });
  writeFileSync(RUN_PATH, `${JSON.stringify(runPayload, null, 2)}\n`, "utf8");
  writeFileSync(NEXT_PATH, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf8");
}

function main() {
  const config = parseConfig();

  const argChanged = parseChangedFilesFromArgs(process.argv.slice(2));
  const envChanged = parseChangedFilesFromEnv();
  const gitChanged = parseGitChangedFiles();

  const changedFiles = dedupe([...argChanged, ...envChanged, ...gitChanged]);
  const changedSource =
    argChanged.length > 0
      ? "args"
      : envChanged.length > 0
        ? "env"
        : gitChanged.length > 0
          ? "git"
          : "none";

  const selectedTasks = selectTasks(changedFiles, config);
  const startedAt = new Date().toISOString();
  const results = [];
  let failed = null;

  for (const taskId of selectedTasks) {
    const result = runTask(taskId);
    results.push(result);
    if (result.status === "failed") {
      failed = result;
      break;
    }
  }

  const runStatus = failed ? "failed" : "passed";
  const finishedAt = new Date().toISOString();

  const runPayload = {
    schemaVersion: 1,
    startedAt,
    finishedAt,
    status: runStatus,
    repoRoot: REPO_ROOT,
    changedSource,
    changedFiles,
    selectedTasks,
    results
  };

  const remainingTasks =
    failed === null
      ? []
      : selectedTasks.slice(selectedTasks.indexOf(failed.taskId) + 1);

  const nextPayload = failed
    ? {
        schemaVersion: 1,
        status: "blocked",
        reason: failed.category,
        failedTask: failed.taskId,
        failurePriority: failed.priority,
        rerun: failed.rerun,
        remainingTasks
      }
    : {
        schemaVersion: 1,
        status: "ready",
        reason: "all_checks_passed",
        nextAction: "continue_development",
        remainingTasks
      };

  writeArtifacts(runPayload, nextPayload);

  if (failed) {
    process.exit(1);
  }
}

main();
