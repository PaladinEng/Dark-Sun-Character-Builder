import type { Effect } from "@dark-sun/content";

import type { Ability, CharacterState, DerivedSense } from "./types";

export const SUPPORTED_EFFECT_TYPES = [
  "grant_skill_proficiency",
  "grant_save_proficiency",
  "add_bonus",
  "set_speed",
  "add_armor_class_bonus",
  "add_attack_bonus",
  "set_unarmored_defense",
  "grant_sense",
  "grant_resistance",
  "grant_trait",
  "grant_tool_proficiency",
  "grant_language"
] as const;

export interface DerivedBonus {
  target: "skill" | "save";
  key: string;
  value: number;
}

export interface ArmorClassBonus {
  value: number;
  condition: "always" | "wearing_armor" | "unarmored";
}

export interface AttackBonus {
  value: number;
  condition: "always" | "ranged_weapon";
}

export interface AppliedEffects {
  grantedSkillProficiencies: string[];
  grantedSaveProficiencies: Ability[];
  grantedToolProficiencies: string[];
  grantedLanguages: string[];
  senses: DerivedSense[];
  resistances: string[];
  traits: string[];
  bonuses: DerivedBonus[];
  armorClassBonuses: ArmorClassBonus[];
  attackBonuses: AttackBonus[];
  unarmoredDefenseAbility?: Ability;
  speedOverride?: number;
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function applyEffectsToCharacter(
  _state: CharacterState,
  effects: Effect[]
): AppliedEffects {
  const skillProfs: string[] = [];
  const saveProfs: Ability[] = [];
  const toolProfs: string[] = [];
  const languages: string[] = [];
  const senses: DerivedSense[] = [];
  const resistances: string[] = [];
  const traits: string[] = [];
  const bonuses: DerivedBonus[] = [];
  const armorClassBonuses: ArmorClassBonus[] = [];
  const attackBonuses: AttackBonus[] = [];
  let unarmoredDefenseAbility: Ability | undefined;
  let speedOverride: number | undefined;

  for (const effect of effects) {
    if (effect.type === "grant_skill_proficiency") {
      skillProfs.push(effect.skill);
      continue;
    }
    if (effect.type === "grant_save_proficiency") {
      saveProfs.push(effect.ability as Ability);
      continue;
    }
    if (effect.type === "grant_tool_proficiency") {
      toolProfs.push(effect.tool);
      continue;
    }
    if (effect.type === "grant_language") {
      languages.push(effect.language);
      continue;
    }
    if (effect.type === "grant_sense") {
      senses.push(
        typeof effect.range === "number"
          ? { type: effect.sense, range: effect.range }
          : { type: effect.sense }
      );
      continue;
    }
    if (effect.type === "grant_resistance") {
      resistances.push(effect.damageType);
      continue;
    }
    if (effect.type === "grant_trait") {
      traits.push(
        effect.description && effect.description.trim().length > 0
          ? `${effect.name}: ${effect.description}`
          : effect.name
      );
      continue;
    }
    if (effect.type === "add_bonus") {
      bonuses.push({
        target: effect.target,
        key: effect.key,
        value: effect.value
      });
      continue;
    }
    if (effect.type === "add_armor_class_bonus") {
      armorClassBonuses.push({
        value: effect.value,
        condition: effect.condition ?? "always"
      });
      continue;
    }
    if (effect.type === "add_attack_bonus") {
      attackBonuses.push({
        value: effect.value,
        condition: effect.condition ?? "always"
      });
      continue;
    }
    if (effect.type === "set_unarmored_defense") {
      unarmoredDefenseAbility = effect.ability as Ability;
      continue;
    }
    if (effect.type === "set_speed") {
      speedOverride = effect.value;
    }
  }

  return {
    grantedSkillProficiencies: dedupe(skillProfs),
    grantedSaveProficiencies: dedupe(saveProfs),
    grantedToolProficiencies: dedupe(toolProfs),
    grantedLanguages: dedupe(languages),
    senses: dedupe(
      senses.map((sense) =>
        typeof sense.range === "number" ? `${sense.type}|${sense.range}` : `${sense.type}|`
      )
    ).map((senseKey) => {
      const [type, range] = senseKey.split("|");
      if (range.length > 0) {
        return { type, range: Number(range) };
      }
      return { type };
    }),
    resistances: dedupe(resistances),
    traits: dedupe(traits),
    bonuses,
    armorClassBonuses,
    attackBonuses,
    ...(unarmoredDefenseAbility ? { unarmoredDefenseAbility } : {}),
    speedOverride
  };
}
