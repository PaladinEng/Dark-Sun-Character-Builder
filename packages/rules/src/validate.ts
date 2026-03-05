import type { MergedContent } from "@dark-sun/content";

import { getAvailableAdvancementSlots } from "./advancement";
import {
  computeAbilityMod,
  computeFinalAbilities,
  computeProfBonus,
  isProficientWithWeapon
} from "./compute";
import { getSpellSlots } from "./spellSlots";
import type { Ability, CharacterState } from "./types";

export type ValidationIssue = {
  code: string;
  message: string;
  path?: string;
};

export type ValidationReport = {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  isValidForExport: boolean;
};

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function parseLevelFeatSelections(state: CharacterState): Map<number, string> {
  const selections = new Map<number, string>();
  const raw = state.featSelections?.level ?? {};
  for (const [key, value] of Object.entries(raw)) {
    const level = Number(key);
    if (!Number.isFinite(level) || typeof value !== "string" || value.length === 0) {
      continue;
    }
    selections.set(level, value);
  }
  return selections;
}

const STANDARD_SKILLS = new Set([
  "athletics",
  "acrobatics",
  "sleight_of_hand",
  "stealth",
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
  "animal_handling",
  "insight",
  "medicine",
  "perception",
  "survival",
  "deception",
  "intimidation",
  "performance",
  "persuasion"
]);

