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
export type Background = z.infer<typeof BackgroundSchema>;

export const ClassSchema = EntityBaseSchema.extend({
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
export type Class = z.infer<typeof ClassSchema>;

export const FeatureSchema = EntityBaseSchema;
export type Feature = z.infer<typeof FeatureSchema>;

export const FeatSchema = EntityBaseSchema.extend({
  category: z.enum(["origin", "general"]).optional(),
  grantsAbilityIncreases: z.boolean().optional(),
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
  weaponCategory: z.enum(["simple", "martial"]).optional(),
  properties: z.array(z.string()).optional(),
  strengthRequirement: z.number().int().optional(),
  stealthDisadvantage: z.boolean().optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const SpellSchoolSchema = z.enum([
  "abjuration",
  "conjuration",
  "divination",
  "enchantment",
  "evocation",
  "illusion",
  "necromancy",
  "transmutation",
]);
export type SpellSchool = z.infer<typeof SpellSchoolSchema>;

export const SpellComponentSchema = z.enum(["V", "S", "M"]);
export type SpellComponent = z.infer<typeof SpellComponentSchema>;

export const SpellSchema = EntityBaseSchema.extend({
  level: z.number().int().min(0).max(9),
  school: SpellSchoolSchema,
  ritual: z.boolean().optional(),
  castingTime: z.string(),
  range: z.string(),
  components: z.array(SpellComponentSchema).min(1),
  duration: z.string(),
  concentration: z.boolean().optional(),
  summary: z.string().optional(),
});
export type Spell = z.infer<typeof SpellSchema>;

export const SpellListSchema = EntityBaseSchema.extend({
  spellIds: z.array(z.string()).min(1),
});
export type SpellList = z.infer<typeof SpellListSchema>;
