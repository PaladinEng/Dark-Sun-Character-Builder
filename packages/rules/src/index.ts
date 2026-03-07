export { applyEffectsToCharacter } from "./effects";
export { getFeatOrAsiLevels, getAvailableAdvancementSlots } from "./advancement";
export { generateRulesCoverageReport } from "./coverage";
export {
  STANDARD_ARRAY,
  POINT_BUY_MIN_SCORE,
  POINT_BUY_MAX_SCORE,
  POINT_BUY_BUDGET,
  getPointBuyScoreCost,
  computePointBuyCost,
  isStandardArray
} from "./abilityScoreMethods";
export {
  computeAbilityMod,
  computeProfBonus,
  computeFinalAbilities,
  computeDerivedState,
  isProficientWithWeapon
} from "./compute";
export { getSpellSlots } from "./spellSlots";
export { getSkillAndToolDisplayRows } from "./skills";
export { deriveStartingEquipment } from "./startingEquipment";
export { applyDerivedModifierPipeline } from "./modifiers";
export { validateCharacter } from "./validate";
export { buildPdfExportFromTemplate } from "./pdfExport";
export type {
  Ability,
  AbilityRecord,
  AbilityScoreMethod,
  AbilityIncrease,
  Advancement,
  CharacterState,
  CharacterConditions,
  ConditionId,
  CharacterCoins,
  CompanionPlaceholder,
  DerivedModifier,
  DerivedModifierEffect,
  DerivedStartingEquipment,
  DerivedState,
  InventoryEntry
} from "./types";
export type { ValidationIssue, ValidationReport } from "./validate";
export type { RulesCoverageReport } from "./coverage";
export type { PdfExportError, PdfExportResult } from "./pdfExport";
export type { SkillAndToolDisplayRow } from "./skills";

export function rulesPing(): string {
  return "rules-pong";
}
