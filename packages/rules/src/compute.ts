import type {
  Class,
  Effect,
  Equipment,
  Feat,
  Feature,
  MergedContent
} from "@dark-sun/content";

import { getAvailableAdvancementSlots } from "./advancement";
import { applyEffectsToCharacter } from "./effects";
import {
  ABILITIES,
  type Ability,
  type AbilityRecord,
  type Advancement,
  type CharacterState,
  type DerivedState
} from "./types";

const SKILL_TO_ABILITY: Record<string, Ability> = {
  athletics: "str",
  acrobatics: "dex",
  sleight_of_hand: "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  animal_handling: "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha"
};

const STANDARD_SKILLS = Object.keys(SKILL_TO_ABILITY);

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getBonusTotal(
  bonuses: Array<{ target: "skill" | "save"; key: string; value: number }>,
  target: "skill" | "save",
  key: string
): number {
  return bonuses
    .filter((bonus) => bonus.target === target && bonus.key === key)
    .reduce((sum, bonus) => sum + bonus.value, 0);
}

export function computeAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function computeProfBonus(level: number): number {
  const normalized = Math.max(1, Math.floor(level));
  return 2 + Math.floor((normalized - 1) / 4);
}

function defaultAbilities(): AbilityRecord {
  return {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10
  };
}

export function computeFinalAbilities(state: CharacterState): AbilityRecord {
  const base = state.baseAbilities ?? state.abilities ?? defaultAbilities();
  const result: AbilityRecord = { ...base };

  for (const increase of state.abilityIncreases ?? []) {
    for (const ability of ABILITIES) {
      const value = increase.changes[ability];
      if (typeof value === "number") {
        result[ability] += value;
      }
    }
  }

  for (const ability of ABILITIES) {
    result[ability] = Math.min(20, result[ability]);
  }

  return result;
}

