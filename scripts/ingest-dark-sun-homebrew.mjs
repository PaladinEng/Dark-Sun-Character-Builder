import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourceDir = path.join(root, "dark-sun-homebrew");
const packDir = path.join(root, "apps/web/content/packs/darksun");
const srdSpellDir = path.join(root, "apps/web/content/packs/srd52/spells");

const REWRITE_DIRS = [
  "backgrounds",
  "species",
  "classes",
  "subclasses",
  "spelllists",
  "features",
  "feats",
  "skills",
  "settings",
];

const ELEMENTAL_DOMAIN_IDS = new Set(["air", "earth", "fire", "water"]);
const SOURCE_SUBCLASS_RESTRICTIONS = [
  "barbarian_path_of_the_zealot",
  "druid_circle_of_the_sea",
  "fighter_eldritch_knight",
  "monk_warrior_of_shadow",
  "ranger_fey_wanderer",
  "ranger_gloom_stalker",
  "rogue_arcane_trickster",
  "warlock_archfey",
];

const KNOWN_SUBCLASS_RESTRICTIONS = [
  "srd52:subclass:archfey",
  "srd52:subclass:arcane-trickster",
  "srd52:subclass:eldritch-knight",
  "srd52:subclass:way-of-shadow",
  "srd52:subclass:college-of-lore",
  "srd52:subclass:college-of-valor",
];

const SKILL_ID_MAP = new Map([
  ["animal handling", "animal_handling"],
  ["sleight of hand", "sleight_of_hand"],
]);

const FEAT_ID_MAP = new Map([
  ["srd52:feat:telepathic", "darksun:feat:telepathic"],
  ["srd52:feat:telekinetic", "darksun:feat:telekinetic"],
]);

function toAscii(value) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ");
}

function normalizeText(value) {
  return toAscii(value).trim();
}

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeJson(value) {
  if (typeof value === "string") {
    return normalizeText(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalizeJson(entry)]),
    );
  }
  return value;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function featureFileName(id) {
  return `${id.replace(/^darksun:feature:/, "").replace(/:/g, "--")}.json`;
}

async function ensureCleanDirs() {
  await fs.mkdir(packDir, { recursive: true });
  for (const dirName of REWRITE_DIRS) {
    const fullPath = path.join(packDir, dirName);
    await fs.rm(fullPath, { recursive: true, force: true });
    await fs.mkdir(fullPath, { recursive: true });
  }
}

function normalizeSkillId(value) {
  const key = normalizeText(value).toLowerCase();
  return SKILL_ID_MAP.get(key) ?? key.replace(/[^a-z0-9]+/g, "_");
}

async function loadSrdSpellIndex() {
  const byName = new Map();
  const files = (await fs.readdir(srdSpellDir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));
  for (const file of files) {
    const spell = await readJson(path.join(srdSpellDir, file));
    byName.set(cleanSpellName(spell.name), spell.id);
  }
  return byName;
}

function cleanSpellName(value) {
  return normalizeText(value)
    .replace(/\s*\([^)]*\)/g, "")
    .toLowerCase();
}

function spellNamesToIds(names, spellIdsByName) {
  const spellIds = [];
  const unsupportedNames = [];
  const seenIds = new Set();
  for (const name of names) {
    const spellId = spellIdsByName.get(cleanSpellName(name));
    if (!spellId) {
      unsupportedNames.push(normalizeText(name));
      continue;
    }
    if (seenIds.has(spellId)) {
      continue;
    }
    seenIds.add(spellId);
    spellIds.push(spellId);
  }
  return { spellIds, unsupportedNames };
}

function describeSpellListTodo(sourceId, unsupportedNames) {
  if (unsupportedNames.length === 0) {
    return undefined;
  }
  return (
    `TODO: additional source spells for ${sourceId} are preserved in ` +
    `settings/elemental-cleric-spell-source.json because native spell entities do not yet exist.`
  );
}

function joinDescription(...parts) {
  return parts.filter((part) => typeof part === "string" && part.trim().length > 0).join(" ");
}

