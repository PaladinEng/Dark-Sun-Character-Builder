#!/usr/bin/env node

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const packRoot = path.join(repoRoot, "apps", "web", "content", "packs");
const darkSunProfilePath = path.join(packRoot, "darksun", "settings", "profile.json");
const ENTITY_TYPES = ["species", "backgrounds", "classes", "spelllists", "spells"];

const EXPECTED_DARKSUN_SPECIES = [
  "darksun:species:athasian-aarakocra",
  "darksun:species:athasian-dwarf",
  "darksun:species:athasian-elf",
  "darksun:species:athasian-half-giant",
  "darksun:species:athasian-halfling",
  "darksun:species:athasian-human",
  "darksun:species:mul",
  "darksun:species:thri-kreen",
];

function sortValues(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base, incoming) {
  if (Array.isArray(base) && Array.isArray(incoming)) {
    return incoming;
  }

  if (isPlainObject(base) && isPlainObject(incoming)) {
    const out = { ...base };
    for (const [key, next] of Object.entries(incoming)) {
      const previous = out[key];
      if (Array.isArray(next)) {
        out[key] = next;
      } else if (isPlainObject(previous) && isPlainObject(next)) {
        out[key] = deepMerge(previous, next);
      } else {
        out[key] = next;
      }
    }
    return out;
  }

  return incoming;
}

function toById(items) {
  return Object.fromEntries(items.map((entry) => [entry.id, entry]));
}

function getClassSpellListRefIds(klass) {
  return klass.spellListRefIds ?? klass.spellListRefs ?? [];
}

async function loadEntityDir(packId, entityType) {
  const dir = path.join(packRoot, packId, entityType);
  try {
    const entries = await readdir(dir);
    const jsonFiles = entries.filter((entry) => entry.endsWith(".json")).sort((left, right) => left.localeCompare(right));
    return Promise.all(
      jsonFiles.map(async (fileName) =>
        JSON.parse(await readFile(path.join(dir, fileName), "utf8")),
      ),
    );
  } catch {
    return [];
  }
}

async function loadPack(packId) {
  const entities = {};
  for (const entityType of ENTITY_TYPES) {
    entities[entityType] = await loadEntityDir(packId, entityType);
  }
  return entities;
}

function mergeEntityArrays(currentItems, incomingItems, sourcePackId) {
  const byId = new Map(currentItems.map((entry) => [entry.id, entry]));

  for (const entity of incomingItems) {
    const next = {
      ...entity,
      sourcePackId,
    };

    if (next.replaces) {
      byId.delete(next.replaces);
      byId.set(next.id, next);
      continue;
    }

    const existing = byId.get(next.id);
    byId.set(next.id, existing ? deepMerge(existing, next) : next);
  }

  return [...byId.values()];
}

async function loadMergedContent(packIds) {
  const loadedPacks = await Promise.all(packIds.map((packId) => loadPack(packId)));
  const merged = {
    species: [],
    backgrounds: [],
    classes: [],
    spellLists: [],
    spells: [],
  };

  loadedPacks.forEach((pack, index) => {
    const sourcePackId = packIds[index];
    merged.species = mergeEntityArrays(merged.species, pack.species, sourcePackId);
    merged.backgrounds = mergeEntityArrays(merged.backgrounds, pack.backgrounds, sourcePackId);
    merged.classes = mergeEntityArrays(merged.classes, pack.classes, sourcePackId);
    merged.spellLists = mergeEntityArrays(merged.spellLists, pack.spelllists, sourcePackId);
    merged.spells = mergeEntityArrays(merged.spells, pack.spells, sourcePackId);
  });

  return {
    ...merged,
    speciesById: toById(merged.species),
    backgroundsById: toById(merged.backgrounds),
    classesById: toById(merged.classes),
    spellListsById: toById(merged.spellLists),
    spellsById: toById(merged.spells),
  };
}

function applyClassSpellListOverrides(content, overrides) {
  if (Object.keys(overrides).length === 0) {
    return content;
  }

  const classes = content.classes.map((entry) => {
    const overrideIds = overrides[entry.id];
    if (!overrideIds) {
      return entry;
    }

    return {
      ...entry,
      spellListRefIds: [...overrideIds],
      spellListRefs: [...overrideIds],
    };
  });

  return {
    ...content,
    classes,
    classesById: Object.fromEntries(classes.map((entry) => [entry.id, entry])),
  };
}

