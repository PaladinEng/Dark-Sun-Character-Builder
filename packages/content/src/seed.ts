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
  grantsOriginFeatId: z.string().optional(),
  originFeatChoice: z
    .object({
      featIds: z.array(z.string()).min(1).optional(),
    })
    .optional(),
}).superRefine((value, ctx) => {
  const fixedOrigin = value.grantsOriginFeatId ?? value.grantsFeat;
  if (fixedOrigin && value.originFeatChoice) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Background cannot define both grantsFeat and originFeatChoice.",
      path: ["originFeatChoice"],
    });
  }
  if (value.grantsOriginFeatId && value.grantsFeat && value.grantsOriginFeatId !== value.grantsFeat) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Background grantsOriginFeatId and grantsFeat must match when both are provided.",
      path: ["grantsOriginFeatId"],
    });
  }
});
export type SeedBackground = z.infer<typeof SeedBackgroundSchema>;

export const SeedClassSchema = SeedBaseSchema.extend({
  hitDie: z.number().int().positive().optional(),
  classSkillChoices: z
    .object({
      count: z.number().int().positive(),
      from: z.array(z.string()).min(1),
    })
    .optional(),
  weaponProficiencies: z
    .object({
      simple: z.boolean().optional(),
      martial: z.boolean().optional(),
      weaponIds: z.array(z.string()).optional(),
    })
    .optional(),
  spellcasting: z
    .object({
      ability: AbilitySchema,
      progression: z.enum(["full", "half", "third", "pact"]),
      mode: z.enum(["prepared", "known"]).optional(),
    })
    .optional(),
  spellListRefs: z.array(z.string()).optional(),
});
export type SeedClass = z.infer<typeof SeedClassSchema>;

export const SeedFeatureSchema = SeedBaseSchema;
export type SeedFeature = z.infer<typeof SeedFeatureSchema>;

export const SeedFeatSchema = SeedBaseSchema.extend({
  category: z.enum(["origin", "general"]).optional(),
  repeatable: z.boolean().optional(),
  prerequisites: z
    .object({
      minLevel: z.number().int().positive().optional(),
      abilities: z
        .object({
          str: z.number().int().min(1).max(30).optional(),
          dex: z.number().int().min(1).max(30).optional(),
          con: z.number().int().min(1).max(30).optional(),
          int: z.number().int().min(1).max(30).optional(),
          wis: z.number().int().min(1).max(30).optional(),
          cha: z.number().int().min(1).max(30).optional(),
        })
        .optional(),
      classIds: z.array(z.string()).min(1).optional(),
      speciesIds: z.array(z.string()).min(1).optional(),
    })
    .optional(),
});
export type SeedFeat = z.infer<typeof SeedFeatSchema>;

export const SeedEquipmentSchema = SeedBaseSchema.extend({
  type: z.enum(["armor", "shield", "weapon"]),
  armorCategory: z.enum(["light", "medium", "heavy"]).optional(),
  armorClassBase: z.number().int().optional(),
  dexCap: z.number().int().optional(),
  hasShieldBonus: z.boolean().optional(),
  damageDice: z.string().optional(),
  weaponCategory: z.enum(["simple", "martial"]).optional(),
  properties: z.array(z.string()).optional(),
  strengthRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean().optional(),
});
export type SeedEquipment = z.infer<typeof SeedEquipmentSchema>;

export const SeedSpellSchema = SeedBaseSchema.extend({
  level: z.number().int().min(0).max(9),
  school: z.enum([
    "abjuration",
    "conjuration",
    "divination",
    "enchantment",
    "evocation",
    "illusion",
    "necromancy",
    "transmutation",
  ]),
  ritual: z.boolean().optional(),
  castingTime: z.string(),
  range: z.string(),
  components: z.array(z.enum(["V", "S", "M"])).min(1),
  duration: z.string(),
  concentration: z.boolean().optional(),
  summary: z.string().optional(),
});
export type SeedSpell = z.infer<typeof SeedSpellSchema>;

export const SeedSpellListSchema = SeedBaseSchema.extend({
  spellIds: z.array(z.string()).min(1),
});
export type SeedSpellList = z.infer<typeof SeedSpellListSchema>;

export const SeedPackSchema = z.object({
  species: z.array(SeedSpeciesSchema).optional(),
  backgrounds: z.array(SeedBackgroundSchema).optional(),
  classes: z.array(SeedClassSchema).optional(),
  features: z.array(SeedFeatureSchema).optional(),
  feats: z.array(SeedFeatSchema).optional(),
  equipment: z.array(SeedEquipmentSchema).optional(),
  spells: z.array(SeedSpellSchema).optional(),
  spellLists: z.array(SeedSpellListSchema).optional(),
});
export type SeedPack = z.infer<typeof SeedPackSchema>;

export const AbilityScoresSchema = z.record(AbilitySchema, z.number().int());