async function ingestBackgrounds() {
  const dir = path.join(sourceDir, "backgrounds");
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const raw = normalizeJson(await readJson(path.join(dir, file)));
    const effects = (raw.effects ?? []).map((effect) => {
      if (effect.type === "grant_skill_proficiency") {
        return {
          ...effect,
          skill: normalizeSkillId(effect.skill),
        };
      }
      return effect;
    });
    const startingEquipment = raw.startingEquipment?.itemIds?.length
      ? raw.startingEquipment
      : undefined;
    const grantsFeat = FEAT_ID_MAP.get(raw.grantsFeat) ?? raw.grantsFeat;
    const grantsOriginFeatId = FEAT_ID_MAP.get(raw.grantsOriginFeatId) ?? raw.grantsOriginFeatId;

    const background = {
      id: raw.id,
      name: raw.name,
      abilityOptions: raw.abilityOptions,
      effects,
      description: raw.description,
      ...(grantsFeat ? { grantsFeat } : {}),
      ...(grantsOriginFeatId ? { grantsOriginFeatId } : {}),
      ...(startingEquipment ? { startingEquipment } : {}),
    };

    await writeJson(path.join(packDir, "backgrounds", file), background);
  }
}

async function ingestSpecies() {
  const dir = path.join(sourceDir, "species");
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const raw = normalizeJson(await readJson(path.join(dir, file)));
    const speciesId = `darksun:species:${file.replace(/\.json$/, "")}`;
    const species = {
      id: speciesId,
      name: raw.name,
      effects: raw.effects,
      description: raw.description,
    };
    await writeJson(path.join(packDir, "species", file), species);
  }
}

function buildElementalClericFeatures(rawClass) {
  const featureDescriptions = {
    "darksun:feature:elemental-calling": [
      "Choose one calling at 1st level:",
      ...rawClass.notes.customFeatures["darksun:feature:elemental-calling"]
        .split(". ")
        .map((entry) => entry.trim())
        .filter(Boolean),
      "",
      "Callings preserved as TODO metadata:",
      ...rawClass.notes.callings,
    ].join("\n"),
    "darksun:feature:elemental-channeling":
      rawClass.notes.customFeatures["darksun:feature:elemental-channeling"],
    "darksun:feature:elemental-domain":
      rawClass.notes.customFeatures["darksun:feature:elemental-domain"],
    "darksun:feature:sear-undead":
      rawClass.notes.customFeatures["darksun:feature:sear-undead"],
    "darksun:feature:sacrifice-for-the-land":
      `${rawClass.notes.customFeatures["darksun:feature:sacrifice-for-the-land"]}\nTODO: defiler interaction remains a stub until defiling mechanics are implemented.`,
    "darksun:feature:elemental-strikes":
      rawClass.notes.customFeatures["darksun:feature:elemental-strikes"],
    "darksun:feature:elemental-intervention":
      rawClass.notes.customFeatures["darksun:feature:elemental-intervention"],
    "darksun:feature:improved-elemental-strikes":
      rawClass.notes.customFeatures["darksun:feature:improved-elemental-strikes"],
    "darksun:feature:greater-elemental-intervention":
      rawClass.notes.customFeatures["darksun:feature:greater-elemental-intervention"],
  };

  return Object.entries(featureDescriptions).map(([id, description]) => ({
    id,
    name: id.split(":").at(-1).split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "),
    description: normalizeText(description),
  }));
}

async function ingestClasses() {
  const rawClass = normalizeJson(
    await readJson(path.join(sourceDir, "classes/elemental-cleric.json")),
  );

  const elementalCleric = {
    id: rawClass.id,
    name: rawClass.name,
    hitDie: rawClass.hitDie,
    classSkillChoices: {
      ...rawClass.classSkillChoices,
      from: rawClass.classSkillChoices.from.map((skillId) => normalizeSkillId(skillId)),
    },
    weaponProficiencies: rawClass.weaponProficiencies,
    spellcasting: rawClass.spellcasting,
    spellListRefIds: ["darksun:spelllist:elemental-cleric:shared"],
    classFeaturesByLevel: rawClass.classFeaturesByLevel,
    startingEquipment: rawClass.startingEquipment,
    effects: rawClass.effects,
    description: normalizeText(rawClass.description),
  };

  await writeJson(
    path.join(packDir, "classes/elemental-cleric.json"),
    elementalCleric,
  );

  const psionicistClass = {
    id: "darksun:class:psionicist",
    name: "Psionicist",
    classFeaturesByLevel: [
      {
        level: 1,
        featureId: "darksun:feature:psionicist-stub",
      },
    ],
    description:
      "Stub class. The Dark Sun setting reserves Psionicist as a selectable class, but its mechanics are intentionally not implemented yet.",
  };

  await writeJson(path.join(packDir, "classes/psionicist.json"), psionicistClass);

  const featureFiles = [
    ...buildElementalClericFeatures(rawClass),
    {
      id: "darksun:feature:psionicist-stub",
      name: "Psionicist Stub",
      description:
        "TODO: Psionicist mechanics remain intentionally unimplemented. This class stub exists so Dark Sun availability can be wired without inventing rules.",
      effects: [
        {
          type: "grant_trait",
          name: "Psionicist Stub",
          description:
            "TODO: Psionicist class mechanics are pending a future engine implementation.",
        },
      ],
    },
  ];

  for (const feature of featureFiles) {
    await writeJson(
      path.join(packDir, "features", featureFileName(feature.id)),
      feature,
    );
  }
}

