export { applyEffectsToCharacter } from "./effects";
export { getFeatOrAsiLevels, getAvailableAdvancementSlots } from "./advancement";
export { generateRulesCoverageReport } from "./coverage";
export {
  computeAbilityMod,
  computeProfBonus,
  computeFinalAbilities,
  computeDerivedState
} from "./compute";
export type {
  Ability,
  AbilityRecord,
  AbilityIncrease,
  Advancement,
  CharacterState,
  DerivedState
} from "./types";
export type { RulesCoverageReport } from "./coverage";

export function rulesPing(): string {
  return "rules-pong";
}
