import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import {
  BackgroundSchema,
  ClassSchema,
  EquipmentSchema,
  FeatSchema,
  FeatureSchema,
  SpeciesSchema,
  type Background,
  type Class,
  type Equipment,
  type Feat,
  type Feature,
  type Species
} from "./entities";
import { PackManifestSchema, type PackManifest } from "./manifest";

export interface Pack {
  manifest: PackManifest;
  entities: {
    species: Species[];
    backgrounds: Background[];
    classes: Class[];
    features: Feature[];
    feats: Feat[];
    equipment: Equipment[];
  };
}

async function readJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function readEntityDir<T>(
  packId: string,
  dir: string,
  schema: z.ZodSchema<T>
): Promise<T[]> {
  let files: string[];
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith(".json"));
  } catch (error) {
    const typed = error as { code?: string };
    if (typed.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  files.sort((a, b) => a.localeCompare(b));
  const output: T[] = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const parsed = await readJson(fullPath);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Invalid content file (pack=${packId}, file=${file}): ${JSON.stringify(result.error.issues)}`
      );
    }
    output.push(result.data);
  }

  return output;
}

export async function loadPackFromDir(dir: string): Promise<Pack> {
  const manifest = PackManifestSchema.parse(await readJson(path.join(dir, "pack.json")));

  return {
    manifest,
    entities: {
      species: await readEntityDir(manifest.id, path.join(dir, "species"), SpeciesSchema),
      backgrounds: await readEntityDir(
        manifest.id,
        path.join(dir, "backgrounds"),
        BackgroundSchema
      ),
      classes: await readEntityDir(manifest.id, path.join(dir, "classes"), ClassSchema),
      features: await readEntityDir(manifest.id, path.join(dir, "features"), FeatureSchema),
      feats: await readEntityDir(manifest.id, path.join(dir, "feats"), FeatSchema),
      equipment: await readEntityDir(
        manifest.id,
        path.join(dir, "equipment"),
        EquipmentSchema
      )
    }
  };
}
