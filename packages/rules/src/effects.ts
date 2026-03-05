import type { Effect } from "@dark-sun/content";

import type { Ability, CharacterState } from "./types";

export const SUPPORTED_EFFECT_TYPES = [
  "grant_skill_proficiency",
  "grant_save_proficiency",
  "add_bonus",
  "set_speed",
  "grant_tool_proficiency",
  "grant_language"
] as const;

export interface DerivedBonus {
  target: "skill" | "save";
  key: string;
  value: number;
}

export interface AppliedEffects {
  grantedSkillProficiencies: string[];
  grantedSaveProficiencies: Ability[];
  grantedToolProficiencies: string[];
  grantedLanguages: string[];
  bonuses: DerivedBonus[];
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
  const bonuses: DerivedBonus[] = [];
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
    if (effect.type === "add_bonus") {
      bonuses.push({
        target: effect.target,
        key: effect.key,
        value: effect.value
      });
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
    bonuses,
    speedOverride
  };
}