function makeFeatureId(prefix, name) {
  return `${prefix}:${slugify(name)}`;
}

async function ingestSubclasses() {
  const dir = path.join(sourceDir, "subclasses");
  const files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
  files.sort((left, right) => left.localeCompare(right));

  for (const file of files) {
    const raw = normalizeJson(await readJson(path.join(dir, file)));
    const patron = file.replace(/-domain\.json$/, "");
    const subclassFeaturePrefix = `darksun:feature:${patron}-domain`;
    const domainSpellsFeatureId = `${subclassFeaturePrefix}:domain-spells`;
    const subclassFeaturesByLevel = [
      {
        level: 3,
        featureId: domainSpellsFeatureId,
      },
      ...raw.subclassFeaturesByLevel.map((entry) => ({
        level: entry.level,
        featureId: makeFeatureId(subclassFeaturePrefix, entry.name),
      })),
    ];

    const subclass = {
      id: raw.id,
      classId: raw.classId,
      name: raw.name,
      description: raw.description,
      subclassFeaturesByLevel,
      spellListRefIds: [`darksun:spelllist:elemental-cleric:${patron}`],
      domain: patron,
      effects: [
        {
          type: "grant_trait",
          name: `${raw.name} Training`,
          description: `${raw.name} features apply according to subclass progression.`,
        },
      ],
    };

    await writeJson(path.join(packDir, "subclasses", file), subclass);

    const domainSpellLines = Object.entries(raw.domainSpellsBySpellLevel ?? {})
      .map(([tier, spells]) => `Tier ${tier}: ${(spells ?? []).join(", ")}`)
      .join("\n");
    const featureFiles = [
      {
        id: domainSpellsFeatureId,
        name: `${raw.name} Spells`,
        description:
          `${raw.name} always-prepared domain spell source list:\n${domainSpellLines}\n` +
          "TODO: unsupported spell entities remain preserved in settings/elemental-cleric-spell-source.json.",
      },
      ...raw.subclassFeaturesByLevel.map((entry) => ({
        id: makeFeatureId(subclassFeaturePrefix, entry.name),
        name: entry.name,
        description: entry.description,
      })),
    ];

    for (const feature of featureFiles) {
      await writeJson(
        path.join(packDir, "features", featureFileName(feature.id)),
        feature,
      );
    }
  }

  const bardSubclass = {
    id: "darksun:subclass:athasian-bard-stub",
    classId: "srd52:class:bard",
    name: "Athasian Bard (Stub)",
    description:
      "Stub subclass. Dark Sun uses an Athasian bard replacement, but its mechanics are intentionally deferred.",
    subclassFeaturesByLevel: [
      {
        level: 3,
        featureId: "darksun:feature:athasian-bard-stub",
      },
    ],
    effects: [
      {
        type: "grant_trait",
        name: "Athasian Bard Stub",
        description:
          "TODO: replace baseline bard subclass support with Athasian bard mechanics when that rules package exists.",
      },
    ],
  };

  await writeJson(
    path.join(packDir, "subclasses", "athasian-bard-stub.json"),
    bardSubclass,
  );

  await writeJson(
    path.join(packDir, "features", "athasian-bard-stub.json"),
    {
      id: "darksun:feature:athasian-bard-stub",
      name: "Athasian Bard Stub",
      description:
        "TODO: Athasian bard mechanics are intentionally left as a stub. This placeholder preserves the setting-specific replacement without inventing rules.",
      effects: [
        {
          type: "grant_trait",
          name: "Athasian Bard Stub",
          description:
            "TODO: Athasian bard mechanics are pending a future implementation.",
        },
      ],
    },
  );
}

