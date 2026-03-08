import type {
  Class,
  Effect,
  Equipment,
  Feat,
  Feature,
  MergedContent
} from "@dark-sun/content";
import { getClassFeatureIdsForLevel, getSubclassFeatureIdsForLevel, type Subclass } from "@dark-sun/content";

import { getAvailableAdvancementSlots } from "./advancement";
import { applyEffectsToCharacter } from "./effects";
import { applyDerivedModifierPipeline } from "./modifiers";
import { getResolvedSkillDefinitions } from "./skills";
import { deriveStartingEquipment } from "./startingEquipment";
import { getSpellSlots } from "./spellSlots";
import {
  ABILITIES,
  type Ability,
  type AbilityRecord,
  type Advancement,
  type CharacterState,
  type DerivedState,
  type SpellSlots,
  type SpellcastingAbility
} from "./types";

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function dedupeSortedStrings(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sortIds(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [...values].sort((a, b) => a.localeCompare(b));
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

export function isProficientWithWeapon(
  weapon: Equipment,
  klass?: Class
): boolean {
  if (weapon.type !== "weapon") {
    return false;
  }

  const proficiencies = klass?.weaponProficiencies;
  if (!proficiencies) {
    return false;
  }

  if (proficiencies.weaponIds?.includes(weapon.id)) {
    return true;
  }

  if (weapon.weaponCategory === "simple" && proficiencies.simple) {
    return true;
  }

  if (weapon.weaponCategory === "martial" && proficiencies.martial) {
    return true;
  }

  return false;
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

function resolveSelectedFeatures(
  state: CharacterState,
  merged: MergedContent
): Feature[] {
  const selectedIds = dedupe([
    ...(state.selectedFeatureIds ?? []),
    ...(state.warlockInvocationFeatureIds ?? []),
    ...(state.warlockPactBoonFeatureId ? [state.warlockPactBoonFeatureId] : [])
  ]);
  return selectedIds
    .map((id) => merged.featuresById[id])
    .filter((feature): feature is Feature => Boolean(feature));
}

function getWarlockMysticArcanumTraits(
  state: CharacterState,
  merged: MergedContent
): string[] {
  const raw = state.warlockMysticArcanumByLevel;
  if (!raw) {
    return [];
  }

  const entries: Array<[number, string]> = [];
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    const tier = Number(key);
    if (!Number.isInteger(tier) || tier < 6 || tier > 9) {
      continue;
    }
    entries.push([tier, value]);
  }

  entries.sort((a, b) => a[0] - b[0]);
  return entries.map(([tier, spellId]) => {
    const spell = merged.spellsById[spellId];
    const spellName = spell?.name ?? spellId;
    return `Mystic Arcanum (${tier}th): ${spellName}`;
  });
}

function resolveClassFeatures(
  klass: Class | undefined,
  level: number,
  merged: MergedContent
): Feature[] {
  if (!klass) {
    return [];
  }

  return getClassFeatureIdsForLevel(klass, level)
    .map((id) => merged.featuresById[id])
    .filter((feature): feature is Feature => Boolean(feature));
}

function resolveSelectedSubclass(
  state: CharacterState,
  klass: Class | undefined,
  merged: MergedContent
): Subclass | undefined {
  if (!state.subclass) {
    return undefined;
  }
  const subclass = merged.subclassesById?.[state.subclass];
  if (!subclass || !klass) {
    return undefined;
  }
  return subclass.classId === klass.id ? subclass : undefined;
}

function resolveSubclassFeatures(
  subclass: Subclass | undefined,
  level: number,
  merged: MergedContent
): Feature[] {
  if (!subclass) {
    return [];
  }

  return getSubclassFeatureIdsForLevel(subclass, level)
    .map((id) => merged.featuresById[id])
    .filter((feature): feature is Feature => Boolean(feature));
}

function resolveSelectedFeats(
  state: CharacterState,
  merged: MergedContent,
  levelFeatIds: string[]
): Feat[] {
  const background = state.selectedBackgroundId
    ? merged.backgroundsById[state.selectedBackgroundId]
    : undefined;
  const fixedOriginFeatId = background?.grantsOriginFeatId ?? background?.grantsFeat;
  const chosenOriginFeatId = background?.originFeatChoice
    ? state.featSelections?.origin ?? state.originFeatId
    : undefined;
  const candidateOriginFeatId = fixedOriginFeatId ?? chosenOriginFeatId;
  const candidateOriginFeat = candidateOriginFeatId
    ? merged.featsById[candidateOriginFeatId]
    : undefined;
  const resolvedOriginFeatId =
    candidateOriginFeat?.category === "origin"
      ? candidateOriginFeat.id
      : undefined;

  // Deterministic ordering: origin feat first, then level-slot feats (ascending level),
  // then any legacy free-form selected feats.
  const allIds = dedupe([
    ...(resolvedOriginFeatId ? [resolvedOriginFeatId] : []),
    ...levelFeatIds,
    ...(state.selectedFeats ?? [])
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

  const levelFeatSelections = state.featSelections?.level ?? {};
  const selectedFeatByLevel = new Map<number, string>();
  for (const [rawLevel, featId] of Object.entries(levelFeatSelections)) {
    const parsedLevel = Number(rawLevel);
    if (!Number.isFinite(parsedLevel) || !set.has(parsedLevel)) {
      continue;
    }
    if (typeof featId !== "string" || featId.length === 0) {
      continue;
    }
    selectedFeatByLevel.set(parsedLevel, featId);
  }

  for (const advancement of state.advancements ?? []) {
    if (advancement.source !== "level") continue;
    if (!set.has(advancement.level)) continue;
    if (advancement.type === "feat" && selectedFeatByLevel.has(advancement.level)) {
      continue;
    }
    byLevel.set(advancement.level, advancement);
  }

  for (const [slotLevel, featId] of selectedFeatByLevel.entries()) {
    byLevel.set(slotLevel, {
      type: "feat",
      featId,
      source: "level",
      level: slotLevel
    });
  }

  return byLevel;
}

export function computeDerivedState(
  state: CharacterState,
  merged: MergedContent
): DerivedState {
  const warnings: string[] = [];
  const level = Math.max(1, Math.floor(state.level || 1));
  const slotLevels = getAvailableAdvancementSlots(level, state.selectedClassId);
  const advancementsByLevel = getLevelAdvancements(state, slotLevels);
  const startingEquipment = deriveStartingEquipment(state, merged);

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
  const subclass = resolveSelectedSubclass(state, klass, merged);
  const features = resolveSelectedFeatures(state, merged);
  const classFeatures = resolveClassFeatures(klass, level, merged);
  const subclassFeatures = resolveSubclassFeatures(subclass, level, merged);
  const levelFeatIds = [...advancementsByLevel.entries()]
    .filter(
      (entry): entry is [number, Extract<Advancement, { type: "feat" }>] =>
        entry[1].type === "feat"
    )
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1].featId);
  const feats = resolveSelectedFeats(state, merged, levelFeatIds);

  const speciesEffects = species?.effects ?? [];

  const effects: Effect[] = [
    ...speciesEffects,
    ...(background?.effects ?? []),
    ...(klass?.effects ?? []),
    ...(subclass?.effects ?? []),
    ...(subclass?.passiveModifiers ?? []),
    ...classFeatures.flatMap((feature) => feature.effects ?? []),
    ...subclassFeatures.flatMap((feature) => feature.effects ?? []),
    ...features.flatMap((feature) => feature.effects ?? []),
    ...feats.flatMap((feat) => feat.effects ?? [])
  ];

  const speciesApplied = applyEffectsToCharacter(state, speciesEffects);
  const applied = applyEffectsToCharacter(state, effects);

  const speciesBaselineSpeed = state.baseSpeed ?? 30;
  const speciesSpeedOverride = speciesApplied.speedOverride;
  const speedTraits =
    typeof speciesSpeedOverride === "number" &&
    speciesSpeedOverride !== speciesBaselineSpeed
      ? [`Speed ${speciesSpeedOverride} ft.`]
      : [];
  const senses = speciesApplied.senses;
  const resistances = speciesApplied.resistances;
  const mysticArcanumTraits = getWarlockMysticArcanumTraits(state, merged);
  const traits = dedupe([...speedTraits, ...applied.traits, ...mysticArcanumTraits]);

  const skillProficiencies = dedupe([
    ...(state.chosenSkillProficiencies ?? []),
    ...applied.grantedSkillProficiencies
  ]);
  const chosenClassSkills = dedupe(state.chosenClassSkills ?? []);
  const classSkillsTouched = state.touched?.classSkills === true;
  if (klass?.classSkillChoices) {
    const classSkillChoices = klass.classSkillChoices;
    const allowed = new Set(classSkillChoices.from);
    const invalidChoices = chosenClassSkills.filter((skill) => !allowed.has(skill));
    if (invalidChoices.length > 0) {
      warnings.push(
        `Invalid class skill selections for ${klass.name}: ${invalidChoices.join(", ")}`
      );
    }

    const validChoices = chosenClassSkills.filter((skill) => allowed.has(skill));
    if (classSkillsTouched && validChoices.length !== classSkillChoices.count) {
      warnings.push(
        `Class skill selections incomplete for ${klass.name}: expected ${classSkillChoices.count}, got ${validChoices.length}`
      );
    }

    skillProficiencies.push(...validChoices.slice(0, classSkillChoices.count));
  }
  const finalSkillProficiencies = dedupe(skillProficiencies);
  const saveProficiencies = dedupe([
    ...(state.chosenSaveProficiencies ?? []),
    ...applied.grantedSaveProficiencies
  ]);
  const toolProficiencies = dedupeSortedStrings([
    ...(state.toolProficiencies ?? []),
    ...applied.grantedToolProficiencies
  ]);
  const languages = dedupeSortedStrings([
    ...(state.languages ?? []),
    ...applied.grantedLanguages
  ]);

  const skillDefinitions = getResolvedSkillDefinitions(merged);
  const skills: Record<string, number> = {};
  for (const skill of skillDefinitions) {
    const bonus = getBonusTotal(applied.bonuses, "skill", skill.id);
    const proficient = finalSkillProficiencies.includes(skill.id);
    skills[skill.id] = abilityMods[skill.ability] + (proficient ? proficiencyBonus : 0) + bonus;
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
  const armorClassBase = typeof armor?.armorClassBase === "number" ? armor.armorClassBase : null;
  const hasEquippedArmor = armorClassBase !== null;
  if (hasEquippedArmor) {
    armorClass = armorClassBase + dexPart;
  } else {
    armorClass = 10 + dexMod;
    if (applied.unarmoredDefenseAbility) {
      const unarmoredDefense = 10 + dexMod + abilityMods[applied.unarmoredDefenseAbility];
      armorClass = Math.max(armorClass, unarmoredDefense);
    }
  }
  const armorClassBonus = applied.armorClassBonuses
    .filter((bonus) => {
      if (bonus.condition === "wearing_armor") {
        return hasEquippedArmor;
      }
      if (bonus.condition === "unarmored") {
        return !hasEquippedArmor;
      }
      return true;
    })
    .reduce((sum, bonus) => sum + bonus.value, 0);
  armorClass += armorClassBonus;
  if (shield && (shield.type === "shield" || shield.hasShieldBonus === true)) {
    armorClass += 2;
  }

  let attack: DerivedState["attack"] = null;
  if (weapon?.type === "weapon" && weapon.damageDice) {
    if (!weapon.weaponCategory) {
      warnings.push(
        `Weapon category missing for ${weapon.name}; proficiency cannot be inferred from simple/martial rules`
      );
    }

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
    const proficientWithWeapon = isProficientWithWeapon(weapon, klass);
    const attackBonus = applied.attackBonuses
      .filter((bonus) => {
        if (bonus.condition === "ranged_weapon") {
          return ranged;
        }
        return true;
      })
      .reduce((sum, bonus) => sum + bonus.value, 0);
    if (!proficientWithWeapon) {
      warnings.push(
        `Attack with ${weapon.name} is not proficient; proficiency bonus not applied`
      );
    }
    attack = {
      name: weapon.name,
      toHit: mod + (proficientWithWeapon ? proficiencyBonus : 0) + attackBonus,
      damage: `${weapon.damageDice}${signed(mod)}`,
      ...(weapon.masteryProperties && weapon.masteryProperties.length > 0
        ? { mastery: [...weapon.masteryProperties] }
        : {})
    };
  }

  let spellcastingAbility: SpellcastingAbility | null = null;
  let spellSaveDC: number | null = null;
  let spellAttackBonus: number | null = null;
  let spellSlots: SpellSlots | null = null;
  const knownSpellIds = sortIds(state.knownSpellIds);
  const preparedSpellIds = sortIds(state.preparedSpellIds);
  const cantripsKnownIds = sortIds(state.cantripsKnownIds);

  const spellcastingConfig = subclass?.spellcasting ?? klass?.spellcasting;
  const spellcasting = spellcastingConfig
    ? (() => {
        const spellAbility = spellcastingConfig.ability;
        const abilityMod = abilityMods[spellAbility];
        const slots = getSpellSlots(level, spellcastingConfig.progression);
        const saveDC = 8 + proficiencyBonus + abilityMod;
        const attackBonus = proficiencyBonus + abilityMod;

        spellcastingAbility = spellAbility;
        spellSaveDC = saveDC;
        spellAttackBonus = attackBonus;
        spellSlots = slots;

        return {
          ability: spellAbility,
          abilityMod,
          saveDC,
          attackBonus,
          progression: spellcastingConfig.progression,
          slots,
          knownSpellIds,
          preparedSpellIds,
          cantripsKnownIds
        };
      })()
    : undefined;

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

  const baseDerived: DerivedState = {
    finalAbilities,
    abilityMods,
    proficiencyBonus,
    speed: applied.speedOverride ?? state.baseSpeed ?? 30,
    senses,
    resistances,
    traits,
    savingThrows,
    skills,
    skillProficiencies: finalSkillProficiencies,
    saveProficiencies,
    toolProficiencies,
    languages,
    passivePerception: 10 + (skills.perception ?? 0),
    maxHP,
    armorClass,
    attack,
    spellcastingAbility,
    spellSaveDC,
    spellAttackBonus,
    spellSlots,
    spellcasting,
    feats: feats.map((feat) => ({ id: feat.id, name: feat.name })),
    warnings: dedupe(warnings),
    ...(startingEquipment ? { startingEquipment } : {}),
    advancementSlots
  };

  return applyDerivedModifierPipeline(baseDerived, state);
}
