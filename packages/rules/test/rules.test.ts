import type { Background, Class, Feat, MergedContent, PackManifest } from "@dark-sun/content";
import { describe, expect, it } from "vitest";

import {
  computeDerivedState,
  computeProfBonus,
  getAvailableAdvancementSlots,
  validateCharacter
} from "../src";
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
    spells: [],
    spellLists: [],
    speciesById: {},
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
      slots: { 1: 2 }
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

    expect(derived.spellcasting?.slots).toEqual({ 1: 4, 2: 3, 3: 2 });
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

    expect(derived.spellcasting?.slots).toEqual({ 1: 4, 2: 2 });
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

    expect(derived.spellcasting?.slots).toEqual({ 1: 3 });
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

  it("reports ADVANCEMENT_SLOT_MISSING when unlocked slot has neither feat nor ASI", () => {
    const report = validateCharacter(
      baseState({
        level: 4
      }),
      baseMergedContent()
    );

    expect(report.errors.some((issue) => issue.code === "ADVANCEMENT_SLOT_MISSING")).toBe(true);
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
});