function hasProperty(equipment: Equipment, wanted: string): boolean {
  const lowerWanted = wanted.toLowerCase();
  return (equipment.properties ?? []).some(
    (property: string) => property.toLowerCase() === lowerWanted
  );
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function resolveSelectedFeatures(
  state: CharacterState,
  merged: MergedContent
): Feature[] {
  return (state.selectedFeatureIds ?? [])
    .map((id) => merged.featuresById[id])
    .filter((feature): feature is Feature => Boolean(feature));
}

function resolveSelectedFeats(
  state: CharacterState,
  merged: MergedContent,
  advancementFeatIds: string[]
): Feat[] {
  const background = state.selectedBackgroundId
    ? merged.backgroundsById[state.selectedBackgroundId]
    : undefined;

  const allIds = dedupe([
    ...(state.selectedFeats ?? []),
    ...advancementFeatIds,
    ...(background?.grantsFeat ? [background.grantsFeat] : [])
  ]);

  return allIds
    .map((id) => merged.featsById[id])
    .filter((feat): feat is Feat => Boolean(feat));
}

function getLevelAdvancements(
  state: CharacterState,
  slotLevels: number[]
): Map<number, Advancement> {
  const set = new Set(slotLevels);
  const byLevel = new Map<number, Advancement>();
  for (const advancement of state.advancements ?? []) {
    if (advancement.source !== "level") continue;
    if (!set.has(advancement.level)) continue;
    byLevel.set(advancement.level, advancement);
  }
  return byLevel;
}

export function computeDerivedState(
  state: CharacterState,
  merged: MergedContent
): DerivedState {
  const level = Math.max(1, Math.floor(state.level || 1));
  const slotLevels = getAvailableAdvancementSlots(level, state.selectedClassId);
  const advancementsByLevel = getLevelAdvancements(state, slotLevels);

  const asiIncreases = [...advancementsByLevel.values()]
    .filter(
      (entry): entry is Extract<Advancement, { type: "asi" }> =>
        entry.type === "asi"
    )
    .map((entry) => ({
      source: "other" as const,
      changes: entry.changes
    }));

  const effectiveState: CharacterState = {
    ...state,
    abilityIncreases: [...(state.abilityIncreases ?? []), ...asiIncreases]
  };

  const finalAbilities = computeFinalAbilities(effectiveState);
  const abilityMods: AbilityRecord = {
    str: computeAbilityMod(finalAbilities.str),
    dex: computeAbilityMod(finalAbilities.dex),
    con: computeAbilityMod(finalAbilities.con),
    int: computeAbilityMod(finalAbilities.int),
    wis: computeAbilityMod(finalAbilities.wis),
    cha: computeAbilityMod(finalAbilities.cha)
  };
  const proficiencyBonus = computeProfBonus(level);

  const species = state.selectedSpeciesId
    ? merged.speciesById[state.selectedSpeciesId]
    : undefined;
  const background = state.selectedBackgroundId
    ? merged.backgroundsById[state.selectedBackgroundId]
    : undefined;
  const klass: Class | undefined = state.selectedClassId
    ? merged.classesById[state.selectedClassId]
    : undefined;
  const features = resolveSelectedFeatures(state, merged);
  const advancementFeatIds = [...advancementsByLevel.values()]
    .filter(
      (entry): entry is Extract<Advancement, { type: "feat" }> =>
        entry.type === "feat"
    )
    .map((entry) => entry.featId);
  const feats = resolveSelectedFeats(state, merged, advancementFeatIds);

  const effects: Effect[] = [
    ...(species?.effects ?? []),
    ...(background?.effects ?? []),
    ...(klass?.effects ?? []),
    ...features.flatMap((feature) => feature.effects ?? []),
    ...feats.flatMap((feat) => feat.effects ?? [])
  ];

  const applied = applyEffectsToCharacter(state, effects);

  const skillProficiencies = dedupe([
    ...(state.chosenSkillProficiencies ?? []),
    ...applied.grantedSkillProficiencies
  ]);
  const saveProficiencies = dedupe([
    ...(state.chosenSaveProficiencies ?? []),
    ...applied.grantedSaveProficiencies
  ]);
  const toolProficiencies = dedupe([
    ...(state.toolProficiencies ?? []),
    ...applied.grantedToolProficiencies
  ]);

  const skills: Record<string, number> = {};
  for (const skill of STANDARD_SKILLS) {
    const ability = SKILL_TO_ABILITY[skill] ?? "wis";
    const bonus = getBonusTotal(applied.bonuses, "skill", skill);
    const proficient = skillProficiencies.includes(skill);
    skills[skill] = abilityMods[ability] + (proficient ? proficiencyBonus : 0) + bonus;
  }

  const savingThrows: AbilityRecord = {
    str:
      abilityMods.str +
      (saveProficiencies.includes("str") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "str"),
    dex:
      abilityMods.dex +
      (saveProficiencies.includes("dex") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "dex"),
    con:
      abilityMods.con +
      (saveProficiencies.includes("con") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "con"),
    int:
      abilityMods.int +
      (saveProficiencies.includes("int") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "int"),
    wis:
      abilityMods.wis +
      (saveProficiencies.includes("wis") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "wis"),
    cha:
      abilityMods.cha +
      (saveProficiencies.includes("cha") ? proficiencyBonus : 0) +
      getBonusTotal(applied.bonuses, "save", "cha")
  };

  const hitDie = klass?.hitDie ?? 8;
  const conMod = abilityMods.con;
  const levelGain = Math.floor(hitDie / 2) + 1 + conMod;
  const maxHP = Math.max(1, hitDie + conMod + (level - 1) * levelGain);

  const armor = state.equippedArmorId
    ? merged.equipmentById[state.equippedArmorId]
    : undefined;
  const shield = state.equippedShieldId
    ? merged.equipmentById[state.equippedShieldId]
    : undefined;
  const weapon = state.equippedWeaponId
    ? merged.equipmentById[state.equippedWeaponId]
    : undefined;

  const dexMod = abilityMods.dex;
  const dexCapEffective =
    typeof armor?.dexCap === "number"
      ? armor.dexCap
      : armor?.type === "armor_heavy"
        ? 0
        : undefined;

  const dexPart =
    typeof dexCapEffective === "number" ? Math.min(dexMod, dexCapEffective) : dexMod;

  let armorClass: number;
  if (typeof armor?.armorClassBase === "number") {
    armorClass = armor.armorClassBase + dexPart;
  } else {
    armorClass = 10 + dexMod;
  }
  if (shield && (shield.type === "shield" || shield.hasShieldBonus === true)) {
    armorClass += 2;
  }

  let attack: DerivedState["attack"] = null;
  if (weapon?.type === "weapon" && weapon.damageDice) {
    const ranged = hasProperty(weapon, "ranged");
    const finesse = hasProperty(weapon, "finesse");
    const attackAbility: Ability = ranged
      ? "dex"
      : finesse
        ? abilityMods.dex >= abilityMods.str
          ? "dex"
          : "str"
        : "str";
    const mod = abilityMods[attackAbility];
    attack = {
      name: weapon.name,
      toHit: mod + proficiencyBonus,
      damage: `${weapon.damageDice}${signed(mod)}`
    };
  }

  const advancementSlots = slotLevels.map((slotLevel) => {
    const advancement = advancementsByLevel.get(slotLevel);
    if (!advancement) {
      return { level: slotLevel, filled: false };
    }
    if (advancement.type === "feat") {
      const feat = merged.featsById[advancement.featId];
      return {
        level: slotLevel,
        filled: true,
        choice: "feat" as const,
        feat: feat
          ? { id: feat.id, name: feat.name }
          : { id: advancement.featId, name: advancement.featId }
      };
    }
    return {
      level: slotLevel,
      filled: true,
      choice: "asi" as const,
      asi: advancement.changes
    };
  });

  return {
    finalAbilities,
    abilityMods,
    proficiencyBonus,
    speed: applied.speedOverride ?? state.baseSpeed ?? 30,
    savingThrows,
    skills,
    toolProficiencies,
    maxHP,
    armorClass,
    attack,
    feats: feats.map((feat) => ({ id: feat.id, name: feat.name })),
    advancementSlots
  };
}
