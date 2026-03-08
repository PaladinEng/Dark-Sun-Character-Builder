export type { Ability, Effect } from "./effects";
export { AbilitySchema, EffectSchema } from "./effects";

export type { PackManifest } from "./manifest";
export { PackManifestSchema } from "./manifest";

export type {
  Species,
  Background,
  Class,
  Subclass,
  Spellcasting,
  ClassFeatureGrant,
  Feature,
  Skill,
  SkillDefinition,
  Feat,
  Equipment,
  WeaponMasteryProperty,
  Spell,
  SpellList
} from "./entities";
export {
  SkillSchema,
  SkillDefinitionSchema,
  SpeciesSchema,
  BackgroundSchema,
  ClassSchema,
  SubclassSchema,
  FeatureSchema,
  FeatSchema,
  EquipmentSchema,
  EquipmentTypeSchema,
  WeaponMasteryPropertySchema,
  SpellSchema,
  SpellListSchema,
  SpellSchoolSchema,
  SpellComponentSchema,
  getClassSpellListRefIds,
  getClassFeatureIdsForLevel,
  getSubclassSpellListRefIds,
  getSubclassFeatureIdsForLevel
} from "./entities";

export type {
  SeedPack,
  SeedSpecies,
  SeedSkill,
  SeedSkillDefinition,
  SeedBackground,
  SeedClass,
  SeedSubclass,
  SeedSpellcasting,
  SeedFeature,
  SeedFeat,
  SeedEquipment,
  SeedSpell,
  SeedSpellList
} from "./seed";
export {
  SeedPackSchema,
  SeedSpeciesSchema,
  SeedSkillSchema,
  SeedSkillDefinitionSchema,
  SeedBackgroundSchema,
  SeedClassSchema,
  SeedSubclassSchema,
  SeedSpellcastingSchema,
  SeedFeatureSchema,
  SeedFeatSchema,
  SeedEquipmentSchema,
  SeedSpellSchema,
  SeedSpellListSchema
} from "./seed";

export type { NormalizedEntities } from "./normalize";
export { normalizeSeedPack, slugToId } from "./normalize";

export type {
  MergeCount,
  MergeReport,
  MergedContent,
  MergeProvenance,
  EntityProvenance,
  ProvenanceLineageStep
} from "./merge";
export { mergePacks, mergePacksWithProvenance } from "./merge";

export type { ContentLintIssue, ContentLintReport } from "./lint";
export { lintPacks } from "./lint";

export type { AttributionBlock } from "./attribution";
export { getAttributionBlocks } from "./attribution";

export function contentPing(): string {
  return "content-pong";
}
