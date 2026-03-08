#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const HOST = "127.0.0.1";
const PORT = 3000;
const BASE_URL = `http://${HOST}:${PORT}`;
const RUNS = Number.parseInt(process.env.DEV_FORENSICS_RUNS ?? "5", 10);
const STARTUP_TIMEOUT_MS = Number.parseInt(process.env.DEV_FORENSICS_STARTUP_TIMEOUT_MS ?? "120000", 10);
const FETCH_TIMEOUT_MS = Number.parseInt(process.env.DEV_FORENSICS_FETCH_TIMEOUT_MS ?? "30000", 10);

const ROUTES = [
  { id: "root", path: "/" },
  { id: "builder", path: "/builder" },
  { id: "builder-srd52", path: "/builder?sources=srd52" },
  { id: "builder-srd52-darksun", path: "/builder?sources=srd52,darksun" },
];

const REQUIRED_ARTIFACTS = [
  "app/page.js",
  "app/_not-found/page.js",
  "app-paths-manifest.json",
  "pages-manifest.json",
  "next-font-manifest.json",
];

const FAILURE_PATTERNS = [
  /Cannot find module '\.\/vendor-chunks\//i,
  /Cannot find module '\.\/vendor-chunks\/@swc\+helpers/i,
  /Cannot find module '.*\.next\/server\/app\/page\.js'/i,
  /app-paths-manifest\.json/i,
  /pages-manifest\.json/i,
  /next-font-manifest\.json/i,
  /pages\/_document\.js/i,
  /ENOENT: no such file or directory/i,
  /Cannot find module/i,
];

