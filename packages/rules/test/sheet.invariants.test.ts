import { describe, expect, it } from "vitest";

import { computeDerivedState, computeProfBonus, getAvailableAdvancementSlots } from "../src";
import { listFixtureIds, readFixtureInput } from "./sheet-fixtures";

describe("sheet.invariants", () => {
  const fixtureIds = listFixtureIds();

  for (const id of fixtureIds) {
    it(`${id}: spellcasting fields remain internally consistent`, () => {
      const { state, content } = readFixtureInput(id);
      const derived = computeDerivedState(state, content);

      expect(derived.armorClass).toBeGreaterThanOrEqual(10);
      expect(derived.passivePerception).toBe(10 + (derived.skills.perception ?? 0));
      expect(derived.proficiencyBonus).toBe(
        computeProfBonus(Math.max(1, Math.floor(state.level || 1)))
      );

      const requiredSlots = getAvailableAdvancementSlots(
        Math.max(1, Math.floor(state.level || 1)),
        state.selectedClassId
      );
      const slotMap = new Map(derived.advancementSlots.map((slot) => [slot.level, slot]));
      for (const requiredSlotLevel of requiredSlots) {
        const slot = slotMap.get(requiredSlotLevel);
        expect(slot).toBeDefined();
        expect(slot?.filled).toBe(true);
      }

      const background = state.selectedBackgroundId
        ? content.backgroundsById[state.selectedBackgroundId]
        : undefined;
      const effectiveOriginFeatId =
        background?.grantsOriginFeatId ??
        background?.grantsFeat ??
        (background?.originFeatChoice
          ? state.featSelections?.origin ?? state.originFeatId
          : undefined);
      if (effectiveOriginFeatId) {
        const originFeat = content.featsById[effectiveOriginFeatId];
        expect(originFeat?.category).toBe("origin");
      }

      if (derived.spellcastingAbility === null) {
        expect(derived.spellSaveDC).toBeNull();
        expect(derived.spellAttackBonus).toBeNull();
        expect(derived.spellSlots).toBeNull();
        return;
      }

      const ability = derived.spellcastingAbility;
      const expectedSaveDC = 8 + derived.proficiencyBonus + derived.abilityMods[ability];
      const expectedAttackBonus = derived.proficiencyBonus + derived.abilityMods[ability];

      expect(derived.spellSaveDC).toBe(expectedSaveDC);
      expect(derived.spellAttackBonus).toBe(expectedAttackBonus);
      expect(derived.spellSlots).not.toBeNull();
    });
  }
});
