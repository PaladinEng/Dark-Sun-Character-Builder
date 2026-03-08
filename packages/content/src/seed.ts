import { z } from "zod";

import {
  AbilitySchema,
  BackgroundAbilityOptionsSchema,
  StartingEquipmentBundleSchema,
  WeaponMasteryPropertySchema,
} from "./entities";
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

export const SeedSkillSchema = SeedBaseSchema.extend({
  ability: AbilitySchema,
  sortOrder: z.number().int().optional(),
});
export type SeedSkill = z.infer<typeof SeedSkillSchema>;
export const SeedSkillDefinitionSchema = SeedSkillSchema;
export type SeedSkillDefinition = SeedSkill;

export const SeedBackgroundSchema = SeedBaseSchema.extend({
  abilityOptions: BackgroundAbilityOptionsSchema.optional(),
  grantsFeat: z.string().optional(),
  grantsOriginFeatId: z.string().optional(),
  startingEquipment: StartingEquipmentBundleSchema.optional(),
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

const SeedSpellSelectionLimitByLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  known: z.number().int().min(0).optional(),
  prepared: z.number().int().min(0).optional(),
  cantripsKnown: z.number().int().min(0).optional(),
});

const SeedInvocationSelectionLimitByLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  max: z.number().int().min(0),
});

const SeedClassFeatureGrantSchema = z.object({
  level: z.number().int().min(1).max(20),
  featureId: z.string().min(1),
});

const SeedClassFeaturesByLevelSchema = z
  .array(SeedClassFeatureGrantSchema)
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const entry of value) {
      const key = `${entry.level}|${entry.featureId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate seed class feature entry at level ${entry.level}: ${entry.featureId}.`,
          path: ["classFeaturesByLevel"],
        });
      }
      seen.add(key);
    }
  });

const SeedSpellSelectionLimitsByLevelSchema = z
  .array(SeedSpellSelectionLimitByLevelSchema)
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    for (const entry of value) {
      if (seen.has(entry.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate seed spellcasting selection limit level: ${entry.level}.`,
          path: ["level"],
        });
      }
      seen.add(entry.level);
    }
  });

const SeedInvocationSelectionLimitsByLevelSchema = z
  .array(SeedInvocationSelectionLimitByLevelSchema)
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    for (const entry of value) {
      if (seen.has(entry.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate seed invocation selection limit level: ${entry.level}.`,
          path: ["level"],
        });
      }
      seen.add(entry.level);
    }
  });

export const SeedSpellcastingSchema = z.object({
  ability: AbilitySchema,
  progression: z.enum(["full", "half", "third", "pact"]),
  mode: z.enum(["prepared", "known"]).optional(),
  selectionLimitsByLevel: SeedSpellSelectionLimitsByLevelSchema.optional(),
});
export type SeedSpellcasting = z.infer<typeof SeedSpellcastingSchema>;

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
  spellcasting: SeedSpellcastingSchema.optional(),
  invocationSelectionLimitsByLevel: SeedInvocationSelectionLimitsByLevelSchema.optional(),
  spellListRefIds: z.array(z.string()).optional(),
  spellListRefs: z.array(z.string()).optional(),
  classFeaturesByLevel: SeedClassFeaturesByLevelSchema.optional(),
  startingEquipment: StartingEquipmentBundleSchema.optional(),
}).superRefine((value, ctx) => {
  if (
    value.spellListRefIds &&
    value.spellListRefs &&
    JSON.stringify(value.spellListRefIds) !== JSON.stringify(value.spellListRefs)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Seed class spellListRefIds and legacy spellListRefs must match when both are provided.",
      path: ["spellListRefIds"],
    });
  }
});
export type SeedClass = z.infer<typeof SeedClassSchema>;

