import type { Background, Class, Equipment, Feat, MergedContent, PackManifest, Spell } from "@dark-sun/content";
import { describe, expect, it } from "vitest";

import {
  buildPdfExportFromTemplate,
  computeDerivedState,
  computeProfBonus,
  deriveStartingEquipment,
  getAvailableAdvancementSlots,
  getSkillAndToolDisplayModel,
  getSkillAndToolDisplayRows,
  validateCharacter
} from "../src";
import type { CharacterState } from "../src/types";

function baseMergedContent(overrides: Partial<MergedContent> = {}): MergedContent {
  const base: MergedContent = {
    manifests: [],
    species: [],
    skillDefinitions: [],
    backgrounds: [],
    classes: [],
    features: [],
    feats: [],
    equipment: [],
    spells: [],
    spellLists: [],
    speciesById: {},
    skillDefinitionsById: {},
    backgroundsById: {},
    classesById: {},
    featuresById: {},
    featsById: {},
    equipmentById: {},
    spellsById: {},
    spellListsById: {}
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
    chosenClassSkills: [],
    chosenSkillProficiencies: [],
    chosenSaveProficiencies: [],
    featSelections: {
      level: {}
    },
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

  it("featSelections level slots fill slot and apply feat effects deterministically", () => {
    const derived = computeDerivedState(
      baseState({
        level: 4,
        selectedClassId: "test:class:fighter",
        featSelections: {
          level: {
            4: "test:feat:sprinter"
          }
        }
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

  it("non-proficient attacks do not add proficiency bonus", () => {
    const klass: Class = {
      id: "test:class:non-martial",
      name: "Non Martial",
      hitDie: 8,
      weaponProficiencies: { simple: true }
    };
    const rapier = {
      id: "test:weapon:rapier",
      name: "Rapier",
      type: "weapon" as const,
      damageDice: "1d8",
      weaponCategory: "martial" as const,
      properties: ["finesse"]
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: rapier.id,
        baseAbilities: {
          str: 10,
          dex: 16,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [rapier],
        equipmentById: { [rapier.id]: rapier }
      })
    );

    expect(derived.attack?.toHit).toBe(3);
    expect(derived.warnings.some((warning) => warning.includes("not proficient"))).toBe(true);
  });

  it("proficient attacks add proficiency bonus", () => {
    const klass: Class = {
      id: "test:class:martial",
      name: "Martial",
      hitDie: 10,
      weaponProficiencies: { martial: true }
    };
    const rapier = {
      id: "test:weapon:rapier",
      name: "Rapier",
      type: "weapon" as const,
      damageDice: "1d8",
      weaponCategory: "martial" as const,
      properties: ["finesse"]
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: rapier.id,
        baseAbilities: {
          str: 10,
          dex: 16,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [rapier],
        equipmentById: { [rapier.id]: rapier }
      })
    );

    expect(derived.attack?.toHit).toBe(5);
    expect(derived.warnings.some((warning) => warning.includes("not proficient"))).toBe(false);
  });

  it("computes AC from armor plus shield with dex cap", () => {
    const derived = computeDerivedState(
      baseState({
        baseAbilities: {
          str: 10,
          dex: 16,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        },
        equippedArmorId: "test:armor:chain-shirt",
        equippedShieldId: "test:shield:wood"
      }),
      baseMergedContent({
        equipment: [
          {
            id: "test:armor:chain-shirt",
            name: "Chain Shirt",
            type: "armor_medium",
            armorClassBase: 13,
            dexCap: 2
          },
          {
            id: "test:shield:wood",
            name: "Wood Shield",
            type: "shield",
            hasShieldBonus: true
          }
        ],
        equipmentById: {
          "test:armor:chain-shirt": {
            id: "test:armor:chain-shirt",
            name: "Chain Shirt",
            type: "armor_medium",
            armorClassBase: 13,
            dexCap: 2
          },
          "test:shield:wood": {
            id: "test:shield:wood",
            name: "Wood Shield",
            type: "shield",
            hasShieldBonus: true
          }
        }
      })
    );

    expect(derived.armorClass).toBe(17);
  });

  it("computes AC from shield-only fallback base formula", () => {
    const derived = computeDerivedState(
      baseState({
        baseAbilities: {
          str: 10,
          dex: 14,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        },
        equippedShieldId: "test:shield:wood"
      }),
      baseMergedContent({
        equipment: [
          {
            id: "test:shield:wood",
            name: "Wood Shield",
            type: "shield",
            hasShieldBonus: true
          }
        ],
        equipmentById: {
          "test:shield:wood": {
            id: "test:shield:wood",
            name: "Wood Shield",
            type: "shield",
            hasShieldBonus: true
          }
        }
      })
    );

    expect(derived.armorClass).toBe(14);
  });

  it("derives deterministic starting equipment from class and background bundles", () => {
    const fighter: Class = {
      id: "test:class:fighter",
      name: "Fighter",
      startingEquipment: {
        itemIds: ["test:weapon:longsword", "test:armor:chain-shirt"],
        equippedArmorId: "test:armor:chain-shirt",
        equippedWeaponId: "test:weapon:longsword"
      }
    };
    const soldier: Background = {
      id: "test:background:soldier",
      name: "Soldier",
      startingEquipment: {
        itemIds: ["test:shield:wood"],
        equippedShieldId: "test:shield:wood"
      }
    };

    const content = baseMergedContent({
      classes: [fighter],
      classesById: { [fighter.id]: fighter },
      backgrounds: [soldier],
      backgroundsById: { [soldier.id]: soldier },
      equipment: [
        {
          id: "test:weapon:longsword",
          name: "Longsword",
          type: "weapon",
          damageDice: "1d8",
          weaponCategory: "martial"
        },
        {
          id: "test:armor:chain-shirt",
          name: "Chain Shirt",
          type: "armor_medium",
          armorClassBase: 13,
          dexCap: 2
        },
        {
          id: "test:shield:wood",
          name: "Wood Shield",
          type: "shield",
          hasShieldBonus: true
        }
      ],
      equipmentById: {
        "test:weapon:longsword": {
          id: "test:weapon:longsword",
          name: "Longsword",
          type: "weapon",
          damageDice: "1d8",
          weaponCategory: "martial"
        },
        "test:armor:chain-shirt": {
          id: "test:armor:chain-shirt",
          name: "Chain Shirt",
          type: "armor_medium",
          armorClassBase: 13,
          dexCap: 2
        },
        "test:shield:wood": {
          id: "test:shield:wood",
          name: "Wood Shield",
          type: "shield",
          hasShieldBonus: true
        }
      }
    });

    const derivedBundle = deriveStartingEquipment(
      baseState({
        selectedClassId: fighter.id,
        selectedBackgroundId: soldier.id
      }),
      content
    );
    expect(derivedBundle).toEqual({
      itemIds: ["test:weapon:longsword", "test:armor:chain-shirt", "test:shield:wood"],
      equippedArmorId: "test:armor:chain-shirt",
      equippedShieldId: "test:shield:wood",
      equippedWeaponId: "test:weapon:longsword"
    });

    const derived = computeDerivedState(
      baseState({
        selectedClassId: fighter.id,
        selectedBackgroundId: soldier.id
      }),
      content
    );
    expect(derived.startingEquipment).toEqual(derivedBundle);
  });

  it("computes ranged attacks from DEX modifier", () => {
    const klass: Class = {
      id: "test:class:ranger",
      name: "Ranger",
      hitDie: 10,
      weaponProficiencies: { simple: true, martial: true }
    };
    const shortbow = {
      id: "test:weapon:shortbow",
      name: "Shortbow",
      type: "weapon" as const,
      damageDice: "1d6",
      weaponCategory: "simple" as const,
      properties: ["ranged"]
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: shortbow.id,
        baseAbilities: {
          str: 10,
          dex: 16,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [shortbow],
        equipmentById: { [shortbow.id]: shortbow }
      })
    );

    expect(derived.attack?.toHit).toBe(5);
    expect(derived.attack?.damage).toBe("1d6+3");
  });

  it("computes finesse attacks with the better of STR/DEX", () => {
    const klass: Class = {
      id: "test:class:rogue",
      name: "Rogue",
      hitDie: 8,
      weaponProficiencies: { martial: true }
    };
    const rapier = {
      id: "test:weapon:rapier",
      name: "Rapier",
      type: "weapon" as const,
      damageDice: "1d8",
      weaponCategory: "martial" as const,
      properties: ["finesse"]
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: rapier.id,
        baseAbilities: {
          str: 16,
          dex: 12,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [rapier],
        equipmentById: { [rapier.id]: rapier }
      })
    );

    expect(derived.attack?.toHit).toBe(5);
    expect(derived.attack?.damage).toBe("1d8+3");
  });

  it("includes weapon mastery annotation on derived attacks", () => {
    const klass: Class = {
      id: "test:class:martial",
      name: "Martial",
      hitDie: 10,
      weaponProficiencies: { martial: true }
    };
    const longsword: Equipment = {
      id: "test:weapon:longsword",
      name: "Longsword",
      type: "weapon" as const,
      damageDice: "1d8",
      weaponCategory: "martial" as const,
      properties: ["versatile"],
      masteryProperties: ["sap"]
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: longsword.id,
        baseAbilities: {
          str: 16,
          dex: 12,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [longsword],
        equipmentById: { [longsword.id]: longsword }
      })
    );

    expect(derived.attack?.mastery).toEqual(["sap"]);
  });

  it("merges duplicate skill/save proficiencies without double-counting", () => {
    const species = {
      id: "test:species:elf",
      name: "Elf",
      effects: [{ type: "grant_skill_proficiency" as const, skill: "perception" }]
    };
    const background = {
      id: "test:bg:scout",
      name: "Scout",
      effects: [{ type: "grant_skill_proficiency" as const, skill: "perception" }]
    };
    const klass: Class = {
      id: "test:class:fighter",
      name: "Fighter",
      hitDie: 10,
      classSkillChoices: {
        count: 1,
        from: ["perception"]
      },
      effects: [{ type: "grant_save_proficiency", ability: "con" }]
    };

    const derived = computeDerivedState(
      baseState({
        selectedSpeciesId: species.id,
        selectedBackgroundId: background.id,
        selectedClassId: klass.id,
        chosenSkillProficiencies: ["perception"],
        chosenClassSkills: ["perception"],
        chosenSaveProficiencies: ["con"],
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 14,
          int: 10,
          wis: 12,
          cha: 10
        }
      }),
      baseMergedContent({
        species: [species],
        speciesById: { [species.id]: species },
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(derived.skills.perception).toBe(3);
    expect(derived.passivePerception).toBe(13);
    expect(derived.savingThrows.con).toBe(4);
    expect(derived.skillProficiencies.filter((skill) => skill === "perception")).toHaveLength(1);
    expect(derived.saveProficiencies.filter((ability) => ability === "con")).toHaveLength(1);
  });

  it("derives tool proficiencies and languages in deterministic sorted order", () => {
    const species = {
      id: "test:species:polyglot",
      name: "Polyglot",
      effects: [
        { type: "grant_language" as const, language: "Elvish" },
        { type: "grant_language" as const, language: "Common" }
      ]
    };
    const background = {
      id: "test:bg:artisan",
      name: "Artisan",
      effects: [
        { type: "grant_tool_proficiency" as const, tool: "Navigator's Tools" },
        { type: "grant_language" as const, language: "Dwarvish" }
      ]
    };
    const feat: Feat = {
      id: "test:feat:dabbler",
      name: "Dabbler",
      category: "general",
      effects: [{ type: "grant_tool_proficiency", tool: "Herbalism Kit" }]
    };

    const derived = computeDerivedState(
      baseState({
        selectedSpeciesId: species.id,
        selectedBackgroundId: background.id,
        selectedFeats: [feat.id],
        toolProficiencies: ["Calligrapher's Supplies", "Navigator's Tools"],
        languages: ["Common"]
      }),
      baseMergedContent({
        species: [species],
        speciesById: { [species.id]: species },
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [feat],
        featsById: { [feat.id]: feat }
      })
    );

    expect(derived.toolProficiencies).toEqual([
      "Calligrapher's Supplies",
      "Herbalism Kit",
      "Navigator's Tools"
    ]);
    expect(derived.languages).toEqual(["Common", "Dwarvish", "Elvish"]);
  });

  it("derives passive species senses, resistances, and trait list entries", () => {
    const species = {
      id: "test:species:dwarf",
      name: "Dwarf",
      effects: [
        { type: "set_speed" as const, value: 25 },
        { type: "grant_sense" as const, sense: "darkvision", range: 60 },
        { type: "grant_resistance" as const, damageType: "poison" },
        { type: "grant_trait" as const, name: "Stonecunning" }
      ]
    };

    const derived = computeDerivedState(
      baseState({
        selectedSpeciesId: species.id,
        baseSpeed: 30
      }),
      baseMergedContent({
        species: [species],
        speciesById: { [species.id]: species }
      })
    );

    expect(derived.speed).toBe(25);
    expect(derived.senses).toEqual([{ type: "darkvision", range: 60 }]);
    expect(derived.resistances).toEqual(["poison"]);
    expect(derived.traits).toEqual(["Speed 25 ft.", "Stonecunning"]);
  });

  it("applies encumbered condition modifier after base speed derivation", () => {
    const species = {
      id: "test:species:swift",
      name: "Swift",
      effects: [{ type: "set_speed" as const, value: 35 }]
    };

    const derived = computeDerivedState(
      baseState({
        selectedSpeciesId: species.id,
        baseSpeed: 30,
        conditions: {
          encumbered: true
        }
      }),
      baseMergedContent({
        species: [species],
        speciesById: { [species.id]: species }
      })
    );

    expect(derived.speed).toBe(25);
    expect(derived.activeConditionIds).toEqual(["encumbered"]);
    expect(derived.appliedModifiers).toEqual([
      {
        id: "condition:encumbered:speed-minus-10",
        source: "condition",
        sourceId: "encumbered",
        label: "Encumbered",
        effects: [{ type: "add_speed", value: -10 }]
      }
    ]);
  });

  it("applies class passive features by level to AC/attack and traits", () => {
    const fighter: Class = {
      id: "test:class:fighter",
      name: "Fighter",
      classFeaturesByLevel: [
        { level: 1, featureId: "test:feature:defense-style" },
        { level: 2, featureId: "test:feature:archery-style" }
      ],
      weaponProficiencies: {
        simple: true,
        martial: true
      }
    };
    const defenseStyle = {
      id: "test:feature:defense-style",
      name: "Fighting Style: Defense",
      effects: [
        { type: "add_armor_class_bonus" as const, value: 1, condition: "wearing_armor" as const },
        { type: "grant_trait" as const, name: "Fighting Style: Defense" }
      ]
    };
    const archeryStyle = {
      id: "test:feature:archery-style",
      name: "Fighting Style: Archery",
      effects: [
        { type: "add_attack_bonus" as const, value: 2, condition: "ranged_weapon" as const }
      ]
    };
    const leather = {
      id: "test:equipment:leather",
      name: "Leather Armor",
      type: "armor_light" as const,
      armorClassBase: 11
    };
    const shortbow: Equipment = {
      id: "test:equipment:shortbow",
      name: "Shortbow",
      type: "weapon",
      damageDice: "1d6",
      weaponCategory: "simple",
      properties: ["ranged"]
    };

    const derived = computeDerivedState(
      baseState({
        level: 2,
        selectedClassId: fighter.id,
        equippedArmorId: leather.id,
        equippedWeaponId: shortbow.id,
        baseAbilities: {
          str: 10,
          dex: 16,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [fighter],
        classesById: { [fighter.id]: fighter },
        features: [defenseStyle, archeryStyle],
        featuresById: {
          [defenseStyle.id]: defenseStyle,
          [archeryStyle.id]: archeryStyle
        },
        equipment: [leather, shortbow],
        equipmentById: {
          [leather.id]: leather,
          [shortbow.id]: shortbow
        }
      })
    );

    expect(derived.armorClass).toBe(15);
    expect(derived.attack?.toHit).toBe(7);
    expect(derived.traits).toContain("Fighting Style: Defense");
  });

  it("applies unarmored defense class feature when no armor is equipped", () => {
    const barbarian: Class = {
      id: "test:class:barbarian",
      name: "Barbarian",
      classFeaturesByLevel: [{ level: 1, featureId: "test:feature:unarmored-defense" }]
    };
    const unarmoredDefense = {
      id: "test:feature:unarmored-defense",
      name: "Unarmored Defense",
      effects: [{ type: "set_unarmored_defense" as const, ability: "con" as const }]
    };

    const derived = computeDerivedState(
      baseState({
        level: 1,
        selectedClassId: barbarian.id,
        baseAbilities: {
          str: 16,
          dex: 14,
          con: 16,
          int: 8,
          wis: 10,
          cha: 8
        }
      }),
      baseMergedContent({
        classes: [barbarian],
        classesById: { [barbarian.id]: barbarian },
        features: [unarmoredDefense],
        featuresById: { [unarmoredDefense.id]: unarmoredDefense }
      })
    );

    expect(derived.armorClass).toBe(15);
  });

  it("invalid class skill choices trigger warnings", () => {
    const klass: Class = {
      id: "test:class:fighter",
      name: "Fighter",
      hitDie: 10,
      classSkillChoices: {
        count: 2,
        from: ["athletics", "perception", "survival"]
      }
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        chosenClassSkills: ["arcana"],
        touched: {
          classSkills: true
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(derived.warnings.some((warning) => warning.includes("Invalid class skill selections"))).toBe(
      true
    );
    expect(derived.warnings.some((warning) => warning.includes("incomplete"))).toBe(true);
  });

  it("does not warn for incomplete class skill choices before class skill UI is touched", () => {
    const klass: Class = {
      id: "test:class:fighter",
      name: "Fighter",
      hitDie: 10,
      classSkillChoices: {
        count: 2,
        from: ["athletics", "perception", "survival"]
      }
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        chosenClassSkills: []
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(derived.warnings.some((warning) => warning.includes("Class skill selections incomplete"))).toBe(
      false
    );
  });

  it("valid class skill choices apply proficiency bonus to selected skills", () => {
    const klass: Class = {
      id: "test:class:ranger",
      name: "Ranger",
      hitDie: 10,
      classSkillChoices: {
        count: 2,
        from: ["athletics", "perception", "survival"]
      }
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: klass.id,
        chosenClassSkills: ["athletics", "perception"],
        baseAbilities: {
          str: 14,
          dex: 10,
          con: 10,
          int: 10,
          wis: 12,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(derived.skills.athletics).toBe(4);
    expect(derived.skills.perception).toBe(3);
    expect(derived.warnings.some((warning) => warning.includes("class skill"))).toBe(false);
  });

  it("computes custom content-defined skills from governing ability and proficiency", () => {
    const derived = computeDerivedState(
      baseState({
        chosenSkillProficiencies: ["mysticism"],
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 14,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        skillDefinitions: [
          {
            id: "mysticism",
            name: "Mysticism",
            ability: "int"
          }
        ],
        skillDefinitionsById: {
          mysticism: {
            id: "mysticism",
            name: "Mysticism",
            ability: "int"
          }
        }
      })
    );

    expect(derived.skills.mysticism).toBe(4);
  });

  it("includes chosen origin feat in derived feats for choice-based backgrounds", () => {
    const background: Background = {
      id: "test:background:choice-origin",
      name: "Choice Origin",
      originFeatChoice: {}
    };
    const originFeat: Feat = {
      id: "test:feat:origin-alert",
      name: "Alert",
      category: "origin"
    };

    const derived = computeDerivedState(
      baseState({
        selectedBackgroundId: background.id,
        featSelections: {
          origin: originFeat.id
        }
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [originFeat],
        featsById: { [originFeat.id]: originFeat }
      })
    );

    expect(derived.feats).toContainEqual({
      id: originFeat.id,
      name: originFeat.name
    });
  });

  it("uses fixed background origin feat even when a different originFeatId is present", () => {
    const background: Background = {
      id: "test:background:fixed-origin",
      name: "Fixed Origin",
      grantsFeat: "test:feat:origin-alert"
    };
    const fixedOrigin: Feat = {
      id: "test:feat:origin-alert",
      name: "Alert",
      category: "origin"
    };
    const otherOrigin: Feat = {
      id: "test:feat:origin-other",
      name: "Origin Other",
      category: "origin"
    };

    const derived = computeDerivedState(
      baseState({
        selectedBackgroundId: background.id,
        originFeatId: otherOrigin.id
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [fixedOrigin, otherOrigin],
        featsById: {
          [fixedOrigin.id]: fixedOrigin,
          [otherOrigin.id]: otherOrigin
        }
      })
    );

    expect(derived.feats).toContainEqual({
      id: fixedOrigin.id,
      name: fixedOrigin.name
    });
    expect(derived.feats).not.toContainEqual({
      id: otherOrigin.id,
      name: otherOrigin.name
    });
  });

  it("computes cleric spellcasting scaffold at level 1", () => {
    const cleric: Class = {
      id: "test:class:cleric",
      name: "Cleric",
      spellcasting: {
        ability: "wis",
        progression: "full",
        mode: "prepared"
      }
    };

    const derived = computeDerivedState(
      baseState({
        level: 1,
        selectedClassId: cleric.id,
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 16,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [cleric],
        classesById: { [cleric.id]: cleric }
      })
    );

    expect(derived.spellcasting).toMatchObject({
      ability: "wis",
      abilityMod: 3,
      saveDC: 13,
      attackBonus: 5,
      progression: "full",
      slots: [2, 0, 0, 0, 0, 0, 0, 0, 0]
    });
  });

  it("computes wizard level 5 full-caster slot table", () => {
    const wizard: Class = {
      id: "test:class:wizard",
      name: "Wizard",
      spellcasting: {
        ability: "int",
        progression: "full",
        mode: "prepared"
      }
    };

    const derived = computeDerivedState(
      baseState({
        level: 5,
        selectedClassId: wizard.id,
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 16,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [wizard],
        classesById: { [wizard.id]: wizard }
      })
    );

    expect(derived.spellcasting?.slots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
  });

  it("computes ranger level 5 half-caster slot table", () => {
    const ranger: Class = {
      id: "test:class:ranger",
      name: "Ranger",
      spellcasting: {
        ability: "wis",
        progression: "half",
        mode: "known"
      }
    };

    const derived = computeDerivedState(
      baseState({
        level: 5,
        selectedClassId: ranger.id,
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 16,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [ranger],
        classesById: { [ranger.id]: ranger }
      })
    );

    expect(derived.spellcasting?.slots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("computes third-caster slot table at level 5", () => {
    const arcaneTrickster: Class = {
      id: "test:class:arcane-trickster",
      name: "Arcane Trickster",
      spellcasting: {
        ability: "int",
        progression: "third",
        mode: "known"
      }
    };

    const derived = computeDerivedState(
      baseState({
        level: 5,
        selectedClassId: arcaneTrickster.id,
        baseAbilities: {
          str: 10,
          dex: 14,
          con: 10,
          int: 16,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [arcaneTrickster],
        classesById: { [arcaneTrickster.id]: arcaneTrickster }
      })
    );

    expect(derived.spellcasting?.slots).toEqual([3, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("keeps spellcasting undefined for non-spellcasting classes", () => {
    const fighter: Class = {
      id: "test:class:fighter",
      name: "Fighter"
    };

    const derived = computeDerivedState(
      baseState({
        selectedClassId: fighter.id
      }),
      baseMergedContent({
        classes: [fighter],
        classesById: { [fighter.id]: fighter }
      })
    );

    expect(derived.spellcasting).toBeUndefined();
  });
});

describe("validateCharacter", () => {
  it("reports ORIGIN_FEAT_REQUIRED when background requires origin feat choice", () => {
    const background: Background = {
      id: "test:background:needs-origin-choice",
      name: "Needs Origin Choice",
      originFeatChoice: {}
    };

    const report = validateCharacter(
      baseState({
        selectedBackgroundId: background.id
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ORIGIN_FEAT_REQUIRED")).toBe(true);
  });

  it("reports ORIGIN_FEAT_NOT_ORIGIN when selected origin feat is not category origin", () => {
    const background: Background = {
      id: "test:background:needs-origin-choice",
      name: "Needs Origin Choice",
      originFeatChoice: {}
    };
    const generalFeat: Feat = {
      id: "test:feat:general",
      name: "General Feat",
      category: "general"
    };

    const report = validateCharacter(
      baseState({
        selectedBackgroundId: background.id,
        originFeatId: generalFeat.id
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [generalFeat],
        featsById: { [generalFeat.id]: generalFeat }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ORIGIN_FEAT_NOT_ORIGIN")).toBe(true);
  });

  it("reports ORIGIN_FEAT_FIXED_CONFLICT when fixed background feat is overridden in state", () => {
    const background: Background = {
      id: "test:background:fixed-origin",
      name: "Fixed Origin",
      grantsFeat: "test:feat:origin-alert"
    };
    const fixedOrigin: Feat = {
      id: "test:feat:origin-alert",
      name: "Alert",
      category: "origin"
    };
    const otherOrigin: Feat = {
      id: "test:feat:origin-other",
      name: "Origin Other",
      category: "origin"
    };

    const report = validateCharacter(
      baseState({
        selectedBackgroundId: background.id,
        originFeatId: otherOrigin.id
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [fixedOrigin, otherOrigin],
        featsById: {
          [fixedOrigin.id]: fixedOrigin,
          [otherOrigin.id]: otherOrigin
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ORIGIN_FEAT_FIXED_CONFLICT")).toBe(true);
  });

  it("reports ORIGIN_FEAT_MULTIPLE when more than one origin feat is selected/derived", () => {
    const background: Background = {
      id: "test:background:fixed-origin",
      name: "Fixed Origin",
      grantsFeat: "test:feat:origin-alert"
    };
    const fixedOrigin: Feat = {
      id: "test:feat:origin-alert",
      name: "Alert",
      category: "origin"
    };
    const secondOrigin: Feat = {
      id: "test:feat:origin-second",
      name: "Origin Second",
      category: "origin"
    };

    const report = validateCharacter(
      baseState({
        selectedBackgroundId: background.id,
        selectedFeats: [secondOrigin.id]
      }),
      baseMergedContent({
        backgrounds: [background],
        backgroundsById: { [background.id]: background },
        feats: [fixedOrigin, secondOrigin],
        featsById: {
          [fixedOrigin.id]: fixedOrigin,
          [secondOrigin.id]: secondOrigin
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ORIGIN_FEAT_MULTIPLE")).toBe(true);
  });

  it("reports CLASS_SKILLS_INCOMPLETE when class skill count is not met", () => {
    const klass: Class = {
      id: "test:class:skill-check",
      name: "Skill Check",
      classSkillChoices: {
        count: 2,
        from: ["athletics", "perception", "survival"]
      }
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: klass.id,
        chosenClassSkills: ["athletics"]
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(report.errors.some((issue) => issue.code === "CLASS_SKILLS_INCOMPLETE")).toBe(true);
  });

  it("reports identity/combat numeric range errors", () => {
    const report = validateCharacter(
      baseState({
        xp: -1,
        tempHP: -2,
        hitDiceTotal: -1,
        hitDiceSpent: -1,
        deathSaveSuccesses: 4,
        deathSaveFailures: -1,
        exhaustionLevel: 11,
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "XP_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "TEMP_HP_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "HIT_DICE_TOTAL_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "HIT_DICE_SPENT_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "DEATH_SAVE_SUCCESSES_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "DEATH_SAVE_FAILURES_OUT_OF_RANGE")).toBe(true);
    expect(report.errors.some((issue) => issue.code === "EXHAUSTION_LEVEL_OUT_OF_RANGE")).toBe(true);
  });

  it("reports HIT_DICE_SPENT_EXCEEDS_TOTAL when spent hit dice exceeds total", () => {
    const report = validateCharacter(
      baseState({
        hitDiceTotal: 2,
        hitDiceSpent: 3,
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "HIT_DICE_SPENT_EXCEEDS_TOTAL")).toBe(true);
  });

  it("reports ASI_INVALID_POINTS for invalid ASI point totals", () => {
    const report = validateCharacter(
      baseState({
        advancements: [
          {
            type: "asi",
            changes: { str: 2, dex: 1 },
            source: "level",
            level: 4
          }
        ]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "ASI_INVALID_POINTS")).toBe(true);
  });

  it("reports POINT_BUY_SCORE_OUT_OF_RANGE when point-buy scores exceed min/max", () => {
    const report = validateCharacter(
      baseState({
        abilityScoreMethod: "point_buy",
        baseAbilities: {
          str: 16,
          dex: 14,
          con: 14,
          int: 10,
          wis: 10,
          cha: 8
        }
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "POINT_BUY_SCORE_OUT_OF_RANGE")).toBe(true);
  });

  it("reports POINT_BUY_BUDGET_EXCEEDED when point-buy spends more than 27 points", () => {
    const report = validateCharacter(
      baseState({
        abilityScoreMethod: "point_buy",
        baseAbilities: {
          str: 15,
          dex: 15,
          con: 15,
          int: 15,
          wis: 8,
          cha: 8
        }
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "POINT_BUY_BUDGET_EXCEEDED")).toBe(true);
  });

  it("does not report point-buy errors for legal point-buy allocation", () => {
    const report = validateCharacter(
      baseState({
        abilityScoreMethod: "point_buy",
        baseAbilities: {
          str: 15,
          dex: 14,
          con: 13,
          int: 12,
          wis: 10,
          cha: 8
        }
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "POINT_BUY_SCORE_OUT_OF_RANGE")).toBe(false);
    expect(report.errors.some((issue) => issue.code === "POINT_BUY_BUDGET_EXCEEDED")).toBe(false);
  });

  it("reports STANDARD_ARRAY_INVALID when standard-array allocation is malformed", () => {
    const report = validateCharacter(
      baseState({
        abilityScoreMethod: "standard_array",
        baseAbilities: {
          str: 15,
          dex: 14,
          con: 13,
          int: 12,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "STANDARD_ARRAY_INVALID")).toBe(true);
  });

  it("reports FEAT_ID_MISSING when advancement feat is absent from content", () => {
    const report = validateCharacter(
      baseState({
        advancements: [
          {
            type: "feat",
            featId: "test:feat:missing",
            source: "level",
            level: 4
          }
        ]
      }),
      baseMergedContent({
        featsById: {}
      })
    );

    expect(report.errors.some((issue) => issue.code === "FEAT_ID_MISSING")).toBe(true);
  });

  it("reports WEAPON_NOT_PROFICIENT warning for equipped non-proficient weapon", () => {
    const klass: Class = {
      id: "test:class:simple-only",
      name: "Simple Only",
      weaponProficiencies: { simple: true }
    };
    const weapon = {
      id: "test:weapon:rapier",
      name: "Rapier",
      type: "weapon" as const,
      damageDice: "1d8",
      weaponCategory: "martial" as const
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: klass.id,
        equippedWeaponId: weapon.id
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        equipment: [weapon],
        equipmentById: { [weapon.id]: weapon }
      })
    );

    expect(report.warnings.some((issue) => issue.code === "WEAPON_NOT_PROFICIENT")).toBe(true);
  });

  it("reports FEAT_PREREQ_UNMET when feat prerequisites are not satisfied", () => {
    const feat: Feat = {
      id: "test:feat:heavy-hitter",
      name: "Heavy Hitter",
      prerequisites: {
        minLevel: 4,
        abilities: {
          str: 15
        },
        classIds: ["test:class:fighter"]
      }
    };
    const klass: Class = {
      id: "test:class:wizard",
      name: "Wizard"
    };

    const report = validateCharacter(
      baseState({
        level: 3,
        selectedClassId: klass.id,
        selectedFeats: [feat.id],
        baseAbilities: {
          str: 12,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass },
        feats: [feat],
        featsById: { [feat.id]: feat }
      })
    );

    expect(report.errors.some((issue) => issue.code === "FEAT_PREREQ_UNMET")).toBe(true);
  });

  it("reports FEAT_PREREQ_UNMET when feature and spellcasting prerequisites are not satisfied", () => {
    const feat: Feat = {
      id: "test:feat:spell-blade",
      name: "Spell Blade",
      prerequisites: {
        featureIds: ["test:feature:spellcasting"],
        requiresSpellcasting: true
      }
    };
    const fighter: Class = {
      id: "test:class:fighter",
      name: "Fighter"
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: fighter.id,
        selectedFeats: [feat.id],
        selectedFeatureIds: []
      }),
      baseMergedContent({
        classes: [fighter],
        classesById: { [fighter.id]: fighter },
        features: [
          {
            id: "test:feature:spellcasting",
            name: "Spellcasting"
          }
        ],
        featuresById: {
          "test:feature:spellcasting": {
            id: "test:feature:spellcasting",
            name: "Spellcasting"
          }
        },
        feats: [feat],
        featsById: { [feat.id]: feat }
      })
    );

    expect(report.errors.some((issue) => issue.code === "FEAT_PREREQ_UNMET")).toBe(true);
  });

  it("accepts feat feature/spellcasting prerequisites when they are satisfied", () => {
    const feat: Feat = {
      id: "test:feat:spell-blade",
      name: "Spell Blade",
      prerequisites: {
        featureIds: ["test:feature:spellcasting"],
        requiresSpellcasting: true
      }
    };
    const wizard: Class = {
      id: "test:class:wizard",
      name: "Wizard",
      spellcasting: {
        ability: "int",
        progression: "full"
      }
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: wizard.id,
        selectedFeats: [feat.id],
        selectedFeatureIds: ["test:feature:spellcasting"]
      }),
      baseMergedContent({
        classes: [wizard],
        classesById: { [wizard.id]: wizard },
        features: [
          {
            id: "test:feature:spellcasting",
            name: "Spellcasting"
          }
        ],
        featuresById: {
          "test:feature:spellcasting": {
            id: "test:feature:spellcasting",
            name: "Spellcasting"
          }
        },
        feats: [feat],
        featsById: { [feat.id]: feat }
      })
    );

    expect(report.errors.some((issue) => issue.code === "FEAT_PREREQ_UNMET")).toBe(false);
  });

  it("reports FEAT_DUPLICATE for non-repeatable feat duplicates", () => {
    const feat: Feat = {
      id: "test:feat:tough",
      name: "Tough",
      repeatable: false
    };

    const report = validateCharacter(
      baseState({
        selectedFeats: [feat.id, feat.id]
      }),
      baseMergedContent({
        feats: [feat],
        featsById: { [feat.id]: feat }
      })
    );

    expect(report.errors.some((issue) => issue.code === "FEAT_DUPLICATE")).toBe(true);
  });

  it("reports SKILL_SELECTION_INVALID for unknown skill ids", () => {
    const report = validateCharacter(
      baseState({
        chosenSkillProficiencies: ["not_a_skill"]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "SKILL_SELECTION_INVALID")).toBe(true);
  });

  it("accepts chosen custom skill ids when defined in content", () => {
    const report = validateCharacter(
      baseState({
        chosenSkillProficiencies: ["mysticism"]
      }),
      baseMergedContent({
        skillDefinitions: [{ id: "mysticism", name: "Mysticism", ability: "int" }],
        skillDefinitionsById: {
          mysticism: { id: "mysticism", name: "Mysticism", ability: "int" }
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "SKILL_SELECTION_INVALID")).toBe(false);
  });

  it("reports CONDITION_ID_INVALID for unknown condition ids", () => {
    const report = validateCharacter(
      baseState({
        conditions: {
          overloaded: true
        } as CharacterState["conditions"]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "CONDITION_ID_INVALID")).toBe(true);
  });

  it("reports CONDITION_VALUE_INVALID for non-boolean condition values", () => {
    const report = validateCharacter(
      baseState({
        conditions: {
          encumbered: "yes"
        } as unknown as CharacterState["conditions"]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "CONDITION_VALUE_INVALID")).toBe(true);
  });

  it("reports ADVANCEMENT_SLOT_ILLEGAL when advancement is chosen at invalid level", () => {
    const report = validateCharacter(
      baseState({
        level: 5,
        advancements: [
          {
            type: "feat",
            featId: "test:feat:alert",
            source: "level",
            level: 5
          }
        ]
      }),
      baseMergedContent({
        featsById: {
          "test:feat:alert": {
            id: "test:feat:alert",
            name: "Alert"
          }
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_ILLEGAL")).toBe(true);
  });

  it("reports ADVANCEMENT_SLOT_ILLEGAL when feat selection uses locked level slot", () => {
    const report = validateCharacter(
      baseState({
        level: 5,
        featSelections: {
          level: {
            5: "test:feat:alert"
          }
        }
      }),
      baseMergedContent({
        featsById: {
          "test:feat:alert": {
            id: "test:feat:alert",
            name: "Alert"
          }
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_ILLEGAL")).toBe(true);
  });

  it("reports ADVANCEMENT_SLOT_ILLEGAL when ASI uses locked level slot", () => {
    const report = validateCharacter(
      baseState({
        level: 5,
        advancements: [
          {
            type: "asi",
            changes: { str: 2 },
            source: "level",
            level: 5
          }
        ]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_ILLEGAL")).toBe(true);
  });

  it("reports ADVANCEMENT_SLOT_CONFLICT when slot has both feat and ASI", () => {
    const report = validateCharacter(
      baseState({
        level: 4,
        featSelections: {
          level: {
            4: "test:feat:alert"
          }
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
      baseMergedContent({
        featsById: {
          "test:feat:alert": {
            id: "test:feat:alert",
            name: "Alert"
          }
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_CONFLICT")).toBe(true);
  });

  it("reports ADVANCEMENT_SLOT_MISSING when unlocked slot has neither feat nor ASI", () => {
    const report = validateCharacter(
      baseState({
        level: 4
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_MISSING")).toBe(true);
  });

  it("reports ASI_EXCEEDS_CAP when ASI would raise ability above 20", () => {
    const report = validateCharacter(
      baseState({
        level: 4,
        baseAbilities: {
          str: 19,
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
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "ASI_EXCEEDS_CAP")).toBe(true);
  });

  it("reports INVALID_CLASS_ID for unknown selected class ids", () => {
    const report = validateCharacter(
      baseState({
        selectedClassId: "test:class:missing"
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "INVALID_CLASS_ID")).toBe(true);
  });

  it("reports INVALID_EQUIPPED_WEAPON_TYPE when equippedWeaponId points to non-weapon equipment", () => {
    const report = validateCharacter(
      baseState({
        equippedWeaponId: "test:equipment:shield"
      }),
      baseMergedContent({
        equipment: [
          {
            id: "test:equipment:shield",
            name: "Shield",
            type: "shield",
            hasShieldBonus: true
          }
        ],
        equipmentById: {
          "test:equipment:shield": {
            id: "test:equipment:shield",
            name: "Shield",
            type: "shield",
            hasShieldBonus: true
          }
        }
      })
    );

    expect(report.errors.some((issue) => issue.code === "INVALID_EQUIPPED_WEAPON_TYPE")).toBe(true);
  });

  it("reports INVENTORY_ITEM_ID_MISSING for unknown inventory ids and entries", () => {
    const report = validateCharacter(
      baseState({
        inventoryItemIds: ["test:equipment:missing-item"],
        inventoryEntries: [{ itemId: "test:equipment:missing-entry-item", quantity: 1 }],
      }),
      baseMergedContent(),
    );

    const missingErrors = report.errors.filter((issue) => issue.code === "INVENTORY_ITEM_ID_MISSING");
    expect(missingErrors).toHaveLength(2);
  });

  it("reports INVENTORY_QUANTITY_INVALID for non-positive inventory quantities", () => {
    const report = validateCharacter(
      baseState({
        inventoryEntries: [{ itemId: "test:equipment:rope", quantity: 0 }],
      }),
      baseMergedContent({
        equipment: [{ id: "test:equipment:rope", name: "Rope", type: "weapon" }],
        equipmentById: {
          "test:equipment:rope": { id: "test:equipment:rope", name: "Rope", type: "weapon" },
        },
      }),
    );

    expect(report.errors.some((issue) => issue.code === "INVENTORY_QUANTITY_INVALID")).toBe(true);
  });

  it("reports COIN_VALUE_INVALID for negative coin values", () => {
    const report = validateCharacter(
      baseState({
        coins: { gp: -1 },
      }),
      baseMergedContent(),
    );

    expect(report.errors.some((issue) => issue.code === "COIN_VALUE_INVALID")).toBe(true);
  });

  it("reports equipped-not-in-inventory warnings when inventory is present", () => {
    const report = validateCharacter(
      baseState({
        equippedWeaponId: "test:weapon:longsword",
        inventoryItemIds: ["test:weapon:shortbow"],
      }),
      baseMergedContent({
        equipment: [
          { id: "test:weapon:longsword", name: "Longsword", type: "weapon", damageDice: "1d8" },
          { id: "test:weapon:shortbow", name: "Shortbow", type: "weapon", damageDice: "1d6" },
        ],
        equipmentById: {
          "test:weapon:longsword": {
            id: "test:weapon:longsword",
            name: "Longsword",
            type: "weapon",
            damageDice: "1d8",
          },
          "test:weapon:shortbow": {
            id: "test:weapon:shortbow",
            name: "Shortbow",
            type: "weapon",
            damageDice: "1d6",
          },
        },
      }),
    );

    expect(report.warnings.some((issue) => issue.code === "EQUIPPED_WEAPON_NOT_IN_INVENTORY")).toBe(true);
  });

  it("does not report spellcasting slot errors for valid full-caster progression", () => {
    const klass: Class = {
      id: "test:class:cleric",
      name: "Cleric",
      spellcasting: {
        ability: "wis",
        progression: "full"
      }
    };

    const report = validateCharacter(
      baseState({
        level: 1,
        selectedClassId: klass.id
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(report.errors.some((issue) => issue.code === "SPELLCASTING_SLOTS_MISSING")).toBe(false);
  });

  it("enforces ranger spell selection limits by level", () => {
    const ranger: Class = {
      id: "test:class:ranger",
      name: "Ranger",
      spellcasting: {
        ability: "wis",
        progression: "half",
        mode: "known",
        selectionLimitsByLevel: [
          { level: 1, known: 0, prepared: 0, cantripsKnown: 0 },
          { level: 3, known: 3, prepared: 0, cantripsKnown: 0 },
          { level: 5, known: 4, prepared: 0, cantripsKnown: 0 }
        ]
      }
    };
    const spells: Spell[] = [
      {
        id: "test:spell:alpha",
        name: "Alpha",
        level: 1,
        school: "abjuration",
        castingTime: "1 action",
        range: "Self",
        components: ["V"],
        duration: "Instantaneous"
      },
      {
        id: "test:spell:bravo",
        name: "Bravo",
        level: 1,
        school: "abjuration",
        castingTime: "1 action",
        range: "Self",
        components: ["V"],
        duration: "Instantaneous"
      },
      {
        id: "test:spell:charlie",
        name: "Charlie",
        level: 1,
        school: "abjuration",
        castingTime: "1 action",
        range: "Self",
        components: ["V"],
        duration: "Instantaneous"
      },
      {
        id: "test:spell:delta",
        name: "Delta",
        level: 1,
        school: "abjuration",
        castingTime: "1 action",
        range: "Self",
        components: ["V"],
        duration: "Instantaneous"
      },
      {
        id: "test:spell:echo",
        name: "Echo",
        level: 0,
        school: "abjuration",
        castingTime: "1 action",
        range: "Self",
        components: ["V"],
        duration: "Instantaneous"
      }
    ];
    const spellsById = Object.fromEntries(spells.map((spell) => [spell.id, spell]));

    const commonContent = baseMergedContent({
      classes: [ranger],
      classesById: { [ranger.id]: ranger },
      spells,
      spellsById
    });

    const withinLevel1 = validateCharacter(
      baseState({
        level: 1,
        selectedClassId: ranger.id
      }),
      commonContent
    );
    expect(withinLevel1.errors.some((issue) => issue.code === "SPELL_KNOWN_LIMIT_EXCEEDED")).toBe(false);

    const withinLevel3 = validateCharacter(
      baseState({
        level: 3,
        selectedClassId: ranger.id,
        knownSpellIds: ["test:spell:alpha", "test:spell:bravo", "test:spell:charlie"]
      }),
      commonContent
    );
    expect(withinLevel3.errors.some((issue) => issue.code === "SPELL_KNOWN_LIMIT_EXCEEDED")).toBe(false);

    const withinLevel5 = validateCharacter(
      baseState({
        level: 5,
        selectedClassId: ranger.id,
        knownSpellIds: [
          "test:spell:alpha",
          "test:spell:bravo",
          "test:spell:charlie",
          "test:spell:delta"
        ]
      }),
      commonContent
    );
    expect(withinLevel5.errors.some((issue) => issue.code === "SPELL_KNOWN_LIMIT_EXCEEDED")).toBe(false);

    const overKnown = validateCharacter(
      baseState({
        level: 3,
        selectedClassId: ranger.id,
        knownSpellIds: [
          "test:spell:alpha",
          "test:spell:bravo",
          "test:spell:charlie",
          "test:spell:delta"
        ]
      }),
      commonContent
    );
    expect(overKnown.errors.some((issue) => issue.code === "SPELL_KNOWN_LIMIT_EXCEEDED")).toBe(true);

    const overPrepared = validateCharacter(
      baseState({
        level: 3,
        selectedClassId: ranger.id,
        preparedSpellIds: ["test:spell:alpha"]
      }),
      commonContent
    );
    expect(overPrepared.errors.some((issue) => issue.code === "SPELL_PREPARED_LIMIT_EXCEEDED")).toBe(
      true
    );

    const overCantrips = validateCharacter(
      baseState({
        level: 3,
        selectedClassId: ranger.id,
        cantripsKnownIds: ["test:spell:echo"]
      }),
      commonContent
    );
    expect(
      overCantrips.errors.some((issue) => issue.code === "SPELL_CANTRIPS_KNOWN_LIMIT_EXCEEDED")
    ).toBe(true);
  });

  it("reports SPELLCASTING_DERIVED_INVALID for malformed spellcasting ability scores", () => {
    const klass: Class = {
      id: "test:class:cleric",
      name: "Cleric",
      spellcasting: {
        ability: "wis",
        progression: "full"
      }
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: klass.id,
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: Number.NaN,
          cha: 10
        }
      }),
      baseMergedContent({
        classes: [klass],
        classesById: { [klass.id]: klass }
      })
    );

    expect(report.errors.some((issue) => issue.code === "SPELLCASTING_DERIVED_INVALID")).toBe(true);
  });

  it("reports SPELLCASTING_PACT_UNIMPLEMENTED for pact progression", () => {
    const warlock: Class = {
      id: "test:class:warlock",
      name: "Warlock",
      spellcasting: {
        ability: "cha",
        progression: "pact",
        mode: "known"
      }
    };

    const report = validateCharacter(
      baseState({
        selectedClassId: warlock.id,
        baseAbilities: {
          str: 10,
          dex: 10,
          con: 10,
          int: 10,
          wis: 10,
          cha: 16
        }
      }),
      baseMergedContent({
        classes: [warlock],
        classesById: { [warlock.id]: warlock }
      })
    );

    expect(report.errors.some((issue) => issue.code === "SPELLCASTING_PACT_UNIMPLEMENTED")).toBe(true);
    expect(report.isValidForExport).toBe(false);
  });

  it("reports SPELL_ID_MISSING when prepared/known spell ids are unknown", () => {
    const report = validateCharacter(
      baseState({
        knownSpellIds: ["test:spell:missing-known"],
        preparedSpellIds: ["test:spell:missing-prepared"],
        cantripsKnownIds: ["test:spell:missing-cantrip"]
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "SPELL_ID_MISSING")).toBe(true);
  });

  it("builds skill and tool display rows with tools shown only when proficient", () => {
    const rows = getSkillAndToolDisplayRows({
      skillDefinitions: [
        { id: "athletics", name: "Athletics" },
        { id: "arcana", name: "Arcana" }
      ],
      skills: {
        athletics: 4,
        arcana: 0,
        survival: 2
      },
      toolProficiencies: ["Disguise Kit", "Gaming Set", "Disguise Kit"]
    });

    expect(rows).toEqual([
      { kind: "skill", id: "athletics", label: "Athletics", value: 4 },
      { kind: "skill", id: "arcana", label: "Arcana", value: 0 },
      { kind: "skill", id: "survival", label: "Survival", value: 2 },
      { kind: "tool", id: "Disguise Kit", label: "Disguise Kit" },
      { kind: "tool", id: "Gaming Set", label: "Gaming Set" }
    ]);
  });

  it("does not emit tool rows when no tool proficiencies are present", () => {
    const rows = getSkillAndToolDisplayRows({
      skills: {
        stealth: 5
      },
      toolProficiencies: []
    });

    expect(rows).toEqual([{ kind: "skill", id: "stealth", label: "Stealth", value: 5 }]);
  });

  it("builds distinct skill and proficient tool display buckets from shared input", () => {
    const model = getSkillAndToolDisplayModel({
      skillDefinitions: [
        { id: "arcana", name: "Arcana", sortOrder: 5 },
        { id: "athletics", name: "Athletics", sortOrder: 2 },
        { id: "arcana", name: "Arcana Duplicate", sortOrder: 0 },
      ],
      skills: {
        athletics: 3,
        arcana: 1,
      },
      toolProficiencies: ["Gaming Set", "Disguise Kit", "Gaming Set"],
    });

    expect(model.skillRows).toEqual([
      { kind: "skill", id: "athletics", label: "Athletics", value: 3 },
      { kind: "skill", id: "arcana", label: "Arcana", value: 1 },
    ]);
    expect(model.proficientToolRows).toEqual([
      { kind: "tool", id: "Disguise Kit", label: "Disguise Kit" },
      { kind: "tool", id: "Gaming Set", label: "Gaming Set" },
    ]);
    expect(model.rows).toEqual([...model.skillRows, ...model.proficientToolRows]);
  });

  it("buildPdfExportFromTemplate returns deterministic non-empty PDF bytes for valid export", () => {
    const validation = validateCharacter(baseState(), baseMergedContent());
    expect(validation.errors).toHaveLength(0);

    const templateBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a]);
    const snapshot = {
      level: 1,
      className: "Fighter",
      speciesName: "Human",
      backgroundName: "Acolyte",
      abilities: {
        str: 15,
        dex: 14,
        con: 13,
        int: 12,
        wis: 10,
        cha: 8
      },
      abilityMods: {
        str: 2,
        dex: 2,
        con: 1,
        int: 1,
        wis: 0,
        cha: -1
      },
      proficiencyBonus: 2,
      armorClass: 16,
      maxHP: 11,
      speed: 30,
      attackName: "Longsword",
      attackToHit: 4,
      attackDamage: "1d8+2 slashing",
      featNames: ["Savage Attacker"]
    } as const;
    const exportA = buildPdfExportFromTemplate(templateBytes, validation, snapshot);
    const exportB = buildPdfExportFromTemplate(templateBytes, validation, snapshot);

    expect(exportA.ok).toBe(true);
    expect(exportB.ok).toBe(true);
    if (!exportA.ok || !exportB.ok) {
      return;
    }

    expect(exportA.pdfBytes.byteLength).toBeGreaterThan(0);
    expect(Array.from(exportA.pdfBytes)).toEqual(Array.from(exportB.pdfBytes));
    expect(Array.from(exportA.pdfBytes)).not.toEqual(Array.from(templateBytes));
  });

  it("buildPdfExportFromTemplate blocks export with clear error when validation has errors", () => {
    const validation = validateCharacter(
      baseState({
        selectedSpeciesId: "missing:species"
      }),
      baseMergedContent()
    );
    expect(validation.errors.length).toBeGreaterThan(0);

    const result = buildPdfExportFromTemplate(new Uint8Array([0x25, 0x50, 0x44, 0x46]), validation);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("PDF_EXPORT_BLOCKED");
    expect(result.error.message).toContain("PDF export blocked: resolve validation errors first.");
    expect(result.error.message).toContain("[INVALID_SPECIES_ID]");
  });
});