function applyReplacementFilters(content, profile) {
  const speciesReplacementIds =
    profile.speciesReplacementIds.length > 0 ? new Set(profile.speciesReplacementIds) : null;
  const backgroundReplacementIds =
    profile.backgroundReplacementIds.length > 0 ? new Set(profile.backgroundReplacementIds) : null;

  const species = speciesReplacementIds
    ? content.species.filter((entry) => speciesReplacementIds.has(entry.id))
    : content.species;
  const backgrounds = backgroundReplacementIds
    ? content.backgrounds.filter((entry) => backgroundReplacementIds.has(entry.id))
    : content.backgrounds;

  return {
    ...content,
    species,
    backgrounds,
    speciesById: Object.fromEntries(species.map((entry) => [entry.id, entry])),
    backgroundsById: Object.fromEntries(backgrounds.map((entry) => [entry.id, entry])),
  };
}

function getClassSpellListIds(content, classId) {
  const klass = content.classesById[classId];
  assert(klass, `Missing class ${classId}`);
  return getClassSpellListRefIds(klass);
}

function assertSpellListOverride(content, classId, expectedSpellListIds) {
  const actualSpellListIds = getClassSpellListIds(content, classId);
  assert.deepEqual(
    actualSpellListIds,
    expectedSpellListIds,
    `Unexpected spell lists for ${classId}: ${actualSpellListIds.join(", ")}`,
  );

  for (const spellListId of expectedSpellListIds) {
    const spellList = content.spellListsById[spellListId];
    assert(spellList, `Missing spell list ${spellListId}`);
    assert(spellList.spellIds.length > 0, `Spell list ${spellListId} is empty`);
  }
}

async function main() {
  const profile = JSON.parse(await readFile(darkSunProfilePath, "utf8"));

  const srdOnly = await loadMergedContent(["srd52"]);
  const darkSunMerged = await loadMergedContent(["srd52", "darksun"]);
  const darkSun = applyReplacementFilters(
    applyClassSpellListOverrides(darkSunMerged, profile.classSpellListOverrides ?? {}),
    profile,
  );

  const darkSunSpeciesIds = sortValues(darkSun.species.map((entry) => entry.id));
  assert.deepEqual(
    darkSunSpeciesIds,
    sortValues(EXPECTED_DARKSUN_SPECIES),
    `Dark Sun species replacement drifted: ${darkSunSpeciesIds.join(", ")}`,
  );
  assert.deepEqual(
    darkSunSpeciesIds,
    sortValues(profile.speciesReplacementIds ?? []),
    "Dark Sun settings speciesReplacementIds do not match merged species",
  );

  const darkSunBackgroundIds = sortValues(darkSun.backgrounds.map((entry) => entry.id));
  assert((profile.backgroundReplacementIds ?? []).length > 0, "Dark Sun background replacement ids are empty");
  assert.deepEqual(
    darkSunBackgroundIds,
    sortValues(profile.backgroundReplacementIds ?? []),
    "Dark Sun backgrounds no longer match settings backgroundReplacementIds",
  );
  assert(
    darkSunBackgroundIds.every((id) => id.startsWith("darksun:background:")),
    `SRD background leaked into Dark Sun: ${darkSunBackgroundIds.join(", ")}`,
  );

  assertSpellListOverride(srdOnly, "srd52:class:wizard", ["srd52:spelllist:wizard-core"]);
  assertSpellListOverride(srdOnly, "srd52:class:warlock", ["srd52:spelllist:warlock-core"]);
  assertSpellListOverride(srdOnly, "srd52:class:druid", ["srd52:spelllist:druid-core"]);
  assertSpellListOverride(srdOnly, "srd52:class:ranger", ["srd52:spelllist:ranger-core"]);

  assertSpellListOverride(darkSun, "srd52:class:wizard", ["darksun:spelllist:tradition:arcane"]);
  assertSpellListOverride(darkSun, "srd52:class:warlock", ["darksun:spelllist:tradition:arcane"]);
  assertSpellListOverride(darkSun, "srd52:class:druid", ["darksun:spelllist:tradition:nature"]);
  assertSpellListOverride(darkSun, "srd52:class:ranger", ["darksun:spelllist:tradition:nature"]);
  assertSpellListOverride(darkSun, "darksun:class:elemental-cleric", [
    "darksun:spelllist:elemental-cleric:shared",
  ]);

  console.log(
    JSON.stringify(
      {
        srdOnly: {
          speciesCount: srdOnly.species.length,
          backgroundCount: srdOnly.backgrounds.length,
          classCount: srdOnly.classes.length,
        },
        darkSun: {
          species: darkSun.species.map((entry) => entry.name),
          backgroundCount: darkSun.backgrounds.length,
          classSpellLists: {
            wizard: getClassSpellListIds(darkSun, "srd52:class:wizard"),
            warlock: getClassSpellListIds(darkSun, "srd52:class:warlock"),
            druid: getClassSpellListIds(darkSun, "srd52:class:druid"),
            ranger: getClassSpellListIds(darkSun, "srd52:class:ranger"),
            elementalCleric: getClassSpellListIds(darkSun, "darksun:class:elemental-cleric"),
          },
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