function nowTag() {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}-${h}${min}${s}`;
}

function truncate(text, max = 2000) {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max);
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listTree(rootDir, relativePrefix = "") {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const out = [];
  for (const entry of entries) {
    const rel = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    const abs = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      out.push({ path: rel, type: "dir" });
      const nested = await listTree(abs, rel);
      out.push(...nested);
      continue;
    }

    out.push({ path: rel, type: "file" });
  }

  return out;
}

async function snapshotServerArtifacts(repoRoot, runDir, step) {
  const serverDir = join(repoRoot, "apps", "web", ".next", "server");
  const vendorDir = join(serverDir, "vendor-chunks");

  const required = {};
  for (const rel of REQUIRED_ARTIFACTS) {
    required[rel] = await pathExists(join(serverDir, rel));
  }

  let vendorChunks = [];
  if (await pathExists(vendorDir)) {
    const names = await readdir(vendorDir);
    vendorChunks = names.sort((a, b) => a.localeCompare(b));
  }

  const tree = await listTree(serverDir);
  const snapshot = {
    step,
    timestamp: new Date().toISOString(),
    serverDirExists: await pathExists(serverDir),
    required,
    vendorChunksExists: await pathExists(vendorDir),
    vendorChunks,
    tree,
  };

  await writeFile(join(runDir, `${step}.snapshot.json`), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return snapshot;
}

function runSyncAndCapture(command, args, cwd, outFile) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });

  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return writeFile(outFile, combined, "utf8").then(() => ({
    status: typeof result.status === "number" ? result.status : 1,
    output: combined,
  }));
}

async function waitForReady(child, logPath) {
  const started = Date.now();

  while (Date.now() - started < STARTUP_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      return false;
    }

    if (await isPortInUse(HOST, PORT)) {
      return true;
    }

    await delay(300);
  }

  const tail = await readFile(logPath, "utf8").catch(() => "");
  console.error(`[dev-forensics] startup timeout. log tail:\n${truncate(tail.slice(-3000), 3000)}`);
  return false;
}

function isPortInUse(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const done = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

function fetchWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { redirect: "manual", cache: "no-store", signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function detectLogFailures(text) {
  const lines = text.split(/\r?\n/g);
  const matches = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (FAILURE_PATTERNS.some((pattern) => pattern.test(line))) {
      matches.push({ line: i + 1, text: line });
    }
  }

  return matches;
}

async function killExistingNextDev() {
  spawnSync("pkill", ["-f", "next dev"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

async function stopServer(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const deadline = Date.now() + 8000;
  while (child.exitCode === null && Date.now() < deadline) {
    await delay(100);
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
    const killDeadline = Date.now() + 3000;
    while (child.exitCode === null && Date.now() < killDeadline) {
      await delay(100);
    }
  }
}

async function runSingle(repoRoot, sessionDir, index) {
  const runId = `run-${String(index).padStart(2, "0")}`;
  const runDir = join(sessionDir, runId);
  await mkdir(runDir, { recursive: true });

  const runSummary = {
    runId,
    buildStatus: null,
    startupReady: false,
    requests: [],
    snapshots: [],
    logFailureMatches: [],
  };

  await killExistingNextDev();
  await rm(join(repoRoot, "apps", "web", ".next"), { recursive: true, force: true });

  const build = await runSyncAndCapture(
    "pnpm",
    ["--filter", "@dark-sun/content", "build"],
    repoRoot,
    join(runDir, "content-build.log")
  );
  runSummary.buildStatus = build.status;
  if (build.status !== 0) {
    return runSummary;
  }

  const devLogPath = join(runDir, "web-dev.log");
  const devLogStream = createWriteStream(devLogPath, { flags: "w", encoding: "utf8" });
  let liveLogs = "";

  const child = spawn(
    "pnpm",
    ["--filter", "web", "dev", "--hostname", HOST, "--port", String(PORT)],
    {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdout?.on("data", (chunk) => {
    const text = chunk.toString();
    liveLogs += text;
    devLogStream.write(text);
  });
  child.stderr?.on("data", (chunk) => {
    const text = chunk.toString();
    liveLogs += text;
    devLogStream.write(text);
  });

  try {
    runSummary.startupReady = await waitForReady(child, devLogPath);
    runSummary.snapshots.push(await snapshotServerArtifacts(repoRoot, runDir, "before-first-request"));

    for (let index = 0; index < ROUTES.length; index += 1) {
      const route = ROUTES[index];
      const startedAt = Date.now();
      let status = 0;
      let body = "";
      let error = null;
      const logStart = liveLogs.length;

      try {
        const response = await fetchWithTimeout(`${BASE_URL}${route.path}`);
        status = response.status;
        body = await response.text();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      await delay(200);
      const logWindow = liveLogs.slice(logStart);

      const requestRecord = {
        route: route.path,
        status,
        durationMs: Date.now() - startedAt,
        error,
        bodyPreview: truncate(body, 1200),
        logWindowPreview: truncate(logWindow, 1200),
      };
      runSummary.requests.push(requestRecord);

      await writeFile(
        join(runDir, `${route.id}.response.json`),
        `${JSON.stringify(requestRecord, null, 2)}\n`,
        "utf8"
      );
      await writeFile(join(runDir, `${route.id}.response.body.txt`), body, "utf8");
      await writeFile(join(runDir, `${route.id}.log-window.txt`), logWindow, "utf8");

      if (index === 0) {
        runSummary.snapshots.push(
          await snapshotServerArtifacts(repoRoot, runDir, "after-first-request")
        );
      }

      runSummary.snapshots.push(
        await snapshotServerArtifacts(repoRoot, runDir, `after-${route.id}`)
      );
    }
  } finally {
    await stopServer(child);
    devLogStream.end();
  }

  const devLog = await readFile(devLogPath, "utf8").catch(() => "");
  runSummary.logFailureMatches = detectLogFailures(devLog);
  await writeFile(
    join(runDir, "log-failure-matches.json"),
    `${JSON.stringify(runSummary.logFailureMatches, null, 2)}\n`,
    "utf8"
  );

  return runSummary;
}

async function main() {
  const repoRoot = process.cwd();
  const baseDir = join(repoRoot, "codex", "harness", "dev-forensics");
  await mkdir(baseDir, { recursive: true });

  const sessionDir = join(baseDir, nowTag());
  await mkdir(sessionDir, { recursive: true });

  const summary = {
    startedAt: new Date().toISOString(),
    runs: [],
    failureRuns: [],
    sessionDir,
  };

  for (let i = 1; i <= RUNS; i += 1) {
    console.log(`[dev-forensics] run ${i}/${RUNS}`);
    const runSummary = await runSingle(repoRoot, sessionDir, i);
    summary.runs.push(runSummary);

    const hasRequestFailure = runSummary.requests.some((req) => req.status !== 200);
    const hasLogFailure = runSummary.logFailureMatches.length > 0;
    const buildFailed = runSummary.buildStatus !== 0;

    if (buildFailed || hasRequestFailure || hasLogFailure || !runSummary.startupReady) {
      summary.failureRuns.push({
        runId: runSummary.runId,
        buildFailed,
        startupReady: runSummary.startupReady,
        hasRequestFailure,
        hasLogFailure,
      });
    }
  }

  summary.finishedAt = new Date().toISOString();
  await writeFile(join(sessionDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const latestPointer = {
    latestSessionDir: sessionDir,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(join(baseDir, "latest.json"), `${JSON.stringify(latestPointer, null, 2)}\n`, "utf8");

  console.log(`[dev-forensics] artifacts: ${sessionDir}`);
  if (summary.failureRuns.length > 0) {
    console.log(`[dev-forensics] failure runs: ${summary.failureRuns.length}/${RUNS}`);
    process.exit(1);
  }

  console.log(`[dev-forensics] all ${RUNS} runs passed`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
