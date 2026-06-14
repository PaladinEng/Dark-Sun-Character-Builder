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
  "grant_language",
  "grant_natural_weapon",
  "grant_weapon_mastery",
  "add_speed_bonus",
  "add_hp_per_level",
  "grant_skill_expertise",
  "grant_movement_speed"
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

export interface NaturalWeapon {
  name: string;
  damageDice: string;
  damageType: string;
  ability?: Ability;
}

export interface AppliedEffects {
  grantedSkillProficiencies: string[];
  /** Skills granted expertise (proficiency bonus doubled) via a fixed-skill effect. */
  grantedSkillExpertise: string[];
  grantedSaveProficiencies: Ability[];
  grantedToolProficiencies: string[];
  grantedLanguages: string[];
  senses: DerivedSense[];
  resistances: string[];
  traits: string[];
  bonuses: DerivedBonus[];
  armorClassBonuses: ArmorClassBonus[];
  attackBonuses: AttackBonus[];
  naturalWeapons: NaturalWeapon[];
  unarmoredDefenseAbility?: Ability;
  speedOverride?: number;
  /** Maximum number of weapons that can have mastery applied (take highest). */
  weaponMasteryLimit: number;
  /** Additive speed bonus (e.g. Mobile +10). */
  speedBonus: number;
  /** Extra HP per character level (e.g. Tough +2). */
  hpPerLevel: number;
  /** Non-walking movement speed grants, resolved against walking speed in compute. */
  movementSpeedGrants: Array<{
    movement: "climb" | "swim" | "fly" | "burrow";
    matchWalking?: boolean;
    value?: number;
  }>;
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function applyEffectsToCharacter(
  _state: CharacterState,
  effects: Effect[]
): AppliedEffects {
  const skillProfs: string[] = [];
  const skillExpertise: string[] = [];
  const saveProfs: Ability[] = [];
  const toolProfs: string[] = [];
  const languages: string[] = [];
  const senses: DerivedSense[] = [];
  const resistances: string[] = [];
  const traits: string[] = [];
  const bonuses: DerivedBonus[] = [];
  const armorClassBonuses: ArmorClassBonus[] = [];
  const attackBonuses: AttackBonus[] = [];
  const naturalWeapons: NaturalWeapon[] = [];
  let unarmoredDefenseAbility: Ability | undefined;
  let speedOverride: number | undefined;
  let weaponMasteryLimit = 0;
  let speedBonus = 0;
  let hpPerLevel = 0;
  const movementSpeedGrants: AppliedEffects["movementSpeedGrants"] = [];

  for (const effect of effects) {
    if (effect.type === "grant_skill_proficiency") {
      skillProfs.push(effect.skill);
      continue;
    }
    if (effect.type === "grant_skill_expertise") {
      // Choice-based expertise is resolved in compute() with feature context;
      // here we only capture fixed-skill expertise grants.
      if (effect.skill) {
        skillExpertise.push(effect.skill);
      }
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
    if (effect.type === "grant_natural_weapon") {
      naturalWeapons.push({
        name: effect.name,
        damageDice: effect.damageDice,
        damageType: effect.damageType,
        ...(effect.ability ? { ability: effect.ability as Ability } : {}),
      });
      continue;
    }
    if (effect.type === "set_speed") {
      speedOverride = effect.value;
      continue;
    }
    if (effect.type === "grant_weapon_mastery") {
      weaponMasteryLimit = Math.max(weaponMasteryLimit, effect.count);
      continue;
    }
    if (effect.type === "add_speed_bonus") {
      speedBonus += effect.value;
      continue;
    }
    if (effect.type === "add_hp_per_level") {
      hpPerLevel += effect.value;
      continue;
    }
    if (effect.type === "grant_movement_speed") {
      movementSpeedGrants.push({
        movement: effect.movement,
        ...(effect.matchWalking ? { matchWalking: true } : {}),
        ...(typeof effect.value === "number" ? { value: effect.value } : {}),
      });
    }
  }

  return {
    grantedSkillProficiencies: dedupe(skillProfs),
    grantedSkillExpertise: dedupe(skillExpertise),
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
    naturalWeapons,
    ...(unarmoredDefenseAbility ? { unarmoredDefenseAbility } : {}),
    speedOverride,
    weaponMasteryLimit,
    speedBonus,
    hpPerLevel,
    movementSpeedGrants
  };
}
