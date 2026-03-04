import type { Background, Class, Feat, MergedContent, PackManifest } from "@dark-sun/content";
import { describe, expect, it } from "vitest";

import { computeDerivedState, computeProfBonus, getAvailableAdvancementSlots } from "../src";
import type { CharacterState } from "../src/types";

function baseMergedContent(overrides: Partial<MergedContent> = {}): MergedContent {
  const base: MergedContent = {
    manifests: [],
    species: [],
    backgrounds: [],
    classes: [],
    features: [],
    feats: [],
    equipment: [],
    speciesById: {},
    backgroundsById: {},
    classesById: {},
    featuresById: {},
    featsById: {},
    equipmentById: {}
  };

  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined) {
      (base as any)[k] = v;
    }
  }
  return base;
}

function baseState(overrides: Partial<CharacterState> = {}): CharacterState {
  return {
    level: 1,
    baseAbilities: {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10
    },
    chosenSkillProficiencies: [],
    chosenSaveProficiencies: [],
    ...overrides
  };
}

function fixtureContent(): MergedContent {
  const manifest: PackManifest = {
    id: "test",
    name: "Test",
    version: "0.0.1",
    license: "MIT",
    source: "test"
  };
  const fighter: Class = {
    id: "test:class:fighter",
    name: "Fighter",
    hitDie: 10
  };
  const background: Background = {
    id: "test:background:acolyte",
    name: "Acolyte",
    grantsFeat: "test:feat:origin-alert"
  };
  const originFeat: Feat = {
    id: "test:feat:origin-alert",
    name: "Alert",
    category: "origin",
    effects: []
  };
  const sprinter: Feat = {
    id: "test:feat:sprinter",
    name: "Sprinter",
    category: "general",
    effects: [{ type: "set_speed", value: 35 }]
  };

  return baseMergedContent({
    manifests: [manifest],
    classes: [fighter],
    backgrounds: [background],
    feats: [originFeat, sprinter],
    classesById: { [fighter.id]: fighter },
    backgroundsById: { [background.id]: background },
    featsById: { [originFeat.id]: originFeat, [sprinter.id]: sprinter }
  });
}

describe("rules", () => {
  it("computes proficiency bonus boundaries", () => {
    expect(computeProfBonus(1)).toBe(2);
    expect(computeProfBonus(5)).toBe(3);
    expect(computeProfBonus(9)).toBe(4);
    expect(computeProfBonus(13)).toBe(5);
    expect(computeProfBonus(17)).toBe(6);
  });

  it("level 3 has no advancement slots", () => {
    const derived = computeDerivedState(
      baseState({ level: 3, selectedClassId: "test:class:fighter" }),
      fixtureContent()
    );
    expect(getAvailableAdvancementSlots(3)).toEqual([]);
    expect(derived.advancementSlots).toEqual([]);
  });

  it("level 4 has one unfilled advancement slot", () => {
    const derived = computeDerivedState(
      baseState({ level: 4, selectedClassId: "test:class:fighter" }),
      fixtureContent()
    );
    expect(derived.advancementSlots).toEqual([{ level: 4, filled: false }]);
  });

  it("feat advancements fill slot and apply feat effects", () => {
    const derived = computeDerivedState(
      baseState({
        level: 4,
        selectedClassId: "test:class:fighter",
        advancements: [
          {
            type: "feat",
            featId: "test:feat:sprinter",
            source: "level",
            level: 4
          }
        ]
      }),
      fixtureContent()
    );

    expect(derived.speed).toBe(35);
    expect(derived.feats).toContainEqual({
      id: "test:feat:sprinter",
      name: "Sprinter"
    });
    expect(derived.advancementSlots[0]).toMatchObject({
      level: 4,
      filled: true,
      choice: "feat"
    });
  });

  it("ASI advancement updates abilities and caps at 20", () => {
    const derived = computeDerivedState(
      baseState({
        level: 4,
        selectedClassId: "test:class:fighter",
        baseAbilities: {
          str: 18,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        },
        advancements: [
          {
            type: "asi",
            changes: { str: 2 },
            source: "level",
            level: 4
          }
        ]
      }),
      fixtureContent()
    );

    expect(derived.finalAbilities.str).toBe(20);
    expect(derived.abilityMods.str).toBe(5);
    expect(derived.advancementSlots[0]).toMatchObject({
      level: 4,
      filled: true,
      choice: "asi",
      asi: { str: 2 }
    });
  });
});
