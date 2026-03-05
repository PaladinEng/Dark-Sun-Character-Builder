#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const PROMPT_FILE_PATTERN = /^\d{3}[_-].+\.(md|txt)$/i;

function parseIntArg(value, flag) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
}

function resolveArgPath(value, cwd) {
  return path.isAbsolute(value) ? value : path.resolve(cwd, value);
}

function parseArgs(argv) {
  const cwd = process.cwd();
  const options = {
    repo: cwd,
    prompts: undefined,
    runs: undefined,
    start: 1,
    end: Number.MAX_SAFE_INTEGER,
    startExplicit: false,
    model: undefined,
    sandbox: "workspace-write",
    approvals: "never",
    autoCommit: false,
    requireClean: true,
    autoBranch: undefined,
    tagCheckpoints: false,
    tagPrefix: "codex-sprint",
    autoResume: false,
    codexBin: "codex",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--auto-commit") {
      options.autoCommit = true;
      continue;
    }
    if (arg === "--no-auto-commit") {
      options.autoCommit = false;
      continue;
    }
    if (arg === "--require-clean") {
      options.requireClean = true;
      continue;
    }
    if (arg === "--no-require-clean") {
      options.requireClean = false;
      continue;
    }
    if (arg === "--tag-checkpoints") {
      options.tagCheckpoints = true;
      continue;
    }
    if (arg === "--auto-resume") {
      options.autoResume = true;
      continue;
    }

    const next = argv[i + 1];
    if (typeof next !== "string" || next.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    switch (arg) {
      case "--repo":
        options.repo = resolveArgPath(next, cwd);
        i += 1;
        break;
      case "--prompts":
        options.prompts = resolveArgPath(next, cwd);
        i += 1;
        break;
      case "--runs":
        options.runs = resolveArgPath(next, cwd);
        i += 1;
        break;
      case "--start":
        options.start = parseIntArg(next, arg);
        options.startExplicit = true;
        i += 1;
        break;
      case "--end":
        options.end = parseIntArg(next, arg);
        i += 1;
        break;
      case "--model":
        options.model = next;
        i += 1;
        break;
      case "--sandbox":
        options.sandbox = next;
        i += 1;
        break;
      case "--approvals":
        options.approvals = next;
        i += 1;
        break;
      case "--auto-branch":
        options.autoBranch = next;
        i += 1;
        break;
      case "--tag-prefix":
        options.tagPrefix = next;
        i += 1;
        break;
      case "--codex-bin":
        options.codexBin = next;
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  options.prompts ??= path.join(options.repo, "codex", "prompts");
  options.runs ??= path.join(options.repo, "codex", "runs");

  if (options.end < options.start) {
    throw new Error(`Invalid range: --end (${options.end}) is less than --start (${options.start})`);
  }

  return options;
}

function formatTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sanitizeSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function runCommand(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 1024 * 1024 * 64,
  });
}

function ensureCommandSucceeded(commandText, result, context) {
  const status = typeof result.status === "number" ? result.status : 1;
  if (status === 0 && !result.error) {
    return;
  }
  const stderr = result.stderr ?? "";
  const stdout = result.stdout ?? "";
  const errorText = result.error ? `${result.error.message}\n` : "";
  throw new Error(
    `${context}\nCommand: ${commandText}\nExit code: ${status}\n${errorText}${stderr}${stdout}`
  );
}

