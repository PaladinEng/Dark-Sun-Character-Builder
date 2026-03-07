import { access } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadPackFromDir } from "../src/load";

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

describe("srd52 content audit", () => {
  it("meets expanded builder-facing SRD coverage floors", async () => {
    const srdPackDir = await resolveSrdPackDir();
    const pack = await loadPackFromDir(srdPackDir);

    expect(pack.entities.classes.length).toBeGreaterThanOrEqual(11);
    expect(pack.entities.backgrounds.length).toBeGreaterThanOrEqual(11);
    expect(pack.entities.features.length).toBeGreaterThanOrEqual(13);
    expect(pack.entities.feats.length).toBeGreaterThanOrEqual(15);
    expect(pack.entities.equipment.length).toBeGreaterThanOrEqual(60);
    expect(pack.entities.spells.length).toBeGreaterThanOrEqual(60);
    expect(pack.entities.spellLists.length).toBeGreaterThanOrEqual(7);

    const spellcastingClasses = pack.entities.classes.filter((klass) => klass.spellcasting);
    expect(spellcastingClasses.length).toBeGreaterThanOrEqual(7);

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
  });
});
