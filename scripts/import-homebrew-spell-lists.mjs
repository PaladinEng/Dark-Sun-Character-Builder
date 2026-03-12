import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const homebrewDir = path.join(rootDir, "homebrew-spell-lists");
const packDir = path.join(rootDir, "apps", "web", "content", "packs", "darksun");
const srdPackDir = path.join(rootDir, "apps", "web", "content", "packs", "srd52");
const darksunSpellsDir = path.join(packDir, "spells");
const darksunSpellListsDir = path.join(packDir, "spelllists");
const profilePath = path.join(packDir, "settings", "profile.json");
const comparisonReportPath = path.join(
  homebrewDir,
  "elemental-cleric-vs-elemental-tradition-report.md",
);

const traditionConfigs = [
  {
    id: "arcane",
    name: "Arcane",
    statusColumn: "Arcane Status",
    csvFile: "arcane_spell_list_v2_balanced.csv",
    spellListId: "darksun:spelllist:tradition:arcane",
    spellListName: "Dark Sun Arcane Tradition",
    classIds: ["srd52:class:wizard", "srd52:class:warlock"],
    active: true,
  },
  {
    id: "divine",
    name: "Divine",
    statusColumn: "Divine Status",
    csvFile: "divine_spell_list_v2_balanced.csv",
    spellListId: "darksun:spelllist:tradition:divine",
    spellListName: "Dark Sun Divine Tradition",
    classIds: [],
    active: false,
  },
  {
    id: "nature",
    name: "Nature",
    statusColumn: "Nature Status",
    csvFile: "nature_spell_list_v2_balanced.csv",
    spellListId: "darksun:spelllist:tradition:nature",
    spellListName: "Dark Sun Nature Tradition",
    classIds: ["srd52:class:druid", "srd52:class:ranger"],
    active: true,
  },
  {
    id: "elemental",
    name: "Elemental",
    statusColumn: "Elemental Status",
    csvFile: "elemental_spell_list_v2_balanced.csv",
    spellListId: "darksun:spelllist:tradition:elemental",
    spellListName: "Dark Sun Elemental Tradition",
    classIds: ["darksun:class:elemental-cleric"],
    active: false,
  },
  {
    id: "psionics",
    name: "Psionics",
    statusColumn: "Psionics Status",
    csvFile: "psionics_spell_list_v2_balanced.csv",
    spellListId: "darksun:spelllist:tradition:psionics",
    spellListName: "Dark Sun Psionics Tradition",
    classIds: [],
    active: false,
  },
];

const masterCsvFile = "dndbeyond_spells_with_sources_v23_final_balanced.csv";
const levelByLabel = new Map([
  ["Cantrip", 0],
  ["1st", 1],
  ["2nd", 2],
  ["3rd", 3],
  ["4th", 4],
  ["5th", 5],
  ["6th", 6],
  ["7th", 7],
  ["8th", 8],
  ["9th", 9],
]);
const schoolByLabel = new Map([
  ["Abjuration", "abjuration"],
  ["Conjuration", "conjuration"],
  ["Divination", "divination"],
  ["Enchantment", "enchantment"],
  ["Evocation", "evocation"],
  ["Illusion", "illusion"],
  ["Necromancy", "necromancy"],
  ["Transmutation", "transmutation"],
]);
const nativeComponentSet = new Set(["V", "S", "M"]);
const elementalClericSpellListIds = [
  "darksun:spelllist:elemental-cleric:shared",
  "darksun:spelllist:elemental-cleric:air",
  "darksun:spelllist:elemental-cleric:earth",
  "darksun:spelllist:elemental-cleric:fire",
  "darksun:spelllist:elemental-cleric:magma",
  "darksun:spelllist:elemental-cleric:rain",
  "darksun:spelllist:elemental-cleric:silt",
  "darksun:spelllist:elemental-cleric:sun",
  "darksun:spelllist:elemental-cleric:water",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let index = 0;
  let inQuotes = false;

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === "\"") {
        if (text[index + 1] === "\"") {
          cell += "\"";
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
      continue;
    }

    if (char === "\r") {
      index += 1;
      continue;
    }

    cell += char;
    index += 1;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift() ?? [];
  return rows
    .filter((entries) => entries.some((entry) => entry !== ""))
    .map((entries) =>
      Object.fromEntries(headers.map((header, cellIndex) => [header, entries[cellIndex] ?? ""])),
    );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function normalizeNameKey(value) {
  return slugify(value).replace(/-/g, " ");
}

function normalizeLevel(value) {
  const level = levelByLabel.get(value.trim());
  if (typeof level !== "number") {
    throw new Error(`Unsupported spell level label: ${value}`);
  }
  return level;
}

function normalizeSchool(value) {
  const school = schoolByLabel.get(value.trim());
  if (!school) {
    throw new Error(`Unsupported spell school label: ${value}`);
  }
  return school;
}

function normalizeRange(value) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Self";
}

