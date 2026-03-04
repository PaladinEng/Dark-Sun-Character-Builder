export type { Ability, Effect } from "./effects";
export { AbilitySchema, EffectSchema } from "./effects";

export type { PackManifest } from "./manifest";
export { PackManifestSchema } from "./manifest";

export type {
  Species,
  Background,
  Class,
  Feature,
  Feat,
  Equipment
} from "./entities";
export {
  SpeciesSchema,
  BackgroundSchema,
  ClassSchema,
  FeatureSchema,
  FeatSchema,
  EquipmentSchema,
  EquipmentTypeSchema
} from "./entities";

export type {
  SeedPack,
  SeedSpecies,
  SeedBackground,
  SeedClass,
  SeedFeature,
  SeedFeat,
  SeedEquipment
} from "./seed";
export {
  SeedPackSchema,
  SeedSpeciesSchema,
  SeedBackgroundSchema,
  SeedClassSchema,
  SeedFeatureSchema,
  SeedFeatSchema,
  SeedEquipmentSchema
} from "./seed";

export type { NormalizedEntities } from "./normalize";
export { normalizeSeedPack, slugToId } from "./normalize";

export type { Pack } from "./load";
export { loadPackFromDir } from "./load";

export type { MergeCount, MergeReport, MergedContent } from "./merge";
export { mergePacks } from "./merge";

export type { AttributionBlock } from "./attribution";
export { getAttributionBlocks } from "./attribution";

export function contentPing(): string {
  return "content-pong";
}