async function ingestSkills() {
  const raw = normalizeJson(await readJson(path.join(sourceDir, "setting/dark-sun-skills.json")));
  const skillDefinitions = raw.newSkills.map((entry, index) => ({
    id: entry.id,
    name: entry.name,
    ability: entry.ability,
    sortOrder: 19 + index,
    description:
      "Dark Sun expanded skill. These skills exist alongside Arcana, Religion, and Nature.",
  }));

  for (const skill of skillDefinitions) {
    await writeJson(path.join(packDir, "skills", `${skill.id}.json`), skill);
  }
}

async function ingestFeats() {
  const feats = [
    {
      id: "darksun:feat:telepathic",
      name: "Telepathic",
      category: "origin",
      description:
        "Stub feat imported from the Dark Sun bundle. TODO: telepathic feat mechanics are not yet implemented in the native rules engine.",
    },
    {
      id: "darksun:feat:telekinetic",
      name: "Telekinetic",
      category: "origin",
      description:
        "Stub feat imported from the Dark Sun bundle. TODO: telekinetic feat mechanics are not yet implemented in the native rules engine.",
    },
  ];

  for (const feat of feats) {
    await writeJson(path.join(packDir, "feats", `${feat.id.split(":").at(-1)}.json`), feat);
  }
}

async function ingestWildTalents() {
  const raw = normalizeJson(await readJson(path.join(sourceDir, "setting/wild-talent-table.json")));
  for (const entry of raw.table) {
    const feature = {
      id: `darksun:feature:wild-talent:${entry.id}`,
      name: entry.name,
      selectable: true,
      tags: ["wild_talent"],
      description:
        `${entry.name} is a Dark Sun Wild Talent stub selected from the setting table.\n` +
        "TODO: only table assignment is implemented; mechanical resolution remains future work.",
      effects: [
        {
          type: "grant_trait",
          name: entry.name,
          description:
            "Wild Talent stub selected from the Dark Sun setting table. Full mechanics are intentionally pending.",
        },
      ],
    };
    await writeJson(path.join(packDir, "features", `${entry.id}.json`), feature);
  }
}

async function ingestSpellLists(spellIdsByName) {
  const allShared = normalizeJson(
    await readJson(path.join(sourceDir, "spell-lists/elemental-cleric-all-patrons.json")),
  );
  const elementalOnly = normalizeJson(
    await readJson(path.join(sourceDir, "spell-lists/elemental-cleric-elemental-only.json")),
  );

  const sharedNames = Object.values(allShared.spellNamesByLevel ?? {}).flat();
  const shared = spellNamesToIds(sharedNames, spellIdsByName);
  await writeJson(path.join(packDir, "spelllists", "elemental-cleric-shared.json"), {
    id: "darksun:spelllist:elemental-cleric:shared",
    name: "Elemental Cleric Shared Spells",
    description: joinDescription(
      "Native subset of the Dark Sun shared elemental cleric spell access.",
      describeSpellListTodo(allShared.id, shared.unsupportedNames),
    ),
    spellIds: shared.spellIds,
  });

  const elementalOnlyNames = Object.values(elementalOnly.spellNamesByLevel ?? {}).flat();
  const elementalOnlyIds = spellNamesToIds(elementalOnlyNames, spellIdsByName).spellIds;
  const files = (await fs.readdir(path.join(sourceDir, "spell-lists")))
    .filter(
      (file) =>
        file.endsWith(".json") &&
        !file.includes("all-patrons") &&
        !file.includes("elemental-only") &&
        !file.includes("master-tags"),
    )
    .sort((left, right) => left.localeCompare(right));

  const spellSourcePreservation = {};

  for (const file of files) {
    const raw = normalizeJson(await readJson(path.join(sourceDir, "spell-lists", file)));
    const patron = file.replace("elemental-cleric-", "").replace(".json", "");
    spellSourcePreservation[patron] = raw;
    const patronNames = Object.values(raw.spellNamesByLevel ?? {}).flat();
    const patronResult = spellNamesToIds(patronNames, spellIdsByName);
    const spellIds = new Set(
      patronResult.spellIds.filter((spellId) => !shared.spellIds.includes(spellId)),
    );
    if (ELEMENTAL_DOMAIN_IDS.has(patron)) {
      for (const spellId of elementalOnlyIds) {
        if (!shared.spellIds.includes(spellId)) {
          spellIds.add(spellId);
        }
      }
    }

    await writeJson(path.join(packDir, "spelllists", file), {
      id: raw.id,
      name: raw.name,
      description: joinDescription(
        raw.description,
        describeSpellListTodo(raw.id, patronResult.unsupportedNames),
      ),
      spellIds: [...spellIds],
    });
  }

  await writeJson(
    path.join(packDir, "settings", "elemental-cleric-spell-source.json"),
    {
      id: "darksun:setting:elemental-cleric-spell-source",
      description:
        "Authoritative source spell names preserved for future native spell import. Native spell lists currently reference only existing spell entities.",
      shared: allShared,
      elementalOnly,
      patrons: spellSourcePreservation,
    },
  );
}

