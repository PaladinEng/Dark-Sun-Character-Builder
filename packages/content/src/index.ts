export type { Ability, Effect } from "./effects";
export { AbilitySchema, EffectSchema } from "./effects";

export type { PackManifest } from "./manifest";
export { PackManifestSchema } from "./manifest";

export type {
  Species,
  Background,
  Class,
  ClassFeatureGrant,
  Feature,
  Feat,
  Equipment,
  WeaponMasteryProperty,
  Spell,
  SpellList
} from "./entities";
export {
  SpeciesSchema,
  BackgroundSchema,
  ClassSchema,
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
  getClassFeatureIdsForLevel
} from "./entities";

export type {
  SeedPack,
  SeedSpecies,
  SeedBackground,
  SeedClass,
  SeedFeature,
  SeedFeat,
  SeedEquipment,
  SeedSpell,
  SeedSpellList
} from "./seed";
export {
  SeedPackSchema,
  SeedSpeciesSchema,
  SeedBackgroundSchema,
  SeedClassSchema,
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
