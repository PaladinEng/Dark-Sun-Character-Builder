import "server-only";

import { readdir } from "node:fs/promises";
import path from "node:path";

import type {
  MergeProvenance,
  Background,
  Class,
  Equipment,
  MergedContent,
  MergeReport,
  PackManifest,
  Species,
  Subclass,
} from "@dark-sun/content";
import { mergePacks, mergePacksWithProvenance } from "@dark-sun/content";
import type { Pack } from "@dark-sun/content/node";
import { loadPackFromDir } from "@dark-sun/content/node";
import {
  applySettingContentOverrides,
  getResolvedPackSettings,
} from "./packSettings";

export type LoadedPackManifest = {
  id: string;
  name: string;
  version: string;
  license: string;
  source?: string;
  attributionText?: string;
};

export type MergedContentResult = MergedContent & {
  packs: Array<{ manifest: LoadedPackManifest }>;
  content: MergedContent;
  report: MergeReport;
  enabledPackIds: string[];
  provenance?: MergeProvenance;
};

type ContentOptions = {
  species: Species[];
  backgrounds: Background[];
  classes: Class[];
  subclasses: Subclass[];
  armor: Equipment[];
  shields: Equipment[];
  weapons: Equipment[];
  adventuringGear: Equipment[];
};

type ContentCache = {
  allPacks?: Pack[];
  mergedByKey: Map<string, MergedContentResult>;
};

declare global {
  // eslint-disable-next-line no-var
  var __darkSunContentCache: ContentCache | undefined;
}

const SOURCE_STORAGE_KEY = "darksun-builder:sources";
const SOURCE_PRIORITY = ["srd52", "darksun"] as const;

function getCache(): ContentCache {
  if (!globalThis.__darkSunContentCache) {
    globalThis.__darkSunContentCache = { mergedByKey: new Map() };
  }
  return globalThis.__darkSunContentCache;
}

function comparePackId(a: string, b: string): number {
  const ai = SOURCE_PRIORITY.indexOf(a as (typeof SOURCE_PRIORITY)[number]);
  const bi = SOURCE_PRIORITY.indexOf(b as (typeof SOURCE_PRIORITY)[number]);
  const ar = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
  const br = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
  if (ar !== br) {
    return ar - br;
  }
  return a.localeCompare(b);
}

function sortByManifestId<T extends { manifest: { id: string } }>(items: T[]): T[] {
  return [...items].sort((a, b) => comparePackId(a.manifest.id, b.manifest.id));
}

function toLoadedManifest(manifest: PackManifest): LoadedPackManifest {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    license: manifest.license,
    source: manifest.source,
    attributionText: manifest.attributionText,
  };
}

async function resolvePackRoot(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "content", "packs"),
    path.resolve(cwd, "apps", "web", "content", "packs"),
  ];

  for (const candidate of candidates) {
    try {
      await readdir(candidate);
      return candidate;
    } catch {
      // Continue searching.
    }
  }

  return candidates[0];
}

export async function loadAllPacks(): Promise<Pack[]> {
  const cache = getCache();
  if (cache.allPacks) {
    return cache.allPacks;
  }

  const root = await resolvePackRoot();
  const entries = await readdir(root, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const packs = await Promise.all(
    dirs.map((dirName) => loadPackFromDir(path.join(root, dirName))),
  );

  cache.allPacks = sortByManifestId(packs);
  return cache.allPacks;
}

export function getDefaultEnabledPackIds(packs: Pack[]): string[] {
  return packs
    .map((pack) => pack.manifest.id)
    .sort((a, b) => comparePackId(a, b));
}

export function parseSourcesParam(
  value: string | string[] | undefined,
): string[] {
  if (typeof value === "undefined") {
    return [];
  }

  const chunks = Array.isArray(value) ? value : [value];
  const parsed = chunks
    .flatMap((chunk) => chunk.split(","))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return Array.from(new Set(parsed)).sort((a, b) => comparePackId(a, b));
}

export function filterPacks(packs: Pack[], enabledIds: string[]): Pack[] {
  if (enabledIds.length === 0) {
    return sortByManifestId(packs);
  }

  const enabled = new Set(enabledIds);
  return sortByManifestId(
    packs.filter((pack) => enabled.has(pack.manifest.id)),
  );
}

export const selectPacksById = filterPacks;

export function formatSourceLabel(manifest: LoadedPackManifest): string {
  if (manifest.id === "srd52") {
    return "D&D SRD";
  }
  if (manifest.id === "darksun") {
    return "Dark Sun Homebrew";
  }
  return manifest.name;
}

export async function getMergedContent(
  enabledPackIds?: string[],
  options?: {
    includeProvenance?: boolean;
  },
): Promise<MergedContentResult> {
  const packs = await loadAllPacks();
  const allIds = new Set(packs.map((pack) => pack.manifest.id));
  const requested = enabledPackIds ?? [];
  const resolvedIds =
    requested.length === 0
      ? getDefaultEnabledPackIds(packs)
      : requested.filter((id) => allIds.has(id)).sort((a, b) => comparePackId(a, b));

  const finalIds = resolvedIds.length > 0 ? resolvedIds : getDefaultEnabledPackIds(packs);
  const includeProvenance = options?.includeProvenance === true;
  const cacheKey = includeProvenance
    ? `${finalIds.join(",")}|provenance`
    : finalIds.join(",");
  const cache = getCache();
  const cached = cache.mergedByKey.get(cacheKey);
  if (cached) {
    return cached;
  }

  const selected = filterPacks(packs, finalIds);
  const merged = includeProvenance
    ? mergePacksWithProvenance(selected)
    : mergePacks(selected);
  const provenance: MergeProvenance | undefined = includeProvenance
    ? (merged as ReturnType<typeof mergePacksWithProvenance>).provenance
    : undefined;
  const settingProfile = await getResolvedPackSettings(finalIds);
  const content = applySettingContentOverrides(merged.content, settingProfile);

  const result: MergedContentResult = {
    ...content,
    packs: selected.map((pack) => ({ manifest: toLoadedManifest(pack.manifest) })),
    content,
    report: merged.report,
    enabledPackIds: finalIds,
    provenance
  };

  cache.mergedByKey.set(cacheKey, result);
  return result;
}

export async function mergeSelectedPacks(
  enabledPackIds: string[],
): Promise<{ packs: Pack[]; merged: ReturnType<typeof mergePacks> }> {
  const allPacks = await loadAllPacks();
  const selected = filterPacks(allPacks, enabledPackIds);
  return {
    packs: selected,
    merged: mergePacks(selected),
  };
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export function getContentOptionsFromMerged(content: MergedContent): ContentOptions {
  const species = sortByName(content.species);
  const backgrounds = sortByName(content.backgrounds);
  const classes = sortByName(content.classes);
  const subclasses = sortByName(content.subclasses ?? []);
  const equipment = sortByName(content.equipment);

  return {
    species,
    backgrounds,
    classes,
    subclasses,
    armor: equipment.filter(
      (item) =>
        item.type === "armor_light" ||
        item.type === "armor_medium" ||
        item.type === "armor_heavy",
    ),
    shields: equipment.filter((item) => item.type === "shield"),
    weapons: equipment.filter((item) => item.type === "weapon"),
    adventuringGear: equipment.filter((item) => item.type === "adventuring_gear"),
  };
}

export async function getContentOptions(
  enabledPackIds?: string[],
): Promise<ContentOptions> {
  const merged = await getMergedContent(enabledPackIds);
  return getContentOptionsFromMerged(merged.content);
}

export { SOURCE_STORAGE_KEY };
