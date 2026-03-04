import type { Ability } from "./types";

export const SKILL_TO_ABILITY: Record<string, Ability> = {
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

export const STANDARD_SKILLS = Object.keys(SKILL_TO_ABILITY);

function normalizeSkillKey(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, "_");
}

export function getSkillAbility(skill: string): Ability {
  const normalized = normalizeSkillKey(skill);
  return SKILL_TO_ABILITY[normalized] ?? "wis";
}

export function normalizeSkill(skill: string): string {
  return normalizeSkillKey(skill);
}
