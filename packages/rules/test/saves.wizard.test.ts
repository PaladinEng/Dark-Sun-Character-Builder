import path from "node:path";
import { fileURLToPath } from "node:url";

import { mergePacks } from "@dark-sun/content";
import { loadPackFromDir } from "@dark-sun/content/node";
import { describe, expect, it } from "vitest";

import { computeDerivedState } from "../src";
import type { CharacterState } from "../src/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const srdPackDir = path.resolve(here, "../../../apps/web/content/packs/srd52");

describe("Wizard saves include proficiency bonus", () => {
  it("L1 Wizard with INT 16 has +5 INT save (mod +3 + prof +2)", async () => {
    const pack = await loadPackFromDir(srdPackDir);
    const merged = mergePacks([pack]).content;

    const state: CharacterState = {
      level: 1,
      baseAbilities: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
      chosenClassSkills: [],
      chosenSkillProficiencies: [],
      chosenSaveProficiencies: [],
      selectedClassId: "srd52:class:wizard",
      featSelections: { level: {} },
    };

    const derived = computeDerivedState(state, merged);

    expect(derived.proficiencyBonus).toBe(2);
    expect(derived.saveProficiencies).toContain("int");
    expect(derived.saveProficiencies).toContain("wis");
    // INT 16 → mod +3, proficient → +5
    expect(derived.savingThrows.int).toBe(5);
    // WIS 10 → mod 0, proficient → +2
    expect(derived.savingThrows.wis).toBe(2);
    // STR 10 → mod 0, not proficient → 0
    expect(derived.savingThrows.str).toBe(0);
    // DEX 14 → mod +2, not proficient → +2
    expect(derived.savingThrows.dex).toBe(2);
  });

  it("L5 Wizard scales proficiency bonus into saves (PB +3)", async () => {
    const pack = await loadPackFromDir(srdPackDir);
    const merged = mergePacks([pack]).content;

    const state: CharacterState = {
      level: 5,
      baseAbilities: { str: 10, dex: 10, con: 10, int: 16, wis: 12, cha: 10 },
      chosenClassSkills: [],
      chosenSkillProficiencies: [],
      chosenSaveProficiencies: [],
      selectedClassId: "srd52:class:wizard",
      featSelections: { level: {} },
    };

    const derived = computeDerivedState(state, merged);

    expect(derived.proficiencyBonus).toBe(3);
    // INT 16 → mod +3, proficient → +6
    expect(derived.savingThrows.int).toBe(6);
    // WIS 12 → mod +1, proficient → +4
    expect(derived.savingThrows.wis).toBe(4);
    // CON 10 → mod 0, NOT proficient → 0
    expect(derived.savingThrows.con).toBe(0);
  });
});
