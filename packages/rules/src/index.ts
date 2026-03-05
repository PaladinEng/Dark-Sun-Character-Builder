export { applyEffectsToCharacter } from "./effects";
export { getFeatOrAsiLevels, getAvailableAdvancementSlots } from "./advancement";
export { generateRulesCoverageReport } from "./coverage";
export {
  computeAbilityMod,
  computeProfBonus,
  computeFinalAbilities,
  computeDerivedState,
  isProficientWithWeapon
} from "./compute";
export { getSpellSlots } from "./spellSlots";
export { validateCharacter } from "./validate";
export type {
  Ability,
  AbilityRecord,
  AbilityIncrease,
  Advancement,
  CharacterState,
  DerivedState
} from "./types";
export type { ValidationIssue, ValidationReport } from "./validate";
export type { RulesCoverageReport } from "./coverage";

export function rulesPing(): string {
  return "rules-pong";
}