export const SeedSubclassSchema = SeedBaseSchema.extend({
  classId: z.string().min(1),
  subclassFeaturesByLevel: SeedClassFeaturesByLevelSchema,
  spellcasting: SeedSpellcastingSchema.optional(),
  spellListRefIds: z.array(z.string()).optional(),
  spellListRefs: z.array(z.string()).optional(),
  grantedProficiencies: z
    .object({
      armor: z.array(z.string()).optional(),
      weapons: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
      saves: z.array(AbilitySchema).optional(),
      languages: z.array(z.string()).optional(),
    })
    .optional(),
  passiveModifiers: z.array(EffectSchema).optional(),
  domain: z.string().optional(),
}).superRefine((value, ctx) => {
  if (
    value.spellListRefIds &&
    value.spellListRefs &&
    JSON.stringify(value.spellListRefIds) !== JSON.stringify(value.spellListRefs)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Seed subclass spellListRefIds and legacy spellListRefs must match when both are provided.",
      path: ["spellListRefIds"],
    });
  }
});
export type SeedSubclass = z.infer<typeof SeedSubclassSchema>;

const SeedSelectionPrerequisitesSchema = z.object({
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
  featureIds: z.array(z.string()).min(1).optional(),
  requiresSpellcasting: z.boolean().optional(),
});

export const SeedFeatureSchema = SeedBaseSchema.extend({
  selectable: z.boolean().optional(),
  tags: z.array(z.string().min(1)).optional(),
  prerequisites: SeedSelectionPrerequisitesSchema.optional(),
});
export type SeedFeature = z.infer<typeof SeedFeatureSchema>;

export const SeedFeatSchema = SeedBaseSchema.extend({
  category: z.enum(["origin", "general"]).optional(),
  repeatable: z.boolean().optional(),
  prerequisites: SeedSelectionPrerequisitesSchema.optional(),
});
export type SeedFeat = z.infer<typeof SeedFeatSchema>;

export const SeedEquipmentSchema = SeedBaseSchema.extend({
  type: z.enum(["armor", "shield", "weapon", "gear"]),
  armorCategory: z.enum(["light", "medium", "heavy"]).optional(),
  armorClassBase: z.number().int().optional(),
  dexCap: z.number().int().optional(),
  hasShieldBonus: z.boolean().optional(),
  damageDice: z.string().optional(),
  weaponCategory: z.enum(["simple", "martial"]).optional(),
  properties: z.array(z.string()).optional(),
  masteryProperties: z.array(WeaponMasteryPropertySchema).min(1).optional(),
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
  notes: z.string().optional(),
  page: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  reference: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!Object.prototype.hasOwnProperty.call(value, "ritual")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Seed spell must include ritual flag (true or false).",
      path: ["ritual"],
    });
  }

  if (!Object.prototype.hasOwnProperty.call(value, "concentration")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Seed spell must include concentration flag (true or false).",
      path: ["concentration"],
    });
  }
});
export type SeedSpell = z.infer<typeof SeedSpellSchema>;

export const SeedSpellListSchema = SeedBaseSchema.extend({
  spellIds: z.array(z.string()).min(1),
});
export type SeedSpellList = z.infer<typeof SeedSpellListSchema>;

export const SeedPackSchema = z.object({
  species: z.array(SeedSpeciesSchema).optional(),
  skills: z.array(SeedSkillSchema).optional(),
  skillDefinitions: z.array(SeedSkillDefinitionSchema).optional(),
  backgrounds: z.array(SeedBackgroundSchema).optional(),
  classes: z.array(SeedClassSchema).optional(),
  subclasses: z.array(SeedSubclassSchema).optional(),
  features: z.array(SeedFeatureSchema).optional(),
  feats: z.array(SeedFeatSchema).optional(),
  equipment: z.array(SeedEquipmentSchema).optional(),
  spells: z.array(SeedSpellSchema).optional(),
  spellLists: z.array(SeedSpellListSchema).optional(),
}).superRefine((value, ctx) => {
  if (
    value.skills &&
    value.skillDefinitions &&
    JSON.stringify(value.skills) !== JSON.stringify(value.skillDefinitions)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Seed pack skills and legacy skillDefinitions must match when both are provided.",
      path: ["skills"],
    });
  }
});
export type SeedPack = z.infer<typeof SeedPackSchema>;

export const AbilityScoresSchema = z.record(AbilitySchema, z.number().int());
