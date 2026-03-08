import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadPackFromDir } from "../src/load";
import { LANGUAGE_VALUES, TOOL_PROFICIENCY_VALUES } from "../src/proficiencies";
import { normalizeSeedPack } from "../src/normalize";
import { SeedPackSchema } from "../src/seed";

async function resolveSrdPackDir(): Promise<string> {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "apps", "web", "content", "packs", "srd52"),
    path.resolve(cwd, "..", "..", "apps", "web", "content", "packs", "srd52"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  throw new Error("Unable to locate srd52 pack directory.");
}

async function resolveSrdSeedFile(): Promise<string> {
  const srdPackDir = await resolveSrdPackDir();
  const seedFile = path.join(srdPackDir, "_seed", "seed.json");
  await access(seedFile);
  return seedFile;
}

function toIdSet(values: Array<{ id: string }>): Set<string> {
  return new Set(values.map((value) => value.id));
}

describe("srd52 content audit", () => {
  it("meets expanded builder-facing SRD coverage floors", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    expect(pack.entities.species.length).toBeGreaterThanOrEqual(9);
    expect(pack.entities.classes.length).toBeGreaterThanOrEqual(12);
    expect(pack.entities.backgrounds.length).toBeGreaterThanOrEqual(11);
    expect(pack.entities.skillDefinitions.length).toBeGreaterThanOrEqual(18);
    expect(pack.entities.subclasses?.length ?? 0).toBeGreaterThanOrEqual(40);
    expect(pack.entities.features.length).toBeGreaterThanOrEqual(90);
    expect(pack.entities.feats.length).toBeGreaterThanOrEqual(15);
    expect(pack.entities.equipment.length).toBeGreaterThanOrEqual(60);
    expect(pack.entities.spells.length).toBeGreaterThanOrEqual(85);
    expect(pack.entities.spellLists.length).toBeGreaterThanOrEqual(11);

    const spellcastingClasses = pack.entities.classes.filter((klass) => klass.spellcasting);
    expect(spellcastingClasses.length).toBeGreaterThanOrEqual(8);

    const spellListIds = new Set(pack.entities.spellLists.map((list) => list.id));
    for (const klass of spellcastingClasses) {
      const refs = klass.spellListRefIds ?? klass.spellListRefs ?? [];
      expect(refs.length, `${klass.id} should define spell list references`).toBeGreaterThan(0);
      for (const spellListId of refs) {
        expect(
          spellListIds.has(spellListId),
          `${klass.id} references missing spell list ${spellListId}`,
        ).toBe(true);
      }
    }
  });

  it("contains every entity from the SRD seed inventory baseline", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const seedFile = await resolveSrdSeedFile();
    const pack = await loadPackFromDir(srdPackDir);

    const seedRaw = await readFile(seedFile, "utf8");
    const seed = SeedPackSchema.parse(JSON.parse(seedRaw));
    const baseline = normalizeSeedPack(seed, "srd52");

    const categories: Array<{
      label: string;
      baselineValues: Array<{ id: string }>;
      packValues: Array<{ id: string }>;
    }> = [
      { label: "species", baselineValues: baseline.species, packValues: pack.entities.species },
      {
        label: "skills",
        baselineValues: baseline.skillDefinitions,
        packValues: pack.entities.skillDefinitions,
      },
      {
        label: "backgrounds",
        baselineValues: baseline.backgrounds,
        packValues: pack.entities.backgrounds,
      },
      { label: "classes", baselineValues: baseline.classes, packValues: pack.entities.classes },
      { label: "features", baselineValues: baseline.features, packValues: pack.entities.features },
      { label: "feats", baselineValues: baseline.feats, packValues: pack.entities.feats },
      {
        label: "equipment",
        baselineValues: baseline.equipment,
        packValues: pack.entities.equipment,
      },
      { label: "spells", baselineValues: baseline.spells, packValues: pack.entities.spells },
      {
        label: "spell lists",
        baselineValues: baseline.spellLists,
        packValues: pack.entities.spellLists,
      },
    ];

    for (const category of categories) {
      const packIds = toIdSet(category.packValues);
      expect(
        category.packValues.length,
        `srd52 ${category.label} count should be at least the seed baseline`,
      ).toBeGreaterThanOrEqual(category.baselineValues.length);

      for (const entity of category.baselineValues) {
        expect(
          packIds.has(entity.id),
          `Missing ${category.label} from srd52 pack: ${entity.id}`,
        ).toBe(true);
      }
    }
  });

  it("includes core SRD species coverage with derived-speed support", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    const speciesById = new Map(pack.entities.species.map((species) => [species.id, species]));
    const expectedSpeciesIds = [
      "srd52:species:dragonborn",
      "srd52:species:dwarf",
      "srd52:species:elf",
      "srd52:species:gnome",
      "srd52:species:goliath",
      "srd52:species:halfling",
      "srd52:species:human",
      "srd52:species:orc",
      "srd52:species:tiefling",
    ];

    for (const speciesId of expectedSpeciesIds) {
      expect(speciesById.has(speciesId), `Missing expected SRD species ${speciesId}`).toBe(true);
      const species = speciesById.get(speciesId);
      const speedEffect = species?.effects?.find((effect) => effect.type === "set_speed");
      expect(speedEffect, `${speciesId} should define a speed effect`).toBeDefined();
      if (speedEffect?.type === "set_speed") {
        expect(speedEffect.value, `${speciesId} speed should be at least 30`).toBeGreaterThanOrEqual(30);
      }
    }

    const dwarf = speciesById.get("srd52:species:dwarf");
    const dwarfDarkvision = dwarf?.effects?.find(
      (effect) => effect.type === "grant_sense" && effect.sense === "darkvision",
    );
    expect(dwarfDarkvision, "Dwarf should define Darkvision").toBeDefined();
    if (dwarfDarkvision?.type === "grant_sense") {
      expect(dwarfDarkvision.range, "Dwarf darkvision range should be at least 120").toBeGreaterThanOrEqual(
        120,
      );
    }
  });

  it("ensures enriched metadata is present for builder/sheet/export use", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);
    const knownLanguages = new Set<string>(LANGUAGE_VALUES);

    for (const klass of pack.entities.classes) {
      expect(klass.description, `${klass.id} should provide description`).toBeTruthy();
    }

    for (const background of pack.entities.backgrounds) {
      expect(background.description, `${background.id} should provide description`).toBeTruthy();
      expect(
        background.startingEquipment,
        `${background.id} should provide starting equipment metadata`,
      ).toBeDefined();

      for (const effect of background.effects ?? []) {
        if (effect.type === "grant_language") {
          expect(
            knownLanguages.has(effect.language),
            `${background.id} references unknown language: ${effect.language}`,
          ).toBe(true);
        }
      }
    }

    for (const species of pack.entities.species) {
      expect(species.description, `${species.id} should provide description`).toBeTruthy();
      for (const effect of species.effects ?? []) {
        if (effect.type === "grant_language") {
          expect(
            knownLanguages.has(effect.language),
            `${species.id} references unknown language: ${effect.language}`,
          ).toBe(true);
        }
      }
    }

    for (const feat of pack.entities.feats) {
      expect(feat.description, `${feat.id} should provide description`).toBeTruthy();
      expect(feat.category, `${feat.id} should define category metadata`).toBeDefined();
    }

    for (const feature of pack.entities.features) {
      expect(feature.description, `${feature.id} should provide description`).toBeTruthy();
    }

    for (const item of pack.entities.equipment) {
      expect(item.description, `${item.id} should provide description`).toBeTruthy();
    }

    for (const spell of pack.entities.spells) {
      expect(spell.summary, `${spell.id} should provide summary`).toBeTruthy();
      expect(
        spell.notes,
        `${spell.id} should provide notes metadata (explicitly set when none apply)`,
      ).toBeTruthy();
    }
  });

  it("classes grant two save proficiencies and wire core features", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    const coreFeatureIds = new Set([
      "srd52:feature:second-wind",
      "srd52:feature:sneak-attack",
      "srd52:feature:spellcasting",
    ]);

    const referencedFeatureIds = new Set<string>();

    for (const klass of pack.entities.classes) {
      for (const entry of klass.classFeaturesByLevel ?? []) {
        referencedFeatureIds.add(entry.featureId);
      }

      const maxFeatureLevel = Math.max(
        ...(klass.classFeaturesByLevel ?? []).map((entry) => entry.level),
        0,
      );
      expect(
        maxFeatureLevel,
        `${klass.id} should define class feature progression through level 20`,
      ).toBeGreaterThanOrEqual(20);

      const saveAbilities = new Set(
        (klass.effects ?? [])
          .filter((effect) => effect.type === "grant_save_proficiency")
          .map((effect) => effect.ability),
      );
      expect(saveAbilities.size, `${klass.id} should grant two save proficiencies`).toBe(2);
    }

    for (const featureId of coreFeatureIds) {
      expect(
        referencedFeatureIds.has(featureId),
        `${featureId} should be referenced by at least one class`,
      ).toBe(true);
    }
  });

  it("subclasses resolve to known classes and features", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);
    const classIds = new Set(pack.entities.classes.map((klass) => klass.id));
    const featureIds = new Set(pack.entities.features.map((feature) => feature.id));

    for (const subclass of pack.entities.subclasses ?? []) {
      expect(classIds.has(subclass.classId), `${subclass.id} should reference a known class`).toBe(true);
      for (const entry of subclass.subclassFeaturesByLevel) {
        expect(
          featureIds.has(entry.featureId),
          `${subclass.id} should reference known feature ${entry.featureId}`,
        ).toBe(true);
      }
    }
  });

  it("includes warlock class and core patron subclass coverage", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    const classIds = new Set(pack.entities.classes.map((klass) => klass.id));
    expect(classIds.has("srd52:class:warlock")).toBe(true);

    const subclassIds = new Set((pack.entities.subclasses ?? []).map((subclass) => subclass.id));
    expect(subclassIds.has("srd52:subclass:fiend")).toBe(true);
    expect(subclassIds.has("srd52:subclass:archfey")).toBe(true);
    expect(subclassIds.has("srd52:subclass:great-old-one")).toBe(true);
  });

  it("models warlock invocation and pact boon option entities with arcanum-ready spells", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    const warlock = pack.entities.classes.find((klass) => klass.id === "srd52:class:warlock");
    expect(warlock).toBeDefined();
    expect(warlock?.spellcasting?.progression).toBe("pact");
    expect(warlock?.invocationSelectionLimitsByLevel?.length ?? 0).toBeGreaterThanOrEqual(3);

    const invocationFeatures = pack.entities.features.filter((feature) =>
      (feature.tags ?? []).includes("warlock_invocation"),
    );
    expect(invocationFeatures.length).toBeGreaterThanOrEqual(6);
    for (const feature of invocationFeatures) {
      expect(feature.selectable, `${feature.id} should be selectable`).toBe(true);
      expect(feature.prerequisites?.classIds?.includes("srd52:class:warlock")).toBe(true);
    }

    const pactBoons = pack.entities.features.filter((feature) =>
      (feature.tags ?? []).includes("warlock_pact_boon"),
    );
    expect(pactBoons.length).toBeGreaterThanOrEqual(3);
    for (const feature of pactBoons) {
      expect(feature.selectable, `${feature.id} should be selectable`).toBe(true);
      expect(feature.prerequisites?.classIds?.includes("srd52:class:warlock")).toBe(true);
    }

    const warlockSpellListIds = new Set(
      pack.entities.classes
        .filter((klass) => klass.id === "srd52:class:warlock")
        .flatMap((klass) => klass.spellListRefIds ?? klass.spellListRefs ?? []),
    );
    const warlockSpellIds = new Set<string>();
    for (const listId of warlockSpellListIds) {
      for (const spellId of pack.entities.spellLists.find((list) => list.id === listId)?.spellIds ?? []) {
        warlockSpellIds.add(spellId);
      }
    }

    const spellsById = new Map(pack.entities.spells.map((spell) => [spell.id, spell]));
    const hasTier6 = [...warlockSpellIds].some((spellId) => spellsById.get(spellId)?.level === 6);
    const hasTier7 = [...warlockSpellIds].some((spellId) => spellsById.get(spellId)?.level === 7);
    const hasTier8 = [...warlockSpellIds].some((spellId) => spellsById.get(spellId)?.level === 8);
    const hasTier9 = [...warlockSpellIds].some((spellId) => spellsById.get(spellId)?.level === 9);

    expect(hasTier6).toBe(true);
    expect(hasTier7).toBe(true);
    expect(hasTier8).toBe(true);
    expect(hasTier9).toBe(true);
  });

  it("backgrounds expose builder-facing SRD metadata and proficiency coverage", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    let hasGamingSetGrant = false;

    for (const background of pack.entities.backgrounds) {
      expect(background.abilityOptions, `${background.id} should define abilityOptions`).toBeDefined();

      const hasFixedOrigin = Boolean(background.grantsOriginFeatId ?? background.grantsFeat);
      const hasChoiceOrigin = Boolean(background.originFeatChoice);
      expect(
        hasFixedOrigin || hasChoiceOrigin,
        `${background.id} should define origin feat metadata`,
      ).toBe(true);

      const skillGrantCount = (background.effects ?? []).filter(
        (effect) => effect.type === "grant_skill_proficiency",
      ).length;
      expect(skillGrantCount, `${background.id} should grant at least two skills`).toBeGreaterThanOrEqual(
        2,
      );

      if (
        (background.effects ?? []).some(
          (effect) =>
            effect.type === "grant_tool_proficiency" && effect.tool === "Gaming Set",
        )
      ) {
        hasGamingSetGrant = true;
      }
    }

    expect(hasGamingSetGrant).toBe(true);
  });

  it("ensures SRD spells are reachable and background tool proficiencies map to equipment", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    const spellcastingClasses = pack.entities.classes.filter((klass) => klass.spellcasting);
    const spellListById = new Map(pack.entities.spellLists.map((spellList) => [spellList.id, spellList]));
    const reachableSpellIds = new Set<string>();

    for (const klass of spellcastingClasses) {
      const refs = klass.spellListRefIds ?? klass.spellListRefs ?? [];
      for (const spellListId of refs) {
        const spellList = spellListById.get(spellListId);
        if (!spellList) {
          continue;
        }
        for (const spellId of spellList.spellIds) {
          reachableSpellIds.add(spellId);
        }
      }
    }

    for (const spell of pack.entities.spells) {
      expect(
        reachableSpellIds.has(spell.id),
        `${spell.id} should be reachable from at least one spellcasting class list`,
      ).toBe(true);
    }

    const equipmentNames = new Set(pack.entities.equipment.map((item) => item.name));
    const toolProficiencies = new Set<string>();

    for (const background of pack.entities.backgrounds) {
      for (const effect of background.effects ?? []) {
        if (effect.type === "grant_tool_proficiency") {
          toolProficiencies.add(effect.tool);
        }
      }
    }

    for (const tool of toolProficiencies) {
      expect(
        equipmentNames.has(tool),
        `Background tool proficiency "${tool}" should have a matching SRD equipment entry`,
      ).toBe(true);
    }

    for (const tool of TOOL_PROFICIENCY_VALUES) {
      expect(
        equipmentNames.has(tool),
        `Known tool proficiency "${tool}" should have a matching SRD equipment entry`,
      ).toBe(true);
    }
  });
});
