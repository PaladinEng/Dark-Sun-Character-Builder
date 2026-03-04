import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { SeedPackSchema, normalizeSeedPack } from "@dark-sun/content";

type EntityWithId = { id: string };

const PACK_ID = "srd52";
const PACK_ROOT = path.resolve(
  process.cwd(),
  "apps/web/content/packs",
  PACK_ID,
);
const SEED_FILE = path.join(PACK_ROOT, "_seed", "seed.json");

const GENERATED_DIRS = {
  species: path.join(PACK_ROOT, "species"),
  backgrounds: path.join(PACK_ROOT, "backgrounds"),
  classes: path.join(PACK_ROOT, "classes"),
  features: path.join(PACK_ROOT, "features"),
  feats: path.join(PACK_ROOT, "feats"),
  equipment: path.join(PACK_ROOT, "equipment"),
} as const;

function slugFromId(id: string): string {
  const segments = id.split(":");
  return segments[segments.length - 1] ?? id;
}

async function clearGeneratedDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(
    entries.map((entry) =>
      rm(path.join(dir, entry.name), {
        recursive: entry.isDirectory(),
        force: true,
      }),
    ),
  );
}

async function writeEntities(
  dir: string,
  entities: readonly EntityWithId[],
): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const entity of entities) {
    const filename = `${slugFromId(entity.id)}.json`;
    const filePath = path.join(dir, filename);
    await writeFile(filePath, `${JSON.stringify(entity, null, 2)}\n`, "utf8");
  }
}

function validateNormalizedEntities(normalized: {
  species?: unknown[];
  backgrounds?: unknown[];
  classes?: unknown[];
  features?: unknown[];
  feats?: unknown[];
  equipment?: unknown[];
}): void {
  for (const _entry of normalized.species ?? []) {
    void _entry;
  }
  for (const _entry of normalized.backgrounds ?? []) {
    void _entry;
  }
  for (const _entry of normalized.classes ?? []) {
    void _entry;
  }
  for (const _entry of normalized.features ?? []) {
    void _entry;
  }
  for (const _entry of normalized.feats ?? []) {
    void _entry;
  }
  for (const _entry of normalized.equipment ?? []) {
    void _entry;
  }
}

async function main(): Promise<void> {
  const raw = await readFile(SEED_FILE, "utf8");
  const seed = SeedPackSchema.parse(JSON.parse(raw));
  const normalized = normalizeSeedPack(seed, PACK_ID);

  validateNormalizedEntities(normalized);

  await Promise.all(
    Object.values(GENERATED_DIRS).map((dir) => clearGeneratedDir(dir)),
  );

  await writeEntities(GENERATED_DIRS.species, normalized.species ?? []);
  await writeEntities(GENERATED_DIRS.backgrounds, normalized.backgrounds ?? []);
  await writeEntities(GENERATED_DIRS.classes, normalized.classes ?? []);
  await writeEntities(GENERATED_DIRS.features, normalized.features ?? []);
  await writeEntities(GENERATED_DIRS.feats, normalized.feats ?? []);
  await writeEntities(GENERATED_DIRS.equipment, normalized.equipment ?? []);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
