import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { cache } from "react";
import { loadPackFromDir, mergePacks } from "@dark-sun/content";

async function resolvePacksDir(): Promise<string> {
  const candidates = [
    join(process.cwd(), "content", "packs"),
    join(process.cwd(), "apps", "web", "content", "packs")
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error(`Unable to locate packs directory. Tried: ${candidates.join(", ")}`);
}

async function discoverPackDirectories(): Promise<string[]> {
  const packsDir = await resolvePacksDir();
  const entries = await readdir(packsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packsDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

export const getLoadedContent = cache(async () => {
  const packDirs = await discoverPackDirectories();
  const packs = await Promise.all(packDirs.map((dir) => loadPackFromDir(dir)));
  const merged = mergePacks(packs);

  return {
    packs,
    ...merged
  };
});