async function ingestSettings() {
  const languages = normalizeJson(
    await readJson(path.join(sourceDir, "setting/dark-sun-languages.json")),
  );
  const traditions = normalizeJson(
    await readJson(path.join(sourceDir, "setting/dark-sun-traditions.json")),
  );
  const wildTalents = normalizeJson(
    await readJson(path.join(sourceDir, "setting/wild-talent-table.json")),
  );
  const preserver = normalizeJson(
    await readJson(path.join(sourceDir, "setting/preserver-system.json")),
  );
  const settingRules = normalizeJson(
    await readJson(path.join(sourceDir, "setting/dark-sun-setting-rules.json")),
  );

  const profile = {
    id: "darksun:setting:profile",
    packId: "darksun",
    name: "Dark Sun",
    disabledClassIds: [
      "srd52:class:paladin",
      "srd52:class:sorcerer",
    ],
    classReplacements: {
      "srd52:class:cleric": "darksun:class:elemental-cleric",
    },
    disabledSubclassIds: KNOWN_SUBCLASS_RESTRICTIONS,
    unresolvedDisabledSubclassKeys: SOURCE_SUBCLASS_RESTRICTIONS,
    wildTalentRequired: true,
    wildTalentFeatureTag: "wild_talent",
    arcaneCastingModes: settingRules.arcaneCastingModes,
    notes: [
      ...settingRules.notes,
      "Bard uses an Athasian Bard stub subclass.",
      "Psionicist remains a stub class.",
      "Wild Talent selection is currently a table-backed stub.",
    ],
    unsupportedMechanics: [
      "Defiler casting",
      "Psionicist class mechanics",
      "Athasian Bard mechanics",
      "Wild Talent mechanical effects beyond table assignment",
      "Preserver spell-point and Rite of Blood automation",
    ],
  };

  await writeJson(path.join(packDir, "settings", "profile.json"), profile);
  await writeJson(path.join(packDir, "settings", "languages.json"), languages);
  await writeJson(path.join(packDir, "settings", "traditions.json"), traditions);
  await writeJson(path.join(packDir, "settings", "wild-talents.json"), wildTalents);
  await writeJson(path.join(packDir, "settings", "preserver-system.json"), preserver);
  await writeJson(path.join(packDir, "settings", "setting-rules.json"), settingRules);
  await fs.copyFile(
    path.join(sourceDir, "setting/dark-sun-setting-rules-spec.md"),
    path.join(packDir, "settings", "setting-rules-spec.md"),
  );
}

async function writePackManifest() {
  await writeJson(path.join(packDir, "pack.json"), {
    id: "darksun",
    name: "Dark Sun Homebrew",
    version: "0.1.0",
    license: "Proprietary",
    source: "Local dark-sun-homebrew bundle",
  });
}

async function main() {
  const spellIdsByName = await loadSrdSpellIndex();
  await ensureCleanDirs();
  await writePackManifest();
  await ingestBackgrounds();
  await ingestSpecies();
  await ingestClasses();
  await ingestSubclasses();
  await ingestSkills();
  await ingestFeats();
  await ingestWildTalents();
  await ingestSpellLists(spellIdsByName);
  await ingestSettings();
}

await main();
