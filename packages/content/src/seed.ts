import { z } from "zod";

import { AbilitySchema, BackgroundAbilityOptionsSchema } from "./entities";
import { EffectSchema } from "./effects";

export const SeedBaseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string().optional(),
  effects: z.array(EffectSchema).optional(),
});
export type SeedBase = z.infer<typeof SeedBaseSchema>;

export const SeedSpeciesSchema = SeedBaseSchema;
export type SeedSpecies = z.infer<typeof SeedSpeciesSchema>;

export const SeedBackgroundSchema = SeedBaseSchema.extend({
  abilityOptions: BackgroundAbilityOptionsSchema.optional(),
  grantsFeat: z.string().optional(),
});
export type SeedBackground = z.infer<typeof SeedBackgroundSchema>;

export const SeedClassSchema = SeedBaseSchema.extend({
  hitDie: z.number().int().positive().optional(),
});
export type SeedClass = z.infer<typeof SeedClassSchema>;

export const SeedFeatureSchema = SeedBaseSchema;
export type SeedFeature = z.infer<typeof SeedFeatureSchema>;

export const SeedFeatSchema = SeedBaseSchema;
export type SeedFeat = SeedBase;

export const SeedEquipmentSchema = SeedBaseSchema.extend({
  type: z.enum(["armor", "shield", "weapon"]),
  armorCategory: z.enum(["light", "medium", "heavy"]).optional(),
  armorClassBase: z.number().int().optional(),
  dexCap: z.number().int().optional(),
  hasShieldBonus: z.boolean().optional(),
  damageDice: z.string().optional(),
  properties: z.array(z.string()).optional(),
  strengthRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean().optional(),
});
export type SeedEquipment = z.infer<typeof SeedEquipmentSchema>;

export const SeedPackSchema = z.object({
  species: z.array(SeedSpeciesSchema).optional(),
  backgrounds: z.array(SeedBackgroundSchema).optional(),
  classes: z.array(SeedClassSchema).optional(),
  features: z.array(SeedFeatureSchema).optional(),
  feats: z.array(SeedFeatSchema).optional(),
  equipment: z.array(SeedEquipmentSchema).optional(),
});
export type SeedPack = z.infer<typeof SeedPackSchema>;

export const AbilityScoresSchema = z.record(AbilitySchema, z.number().int());