export function validateCharacter(
  state: CharacterState,
  content: MergedContent
): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const pushError = (issue: ValidationIssue) => {
    errors.push(issue);
  };
  const pushWarning = (issue: ValidationIssue) => {
    warnings.push(issue);
  };

  const selectedBackground = state.selectedBackgroundId
    ? content.backgroundsById[state.selectedBackgroundId]
    : undefined;
  const selectedClass = state.selectedClassId
    ? content.classesById[state.selectedClassId]
    : undefined;
  const selectedWeapon = state.equippedWeaponId
    ? content.equipmentById[state.equippedWeaponId]
    : undefined;
  const selectedArmor = state.equippedArmorId
    ? content.equipmentById[state.equippedArmorId]
    : undefined;
  const selectedShield = state.equippedShieldId
    ? content.equipmentById[state.equippedShieldId]
    : undefined;
  const selectedClassIdsMaybe = (
    state as CharacterState & {
      selectedClassIds?: unknown;
    }
  ).selectedClassIds;
  const level = Math.max(1, Math.min(20, Math.floor(state.level || 1)));
  const levelFeatSelections = parseLevelFeatSelections(state);
  const legacyLevelFeatAdvancements = (state.advancements ?? []).filter(
    (
      entry
    ): entry is Extract<NonNullable<CharacterState["advancements"]>[number], { type: "feat" }> =>
      entry.type === "feat"
  );
  const fixedOriginFeatId = selectedBackground?.grantsOriginFeatId ?? selectedBackground?.grantsFeat;
  const originFeatChoice = selectedBackground?.originFeatChoice;
  const selectedOriginFeatId = state.featSelections?.origin ?? state.originFeatId;
  const effectiveOriginFeatId =
    fixedOriginFeatId ?? (originFeatChoice ? selectedOriginFeatId : undefined);
  const asiIncreases = (state.advancements ?? [])
    .filter(
      (entry): entry is Extract<NonNullable<CharacterState["advancements"]>[number], { type: "asi" }> =>
        entry.type === "asi"
    )
    .map((entry) => ({
      source: "other" as const,
      changes: entry.changes
    }));
  const finalAbilities = computeFinalAbilities({
    ...state,
    abilityIncreases: [...(state.abilityIncreases ?? []), ...asiIncreases]
  });

  if (!Number.isInteger(state.level) || state.level < 1 || state.level > 20) {
    pushError({
      code: "LEVEL_OUT_OF_RANGE",
      message: "Character level must be an integer between 1 and 20.",
      path: "level"
    });
  }

  if (Array.isArray(selectedClassIdsMaybe) && selectedClassIdsMaybe.length > 1) {
    pushError({
      code: "MULTICLASS_UNSUPPORTED",
      message: "Multiclass selections are not supported in this builder.",
      path: "selectedClassIds"
    });
  }

  if (state.selectedSpeciesId && !content.speciesById[state.selectedSpeciesId]) {
    pushError({
      code: "INVALID_SPECIES_ID",
      message: `Selected species id not found: ${state.selectedSpeciesId}.`,
      path: "selectedSpeciesId"
    });
  }

  if (state.selectedBackgroundId && !content.backgroundsById[state.selectedBackgroundId]) {
    pushError({
      code: "INVALID_BACKGROUND_ID",
      message: `Selected background id not found: ${state.selectedBackgroundId}.`,
      path: "selectedBackgroundId"
    });
  }

  if (state.selectedClassId && !content.classesById[state.selectedClassId]) {
    pushError({
      code: "INVALID_CLASS_ID",
      message: `Selected class id not found: ${state.selectedClassId}.`,
      path: "selectedClassId"
    });
  }

  for (const [index, featureId] of (state.selectedFeatureIds ?? []).entries()) {
    if (!content.featuresById[featureId]) {
      pushError({
        code: "INVALID_FEATURE_ID",
        message: `Selected feature id not found: ${featureId}.`,
        path: `selectedFeatureIds[${index}]`
      });
    }
  }

  if (state.equippedArmorId) {
    if (!selectedArmor) {
      pushError({
        code: "INVALID_EQUIPPED_ARMOR_ID",
        message: `Equipped armor id not found: ${state.equippedArmorId}.`,
        path: "equippedArmorId"
      });
    } else if (
      selectedArmor.type !== "armor_light" &&
      selectedArmor.type !== "armor_medium" &&
      selectedArmor.type !== "armor_heavy"
    ) {
      pushError({
        code: "INVALID_EQUIPPED_ARMOR_TYPE",
        message: `Equipped armor id does not reference armor: ${state.equippedArmorId}.`,
        path: "equippedArmorId"
      });
    }
  }

  if (state.equippedShieldId) {
    if (!selectedShield) {
      pushError({
        code: "INVALID_EQUIPPED_SHIELD_ID",
        message: `Equipped shield id not found: ${state.equippedShieldId}.`,
        path: "equippedShieldId"
      });
    } else if (selectedShield.type !== "shield") {
      pushError({
        code: "INVALID_EQUIPPED_SHIELD_TYPE",
        message: `Equipped shield id does not reference a shield: ${state.equippedShieldId}.`,
        path: "equippedShieldId"
      });
    }
  }

  if (state.equippedWeaponId) {
    if (!selectedWeapon) {
      pushError({
        code: "INVALID_EQUIPPED_WEAPON_ID",
        message: `Equipped weapon id not found: ${state.equippedWeaponId}.`,
        path: "equippedWeaponId"
      });
    } else if (selectedWeapon.type !== "weapon") {
      pushError({
        code: "INVALID_EQUIPPED_WEAPON_TYPE",
        message: `Equipped weapon id does not reference a weapon: ${state.equippedWeaponId}.`,
        path: "equippedWeaponId"
      });
    }
  }

  if (originFeatChoice && !selectedOriginFeatId) {
    pushError({
      code: "ORIGIN_FEAT_REQUIRED",
      message: "Selected background requires choosing an origin feat.",
      path: "featSelections.origin"
    });
  }

  if (
    originFeatChoice?.featIds &&
    selectedOriginFeatId &&
    !originFeatChoice.featIds.includes(selectedOriginFeatId)
  ) {
    pushError({
      code: "ORIGIN_FEAT_NOT_ALLOWED",
      message: `Selected origin feat is not allowed by this background: ${selectedOriginFeatId}.`,
      path: "featSelections.origin"
    });
  }

  if (fixedOriginFeatId && selectedOriginFeatId && selectedOriginFeatId !== fixedOriginFeatId) {
    pushError({
      code: "ORIGIN_FEAT_FIXED_CONFLICT",
      message: `Background grants fixed origin feat ${fixedOriginFeatId}; selected ${selectedOriginFeatId}.`,
      path: "featSelections.origin"
    });
  }

  if (effectiveOriginFeatId) {
    const feat = content.featsById[effectiveOriginFeatId];
    if (!feat) {
      pushError({
        code: "ORIGIN_FEAT_ID_MISSING",
        message: `Origin feat id not found in content: ${effectiveOriginFeatId}.`,
        path: "featSelections.origin"
      });
    } else if (feat.category !== "origin") {
      pushError({
        code: "ORIGIN_FEAT_NOT_ORIGIN",
        message: `Selected origin feat is not categorized as origin: ${feat.id}.`,
        path: "featSelections.origin"
      });
    }
  }

  const originFeatIds = dedupe([
    ...((state.selectedFeats ?? []).filter(
      (featId) => content.featsById[featId]?.category === "origin"
    ) ?? []),
    ...(legacyLevelFeatAdvancements
      .map((advancement) => advancement.featId)
      .filter((featId) => content.featsById[featId]?.category === "origin") ?? []),
    ...([...levelFeatSelections.values()].filter(
      (featId) => content.featsById[featId]?.category === "origin"
    ) ?? []),
    ...((effectiveOriginFeatId && content.featsById[effectiveOriginFeatId]?.category === "origin")
      ? [effectiveOriginFeatId]
      : [])
  ]);
  if (originFeatIds.length > 1) {
    pushError({
      code: "ORIGIN_FEAT_MULTIPLE",
      message: `Multiple origin feats selected/derived: ${originFeatIds.join(", ")}.`,
      path: "featSelections.origin"
    });
  }

  const invalidSkillSelections = dedupe(
    (state.chosenSkillProficiencies ?? []).filter((skill) => !STANDARD_SKILLS.has(skill))
  );
  if (invalidSkillSelections.length > 0) {
    pushError({
      code: "SKILL_SELECTION_INVALID",
      message: `Invalid skill selections: ${invalidSkillSelections.join(", ")}.`,
      path: "chosenSkillProficiencies"
    });
  }

  if (selectedClass?.classSkillChoices) {
    const chosen = dedupe(state.chosenClassSkills ?? []);
    const expected = selectedClass.classSkillChoices.count;
    const allowed = new Set(selectedClass.classSkillChoices.from);
    const invalid = chosen.filter((skillId) => !allowed.has(skillId));

    if (chosen.length !== expected) {
      pushError({
        code: "CLASS_SKILLS_INCOMPLETE",
        message: `Choose ${expected} class skills (currently ${chosen.length}).`,
        path: "classSkills"
      });
    }

    if (invalid.length > 0) {
      pushError({
        code: "CLASS_SKILLS_INVALID",
        message: `Invalid class skills selected: ${invalid.join(", ")}.`,
        path: "classSkills"
      });
    }
  }

  const levelCounts = new Map<number, number>();
  const allowedAdvancementSlots = new Set(
    getAvailableAdvancementSlots(level, state.selectedClassId)
  );
  for (const slotLevel of levelFeatSelections.keys()) {
    levelCounts.set(slotLevel, (levelCounts.get(slotLevel) ?? 0) + 1);
  }
  for (const advancement of state.advancements ?? []) {
    levelCounts.set(advancement.level, (levelCounts.get(advancement.level) ?? 0) + 1);
  }
  for (const [level, count] of levelCounts.entries()) {
    if (count > 1) {
      pushError({
        code: "ADVANCEMENT_SLOT_DUPLICATE",
        message: `Multiple advancements found for level ${level}.`,
        path: `advancements[level=${level}]`
      });
    }
  }

  for (const [slotLevel, featId] of levelFeatSelections.entries()) {
    if (!allowedAdvancementSlots.has(slotLevel)) {
      pushError({
        code: "ADVANCEMENT_SLOT_ILLEGAL",
        message: `No advancement slot available at level ${slotLevel}.`,
        path: `featSelections.level[${slotLevel}]`
      });
    }

    if (!content.featsById[featId]) {
      pushError({
        code: "FEAT_ID_MISSING",
        message: `Feat id not found in content: ${featId}.`,
        path: `featSelections.level[${slotLevel}]`
      });
    }
  }

  for (const [index, advancement] of (state.advancements ?? []).entries()) {
    if (advancement.source === "level" && !allowedAdvancementSlots.has(advancement.level)) {
      pushError({
        code: "ADVANCEMENT_SLOT_ILLEGAL",
        message: `No advancement slot available at level ${advancement.level}.`,
        path: `advancements[${index}]`
      });
    }

    if (advancement.type === "feat" && !content.featsById[advancement.featId]) {
      pushError({
        code: "FEAT_ID_MISSING",
        message: `Advancement feat id not found in content: ${advancement.featId}.`,
        path: `advancements[${index}]`
      });
    }

    if (advancement.type === "asi") {
      const entries = Object.entries(advancement.changes).filter(
        (_entry): _entry is [string, number] => typeof _entry[1] === "number"
      );
      const hasNegative = entries.some(([, value]) => value < 0);
      const total = entries.reduce((sum, [, value]) => sum + value, 0);
      const nonZero = entries.filter(([, value]) => value !== 0);
      const onePlusOne =
        nonZero.length === 2 &&
        nonZero[0]?.[1] === 1 &&
        nonZero[1]?.[1] === 1 &&
        nonZero[0]?.[0] !== nonZero[1]?.[0];
      const plusTwo = nonZero.length === 1 && nonZero[0]?.[1] === 2;
      const isValid = !hasNegative && total === 2 && (onePlusOne || plusTwo);

      if (!isValid) {
        pushError({
          code: "ASI_INVALID_POINTS",
          message:
            "ASI must allocate exactly 2 points as +2 to one ability or +1/+1 to two different abilities.",
          path: `advancements[${index}]`
        });
      }
    }
  }

  for (const slotLevel of allowedAdvancementSlots) {
    const hasFeatSelection =
      levelFeatSelections.has(slotLevel) ||
      legacyLevelFeatAdvancements.some((entry) => entry.level === slotLevel);
    const hasAsiSelection = (state.advancements ?? []).some(
      (entry) => entry.type === "asi" && entry.level === slotLevel
    );
    if (!hasFeatSelection && !hasAsiSelection) {
      pushError({
        code: "ADVANCEMENT_SLOT_MISSING",
        message: `Advancement slot at level ${slotLevel} must be filled with a feat or ASI.`,
        path: `advancements[level=${slotLevel}]`
      });
    }
  }

  const chosenFeatIds = [
    ...(state.selectedFeats ?? []),
    ...legacyLevelFeatAdvancements.map((entry) => entry.featId),
    ...[...levelFeatSelections.values()],
    ...(effectiveOriginFeatId ? [effectiveOriginFeatId] : [])
  ];
  for (const featId of dedupe(chosenFeatIds)) {
    if (!content.featsById[featId]) {
      pushError({
        code: "FEAT_ID_MISSING",
        message: `Feat id not found in content: ${featId}.`,
        path: "feats"
      });
    }
  }

  const counts = new Map<string, number>();
  for (const featId of chosenFeatIds) {
    counts.set(featId, (counts.get(featId) ?? 0) + 1);
  }
  for (const [featId, count] of counts.entries()) {
    const feat = content.featsById[featId];
    if (count > 1 && feat && feat.repeatable !== true) {
      pushError({
        code: "FEAT_DUPLICATE",
        message: `Feat selected multiple times but is not repeatable: ${featId}.`,
        path: "feats"
      });
    }
  }

  for (const featId of dedupe(chosenFeatIds)) {
    const feat = content.featsById[featId];
    if (!feat?.prerequisites) {
      continue;
    }

    const prereq = feat.prerequisites;
    if (typeof prereq.minLevel === "number" && level < prereq.minLevel) {
      pushError({
        code: "FEAT_PREREQ_UNMET",
        message: `Feat ${feat.name} requires level ${prereq.minLevel}.`,
        path: "feats"
      });
    }

    if (
      prereq.classIds &&
      prereq.classIds.length > 0 &&
      (!state.selectedClassId || !prereq.classIds.includes(state.selectedClassId))
    ) {
      pushError({
        code: "FEAT_PREREQ_UNMET",
        message: `Feat ${feat.name} requires one of classes: ${prereq.classIds.join(", ")}.`,
        path: "feats"
      });
    }

    if (
      prereq.speciesIds &&
      prereq.speciesIds.length > 0 &&
      (!state.selectedSpeciesId || !prereq.speciesIds.includes(state.selectedSpeciesId))
    ) {
      pushError({
        code: "FEAT_PREREQ_UNMET",
        message: `Feat ${feat.name} requires one of species: ${prereq.speciesIds.join(", ")}.`,
        path: "feats"
      });
    }

    if (prereq.abilities) {
      const reqEntries = Object.entries(prereq.abilities).filter(
        (entry): entry is [Ability, number] => typeof entry[1] === "number"
      );
      for (const [ability, minimum] of reqEntries) {
        if ((finalAbilities[ability] ?? 0) < minimum) {
          pushError({
            code: "FEAT_PREREQ_UNMET",
            message: `Feat ${feat.name} requires ${ability.toUpperCase()} ${minimum}.`,
            path: "feats"
          });
        }
      }
    }
  }

  if (selectedWeapon?.type === "weapon") {
    const explicitWeaponProficiency =
      selectedClass?.weaponProficiencies?.weaponIds?.includes(selectedWeapon.id) === true;

    if (!selectedWeapon.weaponCategory && !explicitWeaponProficiency) {
      pushWarning({
        code: "WEAPON_CATEGORY_MISSING",
        message: `Weapon category missing for ${selectedWeapon.name}; proficiency cannot be fully determined.`,
        path: "equipment.weaponCategory"
      });
    }

    if (!isProficientWithWeapon(selectedWeapon, selectedClass)) {
      pushWarning({
        code: "WEAPON_NOT_PROFICIENT",
        message: `Character is not proficient with equipped weapon: ${selectedWeapon.name}.`,
        path: "equipment"
      });
    }
  }

  if (selectedClass?.spellcasting) {
    const progression = selectedClass.spellcasting.progression;
    const slots = progression === "pact" ? {} : getSpellSlots(level, progression);
    const abilityMod = computeAbilityMod(finalAbilities[selectedClass.spellcasting.ability] ?? NaN);
    const profBonus = computeProfBonus(level);
    const saveDC = 8 + profBonus + abilityMod;
    const attackBonus = profBonus + abilityMod;

    if (!Number.isFinite(saveDC) || !Number.isFinite(attackBonus)) {
      pushError({
        code: "SPELLCASTING_DERIVED_INVALID",
        message: `Unable to derive spell save DC/attack bonus for ${selectedClass.name}.`,
        path: "spellcasting"
      });
    }

    if (progression === "pact") {
      pushError({
        code: "SPELLCASTING_PACT_UNIMPLEMENTED",
        message: `Pact spell slot progression is not implemented for ${selectedClass.name}.`,
        path: "spellcasting.progression"
      });
    }

    const shouldHaveSlots =
      progression === "full"
        ? level >= 1
        : progression === "half"
          ? level >= 2
          : progression === "third"
            ? level >= 3
            : false;
    if (shouldHaveSlots && Object.keys(slots).length === 0) {
      pushError({
        code: "SPELLCASTING_SLOTS_MISSING",
        message: `Spell slots are missing for ${selectedClass.name} at level ${level}.`,
        path: "spellcasting.slots"
      });
    }
  }

  const referencedSpellIds = dedupe([
    ...(state.knownSpellIds ?? []),
    ...(state.preparedSpellIds ?? []),
    ...(state.cantripsKnownIds ?? [])
  ]);
  for (const spellId of referencedSpellIds) {
    if (!content.spellsById[spellId]) {
      pushError({
        code: "SPELL_ID_MISSING",
        message: `Spell id not found in content: ${spellId}.`,
        path: "spells"
      });
    }
  }

  return {
    errors,
    warnings,
    isValidForExport: errors.length === 0
  };
}