function normalizeDuration(value) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "Special";
}

function normalizeBooleanFlag(value) {
  const trimmed = value.trim().toLowerCase();
  return trimmed === "yes" || trimmed === "true" || trimmed === "1" || trimmed === "x";
}

function normalizeComponents(value) {
  const components = value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => nativeComponentSet.has(entry));
  return components.length > 0 ? components : ["V"];
}

function summarizeDescription(value) {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (paragraphs.length === 0) {
    return undefined;
  }
  return paragraphs[0];
}

function deriveSlugFromUrl(url) {
  if (!url) {
    return undefined;
  }
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    if (!segment) {
      return undefined;
    }
    return slugify(segment.replace(/^\d+-/, ""));
  } catch {
    return undefined;
  }
}

async function readCsvFile(fileName) {
  const fullPath = path.join(homebrewDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  return parseCsv(raw);
}

async function loadSpellNameIndex() {
  const spellMaps = new Map();
  const dir = path.join(srdPackDir, "spells");
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  for (const file of files) {
    const spell = await readJson(path.join(dir, file));
    const key = normalizeNameKey(spell.name);
    if (!spellMaps.has(key)) {
      spellMaps.set(key, spell);
    }
  }
  return spellMaps;
}

function toStatuses(row) {
  return {
    arcane: row["Arcane Status"],
    divine: row["Divine Status"],
    nature: row["Nature Status"],
    elemental: row["Elemental Status"],
    psionics: row["Psionics Status"],
  };
}

function toSourceRow(row, extra = {}) {
  return {
    ...row,
    ...extra,
  };
}

function buildGeneratedSpell(row, spellId, sourceCsv) {
  return {
    id: spellId,
    name: row.Name,
    description: row.Description,
    level: normalizeLevel(row.Level),
    school: normalizeSchool(row.School),
    ritual: normalizeBooleanFlag(row.Ritual),
    castingTime: row["Casting Time"].trim() || "1 Action",
    range: normalizeRange(row.Range),
    components: normalizeComponents(row.Components),
    duration: normalizeDuration(row.Duration),
    concentration: normalizeBooleanFlag(row.Concentration),
    summary: summarizeDescription(row.Description),
    notes: `Imported from ${sourceCsv}. Full homebrew spell metadata is preserved in metadata.`,
    reference: row.Source.trim() || undefined,
    metadata: {
      importSource: "homebrew-spell-lists",
      sourceCsv,
      urlAbsolute: row.URL_absolute,
      area: row.Area,
      materials: row.Materials,
      attackSave: row["Attack/Save"],
      damageEffect: row["Damage/Effect"],
      primaryEffectCategory: row["Primary Effect Category"],
      statuses: toStatuses(row),
      csvRow: row,
    },
  };
}

function sortRowsByLevelThenName(rows) {
  return [...rows].sort((left, right) => {
    const levelDelta = normalizeLevel(left.Level) - normalizeLevel(right.Level);
    if (levelDelta !== 0) {
      return levelDelta;
    }
    return left.Name.localeCompare(right.Name);
  });
}

function normalizeComparisonValue(value) {
  return typeof value === "string" ? value.trim() : value;
}

function compareSpellMetadata(existingSpell, csvRow) {
  const differences = [];
  const checks = [
    ["level", existingSpell.level, normalizeLevel(csvRow.Level)],
    ["school", existingSpell.school, normalizeSchool(csvRow.School)],
    ["ritual", existingSpell.ritual, normalizeBooleanFlag(csvRow.Ritual)],
    ["concentration", existingSpell.concentration, normalizeBooleanFlag(csvRow.Concentration)],
    ["castingTime", normalizeComparisonValue(existingSpell.castingTime), normalizeComparisonValue(csvRow["Casting Time"])],
    ["range", normalizeComparisonValue(existingSpell.range), normalizeComparisonValue(normalizeRange(csvRow.Range))],
    ["duration", normalizeComparisonValue(existingSpell.duration), normalizeComparisonValue(normalizeDuration(csvRow.Duration))],
  ];
  for (const [field, existingValue, csvValue] of checks) {
    if (JSON.stringify(existingValue) !== JSON.stringify(csvValue)) {
      differences.push(`${field}: builder=${JSON.stringify(existingValue)} csv=${JSON.stringify(csvValue)}`);
    }
  }
  return differences;
}

async function buildElementalComparisonReport(elementalRows, spellById) {
  const spellListFiles = (await readdir(darksunSpellListsDir))
    .filter((file) => file.endsWith(".json"))
    .sort();
  const spellListById = new Map();
  for (const file of spellListFiles) {
    const spellList = await readJson(path.join(darksunSpellListsDir, file));
    spellListById.set(spellList.id, spellList);
  }

  const existingSpellLists = [];
  for (const spellListId of elementalClericSpellListIds) {
    const spellList = spellListById.get(spellListId);
    if (!spellList) {
      throw new Error(`Missing existing Elemental Cleric spell list: ${spellListId}`);
    }
    existingSpellLists.push(spellList);
  }

  const existingEntries = [];
  for (const spellList of existingSpellLists) {
    for (const spellId of spellList.spellIds) {
      const spell = spellById.get(spellId);
      existingEntries.push({
        spellId,
        name: spell?.name ?? spellId,
        spellListId: spellList.id,
        spell,
      });
    }
  }

  const existingByName = new Map();
  for (const entry of existingEntries) {
    const key = normalizeNameKey(entry.name);
    if (!existingByName.has(key)) {
      existingByName.set(key, []);
    }
    existingByName.get(key).push(entry);
  }

  const elementalByName = new Map(
    elementalRows.map((row) => [normalizeNameKey(row.Name), row]),
  );

  const onlyExisting = [...existingByName.entries()]
    .filter(([key]) => !elementalByName.has(key))
    .map(([, entries]) => entries[0])
    .sort((left, right) => left.name.localeCompare(right.name));

  const onlyElemental = elementalRows
    .filter((row) => !existingByName.has(normalizeNameKey(row.Name)))
    .sort((left, right) => left.Name.localeCompare(right.Name));

  const sharedWithDifferences = [];
  for (const row of elementalRows) {
    const matches = existingByName.get(normalizeNameKey(row.Name));
    if (!matches || matches.length === 0) {
      continue;
    }
    const existingSpell = matches[0]?.spell;
    if (!existingSpell) {
      continue;
    }
    const differences = compareSpellMetadata(existingSpell, row);
    if (differences.length > 0) {
      sharedWithDifferences.push({
        name: row.Name,
        spellId: matches[0].spellId,
        differences,
      });
    }
  }

  const reportLines = [
    "# Elemental Cleric vs Elemental Tradition",
    "",
    "This report compares the existing builder-authoritative Elemental Cleric spell lists against the elemental tradition CSV import candidate.",
    "",
    "## Assumptions",
    "",
    "- Name matching uses lowercase slug normalization from spell names.",
    "- Existing Elemental Cleric spell lists remain authoritative for builder behavior in this pass.",
    "- Metadata-difference checks compare level, school, ritual, concentration, casting time, range, and duration where builder-native spell data exists.",
    "",
    `## Existing Elemental Cleric Spell Count`,
    "",
    `- Unique spell names in builder-authoritative Elemental Cleric lists: ${existingByName.size}`,
    `- Unique spell names in elemental tradition CSV: ${elementalByName.size}`,
    "",
    "## Present In Existing Elemental Cleric Lists Only",
    "",
    ...(onlyExisting.length > 0
      ? onlyExisting.map(
          (entry) => `- ${entry.name} (${entry.spellId}; from ${entry.spellListId})`,
        )
      : ["- None."]),
    "",
    "## Present In Elemental Tradition CSV Only",
    "",
    ...(onlyElemental.length > 0
      ? onlyElemental.map((row) => `- ${row.Name} (${row.Level}; ${row["Elemental Status"]})`)
      : ["- None."]),
    "",
    "## Shared Spells With Notable Metadata Differences",
    "",
    ...(sharedWithDifferences.length > 0
      ? sharedWithDifferences.flatMap((entry) => [
          `- ${entry.name} (${entry.spellId})`,
          ...entry.differences.map((difference) => `  - ${difference}`),
        ])
      : ["- None detected in the compared native fields."]),
    "",
  ];

  await writeFile(comparisonReportPath, `${reportLines.join("\n")}\n`, "utf8");
}

async function main() {
  const masterRows = sortRowsByLevelThenName(await readCsvFile(masterCsvFile));
  const existingSpellsByName = await loadSpellNameIndex();
  const spellById = new Map();
  for (const spell of existingSpellsByName.values()) {
    spellById.set(spell.id, spell);
  }

  const generatedSpellsById = new Map();
  const nativeSpellIdByName = new Map();
  const usedGeneratedSpellIds = new Set();

  for (const row of masterRows) {
    const key = normalizeNameKey(row.Name);
    const existingSpell = existingSpellsByName.get(key);
    if (existingSpell) {
      nativeSpellIdByName.set(key, existingSpell.id);
      continue;
    }

    if (nativeSpellIdByName.has(key)) {
      continue;
    }

    const slugBase = deriveSlugFromUrl(row.URL_absolute) || slugify(row.Name) || "spell";
    let slug = slugBase;
    let suffix = 2;
    while (usedGeneratedSpellIds.has(`darksun:spell:${slug}`)) {
      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }
    const spellId = `darksun:spell:${slug}`;
    usedGeneratedSpellIds.add(spellId);
    nativeSpellIdByName.set(key, spellId);
    generatedSpellsById.set(spellId, buildGeneratedSpell(row, spellId, masterCsvFile));
  }

  const classSpellListOverrides = {};
  const traditionOutputs = [];

  for (const config of traditionConfigs) {
    const expectedRowsFromMaster = sortRowsByLevelThenName(
      masterRows.filter((row) => {
        const status = row[config.statusColumn]?.trim();
        return status && status !== "Hard Ban";
      }),
    );

    let sourceRows;
    let sourceCsvPresent = true;
    try {
      sourceRows = sortRowsByLevelThenName(await readCsvFile(config.csvFile));
    } catch {
      sourceRows = expectedRowsFromMaster;
      sourceCsvPresent = false;
    }

    const sourceNames = new Set(sourceRows.map((row) => normalizeNameKey(row.Name)));
    const expectedNames = new Set(expectedRowsFromMaster.map((row) => normalizeNameKey(row.Name)));
    const missingFromCsv = expectedRowsFromMaster
      .filter((row) => !sourceNames.has(normalizeNameKey(row.Name)))
      .map((row) => row.Name);
    const extraInCsv = sourceRows
      .filter((row) => !expectedNames.has(normalizeNameKey(row.Name)))
      .map((row) => row.Name);

    const spellIds = sourceRows.map((row) => {
      const spellId = nativeSpellIdByName.get(normalizeNameKey(row.Name));
      if (!spellId) {
        throw new Error(`Missing native spell id for ${row.Name} in ${config.id} tradition.`);
      }
      return spellId;
    });

    const spellList = {
      id: config.spellListId,
      name: config.spellListName,
      description: `${config.name} tradition spell list imported from Dark Sun homebrew CSV data.`,
      spellIds,
      metadata: {
        traditionId: config.id,
        sourceCsv: sourceCsvPresent ? config.csvFile : null,
        synthesizedFromMaster: sourceCsvPresent === false,
        statusColumn: config.statusColumn,
        rowCount: sourceRows.length,
        activeClassIds: config.classIds,
      },
    };

    await writeJson(
      path.join(darksunSpellListsDir, `tradition-${config.id}.json`),
      spellList,
    );

    if (config.active) {
      for (const classId of config.classIds) {
        classSpellListOverrides[classId] = [config.spellListId];
      }
    }

    const sourceJson = {
      fileType: "darksun-homebrew-tradition-spell-source",
      traditionId: config.id,
      sourceCsv: sourceCsvPresent ? config.csvFile : null,
      synthesizedFromMasterStatusColumn: sourceCsvPresent ? null : config.statusColumn,
      columns: Object.keys(sourceRows[0] ?? {}),
      rowCount: sourceRows.length,
      validation: {
        expectedFromMasterCount: expectedRowsFromMaster.length,
        matchesMasterFilter:
          missingFromCsv.length === 0 && extraInCsv.length === 0,
        missingFromCsv,
        extraInCsv,
      },
      nativeSpellList: {
        id: spellList.id,
        name: spellList.name,
        spellIds,
      },
      rows: sourceRows.map((row) =>
        toSourceRow(row, {
          nativeSpellId: nativeSpellIdByName.get(normalizeNameKey(row.Name)),
        }),
      ),
    };

    await writeJson(
      path.join(homebrewDir, `${config.csvFile.replace(/\.csv$/u, ".json")}`),
      sourceJson,
    );

    traditionOutputs.push({
      id: config.id,
      sourceCsvPresent,
      sourceJsonFile: `${config.csvFile.replace(/\.csv$/u, ".json")}`,
      nativeSpellListId: spellList.id,
      rowCount: sourceRows.length,
    });
  }

  await mkdir(darksunSpellsDir, { recursive: true });
  for (const [spellId, spell] of generatedSpellsById.entries()) {
    await writeJson(
      path.join(darksunSpellsDir, `${spellId.split(":").pop()}.json`),
      spell,
    );
    spellById.set(spellId, spell);
  }

  const masterJson = {
    fileType: "darksun-homebrew-master-spell-source",
    sourceCsv: masterCsvFile,
    columns: Object.keys(masterRows[0] ?? {}),
    rowCount: masterRows.length,
    reusedExistingSpellCount: masterRows.length - generatedSpellsById.size,
    generatedSpellCount: generatedSpellsById.size,
    rows: masterRows.map((row) => {
      const key = normalizeNameKey(row.Name);
      const nativeSpellId = nativeSpellIdByName.get(key);
      const existingSpell = existingSpellsByName.get(key);
      return toSourceRow(row, {
        nativeSpellId,
        nativeSpellSource: existingSpell ? "existing" : "generated",
      });
    }),
  };
  await writeJson(
    path.join(homebrewDir, masterCsvFile.replace(/\.csv$/u, ".json")),
    masterJson,
  );

  const profile = await readJson(profilePath);
  profile.classSpellListOverrides = classSpellListOverrides;
  await writeJson(profilePath, profile);

  await buildElementalComparisonReport(
    sortRowsByLevelThenName(await readCsvFile("elemental_spell_list_v2_balanced.csv")),
    spellById,
  );

  await writeJson(path.join(homebrewDir, "spell-conversion-summary.json"), {
    generatedSpellCount: generatedSpellsById.size,
    reusedExistingSpellCount: masterRows.length - generatedSpellsById.size,
    classSpellListOverrides,
    traditionOutputs,
  });

  console.log(
    JSON.stringify(
      {
        generatedSpellCount: generatedSpellsById.size,
        reusedExistingSpellCount: masterRows.length - generatedSpellsById.size,
        classSpellListOverrides,
        traditionOutputs,
        comparisonReportPath: path.relative(rootDir, comparisonReportPath),
      },
      null,
      2,
    ),
  );
}

await main();
