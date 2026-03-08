#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { access, readdir } from "node:fs/promises";
import net from "node:net";
import { constants } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const ROUTES = ["/", "/builder", "/builder?sources=srd52", "/builder?sources=srd52,darksun"];
const SERVER_LOG_FAILURE_PATTERNS = [
  /Cannot find module '\.\/vendor-chunks\//i,
  /vendor-chunks\/.*\.js/i,
  /@swc\+helpers@/i,
  /app\/page\.js/i,
  /app-paths-manifest\.json/i,
  /middleware-manifest\.json/i,
  /pages-manifest\.json/i,
  /next-font-manifest\.json/i,
  /pages\/_document\.js/i,
  /Cannot find module '.*\.next\/server\//i,
  /ENOENT: no such file or directory, open '.*\.next\/server\//i,
];
const FETCH_TIMEOUT_MS = 10000;
const FIRST_HIT_ROUTES = new Set(["/", "/builder"]);

function truncate(text, max = 6000) {
  return text.length <= max ? text : text.slice(text.length - max);
}

function assertNoServerLogFailures(logs) {
  const combined = logs.join("");
  const matchedPattern = findServerLogFailurePattern(combined);
  if (matchedPattern) {
    throw new Error(
      `Dev server log contains missing-runtime/manifest failure (${matchedPattern}).\n` +
        `Recent server output:\n${truncate(combined)}`
    );
  }
}

function findServerLogFailurePattern(logText) {
  for (const pattern of SERVER_LOG_FAILURE_PATTERNS) {
    if (pattern.test(logText)) {
      return pattern.toString();
    }
  }
  return null;
}

async function assertPathExists(path, label) {
  try {
    await access(path, constants.F_OK);
  } catch {
    throw new Error(`[web:dev-smoke] Missing required artifact: ${label} (${path})`);
  }
}

async function assertServerArtifacts(repoRoot) {
  const serverRoot = join(repoRoot, "apps", "web", ".next", "server");
  const requiredArtifacts = [
    { path: join(serverRoot, "app", "page.js"), label: ".next/server/app/page.js" },
    { path: join(serverRoot, "app-paths-manifest.json"), label: ".next/server/app-paths-manifest.json" },
    { path: join(serverRoot, "pages-manifest.json"), label: ".next/server/pages-manifest.json" },
    { path: join(serverRoot, "next-font-manifest.json"), label: ".next/server/next-font-manifest.json" },
    { path: join(serverRoot, "vendor-chunks"), label: ".next/server/vendor-chunks" },
  ];

  for (const artifact of requiredArtifacts) {
    await assertPathExists(artifact.path, artifact.label);
  }

  const vendorChunkFiles = await readdir(join(serverRoot, "vendor-chunks"));
  if (!vendorChunkFiles.some((name) => name.includes("@swc+helpers"))) {
    throw new Error(
      `[web:dev-smoke] Missing @swc helpers vendor chunk under ${join(serverRoot, "vendor-chunks")}`
    );
  }
  if (!vendorChunkFiles.some((name) => name.startsWith("next@"))) {
    throw new Error(
      `[web:dev-smoke] Missing next vendor chunk under ${join(serverRoot, "vendor-chunks")}`
    );
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
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

function isPortInUseViaLsof(port) {
  const result = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });
  if (result.error) {
    return false;
  }
  return result.status === 0 && (result.stdout ?? "").trim().length > 0;
}

async function waitForReady({ host, port, timeoutMs, pollMs, processRef }) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (processRef.exited) {
      throw new Error(
        `pnpm dev exited before becoming ready (code=${processRef.code}).\n` +
          `Recent server output:\n${truncate(processRef.logs.join(""))}`
      );
    }

    if (await isPortInUse(host, port)) {
      return;
    }

    await delay(pollMs);
  }

  throw new Error(
    `Timed out waiting for pnpm dev to listen on ${host}:${port}.\n` +
      `Recent server output:\n${truncate(processRef.logs.join(""))}`
  );
}

