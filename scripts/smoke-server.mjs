import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

function truncate(text, max = 4000) {
  if (text.length <= max) {
    return text;
  }
  return text.slice(text.length - max);
}

async function waitForReady({ baseUrl, readyPath, timeoutMs, pollMs, processRef }) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (processRef.exited) {
      throw new Error(
        `Web dev server exited before becoming ready (code=${processRef.code}).\n` +
          `Recent server output:\n${truncate(processRef.logs.join(""))}`
      );
    }

    try {
      const response = await fetch(`${baseUrl}${readyPath}`, {
        redirect: "manual",
        cache: "no-store",
      });
      if (response.status >= 200 && response.status < 500) {
        return;
      }
    } catch {
      // keep polling
    }

    await delay(pollMs);
  }

  throw new Error(
    `Timed out waiting for server readiness at ${baseUrl}${readyPath}.\n` +
      `Recent server output:\n${truncate(processRef.logs.join(""))}`
  );
}

export async function startWebDevServer({
  repoRoot,
  port = 4010,
  host = "127.0.0.1",
  readyPath = "/builder",
  startupTimeoutMs = 120000,
  pollMs = 400,
} = {}) {
  const logs = [];
  const args = ["--filter", "web", "dev", "--hostname", host, "--port", String(port)];
  const child = spawn("pnpm", args, {
    cwd: repoRoot,
    env: { ...process.env, FORCE_COLOR: "0" },
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

  const baseUrl = `http://${host}:${port}`;
  await waitForReady({ baseUrl, readyPath, timeoutMs: startupTimeoutMs, pollMs, processRef });

  const stop = async () => {
    if (processRef.exited) {
      return;
    }

    child.kill("SIGTERM");
    const deadline = Date.now() + 8000;
    while (!processRef.exited && Date.now() < deadline) {
      await delay(150);
    }
    if (!processRef.exited) {
      child.kill("SIGKILL");
      const killDeadline = Date.now() + 3000;
      while (!processRef.exited && Date.now() < killDeadline) {
        await delay(100);
      }
    }
  };

  return {
    baseUrl,
    logs,
    stop,
  };
}
