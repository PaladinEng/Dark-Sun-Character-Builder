import { z } from "zod";

import { EffectSchema } from "./effects";

export const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type Ability = z.infer<typeof AbilitySchema>;

const EntityBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  replaces: z.string().optional(),
  effects: z.array(EffectSchema).optional(),
});
export const BaseEntitySchema = EntityBaseSchema;

export const SpeciesSchema = EntityBaseSchema;
export type Species = z.infer<typeof SpeciesSchema>;

export const BackgroundAbilityOptionsSchema = z.object({
  abilities: z.array(AbilitySchema).min(3),
  mode: z.enum(["2+1_or_1+1+1"]),
});

export const BackgroundSchema = EntityBaseSchema.extend({
  abilityOptions: BackgroundAbilityOptionsSchema.optional(),
  grantsFeat: z.string().optional(),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const ClassSchema = EntityBaseSchema.extend({
  hitDie: z.number().int().positive().optional(),
});
export type Class = z.infer<typeof ClassSchema>;

export const FeatureSchema = EntityBaseSchema;
export type Feature = z.infer<typeof FeatureSchema>;

export const FeatSchema = EntityBaseSchema.extend({
  category: z.enum(["origin", "general"]).optional(),
  grantsAbilityIncreases: z.boolean().optional(),
});
export type Feat = z.infer<typeof FeatSchema>;

export const EquipmentTypeSchema = z.enum([
  "armor_light",
  "armor_medium",
  "armor_heavy",
  "shield",
  "weapon",
]);
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

export const EquipmentSchema = EntityBaseSchema.extend({
  type: EquipmentTypeSchema,
  armorClassBase: z.number().int().optional(),
  dexCap: z.number().int().optional(),
  hasShieldBonus: z.boolean().optional(),
  damageDice: z.string().optional(),
  properties: z.array(z.string()).optional(),
  strengthRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;
