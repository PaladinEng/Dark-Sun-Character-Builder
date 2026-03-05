import { readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { lintPacks } from "../src";
import { loadPackFromDir } from "../src/load";

const PACK_PRIORITY = ["srd52", "darksun"] as const;

function comparePackId(a: string, b: string): number {
  const ai = PACK_PRIORITY.indexOf(a as (typeof PACK_PRIORITY)[number]);
  const bi = PACK_PRIORITY.indexOf(b as (typeof PACK_PRIORITY)[number]);
  const ar = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
  const br = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
  if (ar !== br) {
    return ar - br;
  }
  return a.localeCompare(b);
}

async function resolvePackRoot(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "apps", "web", "content", "packs"),
    path.resolve(cwd, "..", "..", "apps", "web", "content", "packs")
  ];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Unable to locate content packs directory for lint test.");
}

describe("repository content pack lint", () => {
  it("has no lint errors for checked-in packs", async () => {
    const packRoot = await resolvePackRoot();
    const entries = await readdir(packRoot, { withFileTypes: true });
    const packDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const loaded = await Promise.all(
      packDirs.map((dirName) => loadPackFromDir(path.join(packRoot, dirName)))
    );
    const packs = [...loaded].sort((a, b) =>
      comparePackId(a.manifest.id, b.manifest.id)
    );
    const report = lintPacks(packs);

    expect(report.errors).toEqual([]);
  });
});