function isGitRepo(repo) {
  const result = runCommand("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repo });
  return result.status === 0 && (result.stdout ?? "").trim() === "true";
}

function isTreeClean(repo) {
  const result = runCommand("git", ["status", "--porcelain"], { cwd: repo });
  ensureCommandSucceeded("git status --porcelain", result, "Unable to inspect git status.");
  return (result.stdout ?? "").trim() === "";
}

function branchExists(repo, branchName) {
  const result = runCommand("git", ["rev-parse", "--verify", "--quiet", `refs/heads/${branchName}`], {
    cwd: repo,
  });
  if (result.status === 0) {
    return true;
  }
  if (result.status === 1) {
    return false;
  }
  ensureCommandSucceeded(
    `git rev-parse --verify --quiet refs/heads/${branchName}`,
    result,
    "Unable to determine whether branch exists."
  );
  return false;
}

function checkoutOrCreateBranch(repo, branchName) {
  if (branchExists(repo, branchName)) {
    const checkout = runCommand("git", ["checkout", branchName], { cwd: repo });
    ensureCommandSucceeded(`git checkout ${branchName}`, checkout, "Failed to checkout existing branch.");
    return "checked_out";
  }

  const create = runCommand("git", ["checkout", "-b", branchName], { cwd: repo });
  ensureCommandSucceeded(`git checkout -b ${branchName}`, create, "Failed to create branch.");
  return "created";
}

function findLatestCheckpointSprint(repo, tagPrefix) {
  const result = runCommand("git", ["tag", "--list", `${tagPrefix}-*`], { cwd: repo });
  ensureCommandSucceeded(`git tag --list ${tagPrefix}-*`, result, "Unable to query checkpoint tags.");

  const tags = (result.stdout ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let maxSprint = null;
  for (const tag of tags) {
    if (!tag.startsWith(`${tagPrefix}-`)) {
      continue;
    }
    const suffix = tag.slice(tagPrefix.length + 1);
    const match = suffix.match(/^(\d{3})/);
    if (!match) {
      continue;
    }
    const sprint = Number.parseInt(match[1], 10);
    if (!Number.isFinite(sprint)) {
      continue;
    }
    maxSprint = maxSprint === null ? sprint : Math.max(maxSprint, sprint);
  }

  return maxSprint;
}

function createCheckpointTag(repo, tagPrefix, sprintNumber, promptFileName, runDir) {
  const sprint = String(sprintNumber).padStart(3, "0");
  const timestamp = formatTimestamp();
  const tagName = `${tagPrefix}-${sprint}-${timestamp}`;
  const message = [
    `Codex checkpoint sprint ${sprint}`,
    `Prompt: ${promptFileName}`,
    `Run logs: ${runDir}`,
  ].join("\n");

  const result = runCommand("git", ["tag", "-a", tagName, "-m", message], { cwd: repo });
  ensureCommandSucceeded(`git tag -a ${tagName}`, result, "Failed to create checkpoint tag.");
  return tagName;
}

function autoCommitSprint(repo, sprintNumber, promptFileName) {
  const addResult = runCommand("git", ["add", "-A"], { cwd: repo });
  ensureCommandSucceeded("git add -A", addResult, "Failed to stage changes.");

  const stagedResult = runCommand("git", ["diff", "--cached", "--quiet"], { cwd: repo });
  if (stagedResult.status === 0) {
    return { committed: false, reason: "No staged changes" };
  }
  if (stagedResult.status !== 1) {
    ensureCommandSucceeded(
      "git diff --cached --quiet",
      stagedResult,
      "Unable to determine whether changes are staged."
    );
  }

  const sprint = String(sprintNumber).padStart(3, "0");
  const message = `codex sprint ${sprint}: ${promptFileName}`;
  const commitResult = runCommand("git", ["commit", "-m", message], { cwd: repo });
  ensureCommandSucceeded("git commit -m <message>", commitResult, "Auto-commit failed.");
  return { committed: true, reason: message };
}

async function listPromptFiles(promptsDir) {
  const entries = await readdir(promptsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && PROMPT_FILE_PATTERN.test(entry.name))
    .map((entry) => {
      const number = Number.parseInt(entry.name.slice(0, 3), 10);
      return {
        name: entry.name,
        number,
        fullPath: path.join(promptsDir, entry.name),
        baseNameWithoutExt: path.parse(entry.name).name,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildCodexArgs(options, lastMessagePath, mode) {
  const args = [
    "exec",
    "--cd",
    options.repo,
    "--sandbox",
    options.sandbox,
    "--json",
    "--output-last-message",
    lastMessagePath,
  ];

  if (options.model) {
    args.push("--model", options.model);
  }

  if (mode === "ask-flag") {
    args.push("--ask-for-approval", options.approvals);
  } else {
    args.push("-c", `approval_policy=\"${options.approvals}\"`);
  }

  args.push("-");
  return args;
}

function ensureAllPassInLastMessage(lastMessagePath) {
  if (!existsSync(lastMessagePath)) {
    return false;
  }
  const text = readFileSync(lastMessagePath, "utf8");
  return text.includes("=== ALL_PASS ===");
}

function printUsage() {
  console.log(`Usage: node scripts/codex-prompt-runner.mjs [options]\n\nOptions:\n  --repo <path>\n  --prompts <path>\n  --runs <path>\n  --start <n>\n  --end <n>\n  --model <name>\n  --sandbox <mode>\n  --approvals <mode>\n  --auto-commit\n  --no-auto-commit\n  --require-clean\n  --no-require-clean\n  --auto-branch <name>\n  --tag-checkpoints\n  --tag-prefix <prefix>\n  --auto-resume\n  --codex-bin <path>`);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    process.exit(1);
  }

  await mkdir(options.prompts, { recursive: true });
  await mkdir(options.runs, { recursive: true });

  const needsGit =
    options.requireClean ||
    options.autoCommit ||
    options.tagCheckpoints ||
    options.autoResume ||
    typeof options.autoBranch === "string";

  if (needsGit && !isGitRepo(options.repo)) {
    console.error("This runner configuration requires a git repository.");
    process.exit(1);
  }

  if (options.autoBranch) {
    const branchAction = checkoutOrCreateBranch(options.repo, options.autoBranch);
    console.log(
      branchAction === "created"
        ? `Created and checked out branch ${options.autoBranch}.`
        : `Checked out branch ${options.autoBranch}.`
    );
  }

  if (options.requireClean && !isTreeClean(options.repo)) {
    console.error("Working tree is not clean and --require-clean is enabled.");
    console.error("Commit/stash changes or rerun with --no-require-clean.");
    process.exit(1);
  }

  if (options.autoResume && !options.startExplicit) {
    const latest = findLatestCheckpointSprint(options.repo, options.tagPrefix);
    if (latest !== null) {
      options.start = latest + 1;
      console.log(`Auto-resume selected start sprint ${options.start} from latest tag ${options.tagPrefix}-*.`);
    } else {
      console.log(`Auto-resume found no tags for prefix ${options.tagPrefix}; using start ${options.start}.`);
    }
  }

  if (options.end < options.start) {
    console.error(`No sprints to run: start ${options.start} is greater than end ${options.end}.`);
    process.exit(1);
  }

  const prompts = await listPromptFiles(options.prompts);
  const selectedPrompts = prompts.filter(
    (entry) => entry.number >= options.start && entry.number <= options.end
  );

  if (selectedPrompts.length === 0) {
    console.log(
      `No prompt files matched in ${options.prompts} for range ${options.start}..${options.end}.`
    );
    return;
  }

  for (const prompt of selectedPrompts) {
    const sprint = String(prompt.number).padStart(3, "0");
    const timestamp = formatTimestamp();
    const runDirName = `${sprint}_${timestamp}_${sanitizeSegment(prompt.baseNameWithoutExt)}`;
    const runDir = path.join(options.runs, runDirName);

    await mkdir(runDir, { recursive: true });

    const eventsPath = path.join(runDir, "events.jsonl");
    const stderrPath = path.join(runDir, "stderr.txt");
    const lastMessagePath = path.join(runDir, "last_message.txt");

    const promptText = await readFile(prompt.fullPath, "utf8");

    console.log(`Running sprint ${sprint}: ${prompt.name}`);
    console.log(`Run directory: ${runDir}`);

    const codexArgs = buildCodexArgs(options, lastMessagePath, "ask-flag");
    let result = runCommand(options.codexBin, codexArgs, {
      cwd: options.repo,
      input: promptText,
    });

    const askForApprovalUnsupported =
      result.status !== 0 &&
      (result.stderr ?? "").includes("unexpected argument '--ask-for-approval'");
    if (askForApprovalUnsupported) {
      const fallbackArgs = buildCodexArgs(options, lastMessagePath, "config-override");
      result = runCommand(options.codexBin, fallbackArgs, {
        cwd: options.repo,
        input: promptText,
      });
    }

    await writeFile(eventsPath, result.stdout ?? "", "utf8");
    await writeFile(
      stderrPath,
      `${result.stderr ?? ""}${result.error ? `\n${result.error.message}\n` : ""}`,
      "utf8"
    );

    const exitCode = typeof result.status === "number" ? result.status : 1;
    const hasAllPass = ensureAllPassInLastMessage(lastMessagePath);

    if (exitCode !== 0 || !hasAllPass) {
      console.error(`Sprint ${sprint} failed.`);
      console.error(`Prompt: ${prompt.fullPath}`);
      console.error(`Run logs: ${runDir}`);
      console.error(`Exit code: ${exitCode}`);
      console.error(`Contains === ALL_PASS ===: ${hasAllPass}`);
      process.exit(1);
    }

    if (options.autoCommit) {
      const commitResult = autoCommitSprint(options.repo, prompt.number, prompt.name);
      console.log(
        commitResult.committed
          ? `Auto-commit created: ${commitResult.reason}`
          : `Auto-commit skipped: ${commitResult.reason}`
      );
    }

    if (options.requireClean && !isTreeClean(options.repo)) {
      if (options.autoCommit) {
        console.error("Working tree is dirty after auto-commit. Stopping.");
      } else {
        console.error(
          "Working tree is dirty after successful sprint while --auto-commit is disabled. Stopping to avoid compounded changes."
        );
      }
      console.error(`Run logs: ${runDir}`);
      process.exit(1);
    }

    if (options.tagCheckpoints) {
      const tagName = createCheckpointTag(
        options.repo,
        options.tagPrefix,
        prompt.number,
        prompt.name,
        runDir
      );
      console.log(`Created checkpoint tag: ${tagName}`);
    }
  }

  console.log("All selected prompts completed successfully.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