async function stopProcess(child, processRef) {
  if (processRef.exited) {
    return;
  }

  const killGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      try {
        child.kill(signal);
      } catch {
        // no-op
      }
    }
  };

  killGroup("SIGTERM");
  const deadline = Date.now() + 8000;
  while (!processRef.exited && Date.now() < deadline) {
    await delay(150);
  }
  if (!processRef.exited) {
    killGroup("SIGKILL");
    const killDeadline = Date.now() + 3000;
    while (!processRef.exited && Date.now() < killDeadline) {
      await delay(100);
    }
  }
}

async function waitForPortReleased(host, port, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!(await isPortInUse(host, port)) && !isPortInUseViaLsof(port)) {
      return true;
    }
    await delay(200);
  }
  return false;
}

async function runSingleAttempt({ attempt, attempts, host, port, baseUrl, startupTimeoutMs }) {
  if ((await isPortInUse(host, port)) || isPortInUseViaLsof(port)) {
    throw new Error(
      `Port ${port} is already in use before web:dev-smoke. ` +
        `Stop existing local servers so this stage validates the pnpm dev process it spawns.`
    );
  }

  const logs = [];
  const child = spawn("pnpm", ["dev"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: "0",
    },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const processRef = {
    exited: false,
    code: null,
    logs,
  };

  child.stdout?.on("data", (chunk) => {
    logs.push(chunk.toString());
  });
  child.stderr?.on("data", (chunk) => {
    logs.push(chunk.toString());
  });
  child.on("exit", (code) => {
    processRef.exited = true;
    processRef.code = code;
  });

  try {
    console.log(`[web:dev-smoke] cycle ${attempt}/${attempts}`);
    await waitForReady({
      host,
      port,
      timeoutMs: startupTimeoutMs,
      pollMs: 400,
      processRef,
    });

    let logCursor = processRef.logs.join("").length;

    for (const route of ROUTES) {
      console.log(`[web:dev-smoke] probing ${route}`);
      if (processRef.exited) {
        throw new Error(
          `pnpm dev exited while probing ${route} (code=${processRef.code}).\n` +
            `Recent server output:\n${truncate(processRef.logs.join(""))}`
        );
      }

      const response = await fetchWithTimeout(`${baseUrl}${route}`, {
        redirect: "manual",
        cache: "no-store",
      });
      await delay(200);

      const combinedLogs = processRef.logs.join("");
      const requestLogWindow = combinedLogs.slice(logCursor);
      logCursor = combinedLogs.length;

      if (FIRST_HIT_ROUTES.has(route)) {
        const matchedPattern = findServerLogFailurePattern(requestLogWindow);
        if (matchedPattern) {
          throw new Error(
            `First-hit log window for ${route} contains missing-runtime/manifest failure (${matchedPattern}).\n` +
              `Window output:\n${truncate(requestLogWindow)}`
          );
        }
      }

      if (response.status !== 200) {
        const body =
          (await Promise.race([
            response.text(),
            delay(5000, "__body_read_timeout__"),
          ])) ?? "";
        throw new Error(
          `Route ${route} returned ${response.status}, expected 200.\n` +
            `Response preview:\n${truncate(body, 1200)}\n` +
            `First-hit log window:\n${truncate(requestLogWindow)}`
        );
      }
      console.log(`[web:dev-smoke] ${route} -> 200`);
    }

    await assertServerArtifacts(process.cwd());
    assertNoServerLogFailures(logs);
    console.log(`[web:dev-smoke] cycle ${attempt}/${attempts} PASS`);
  } finally {
    await stopProcess(child, processRef);
    const released = await waitForPortReleased(host, port);
    if (!released) {
      throw new Error(
        `pnpm dev cleanup left port ${port} in use. ` +
          `This indicates a stale dev process that can mask real failures.`
      );
    }
  }
}

async function main() {
  const host = "127.0.0.1";
  const port = 3000;
  const baseUrl = `http://${host}:${port}`;
  const attempts = Number.parseInt(process.env.WEB_DEV_SMOKE_CYCLES ?? "2", 10);
  const startupTimeoutMs = Number.parseInt(process.env.WEB_DEV_SMOKE_TIMEOUT_MS ?? "150000", 10);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await runSingleAttempt({ attempt, attempts, host, port, baseUrl, startupTimeoutMs });
  }

  console.log("[web:dev-smoke] PASS");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
