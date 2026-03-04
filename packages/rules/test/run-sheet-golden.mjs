#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const update = args.includes("--update");
const forwardArgs = args.filter((arg) => arg !== "--update");

const result = spawnSync(
  "vitest",
  ["run", "test/sheet.golden.test.ts", ...forwardArgs],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      UPDATE_GOLDEN: update ? "1" : process.env.UPDATE_GOLDEN
    }
  }
);

process.exit(typeof result.status === "number" ? result.status : 1);
