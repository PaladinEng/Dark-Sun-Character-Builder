import { z } from "zod";

import { EffectSchema } from "./effects";

export const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type Ability = z.infer<typeof AbilitySchema>;

const ClassFeatureGrantSchema = z.object({
  level: z.number().int().min(1).max(20),
  featureId: z.string().min(1),
});
export type ClassFeatureGrant = z.infer<typeof ClassFeatureGrantSchema>;

const ClassFeaturesByLevelSchema = z
  .array(ClassFeatureGrantSchema)
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const entry of value) {
      const key = `${entry.level}|${entry.featureId}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate class feature entry at level ${entry.level}: ${entry.featureId}.`,
          path: ["classFeaturesByLevel"],
        });
      }
      seen.add(key);
    }
  });

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

export const StartingEquipmentBundleSchema = z
  .object({
    itemIds: z.array(z.string()).optional(),
    equippedArmorId: z.string().optional(),
    equippedShieldId: z.string().optional(),
    equippedWeaponId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const hasItems = (value.itemIds?.length ?? 0) > 0;
    if (hasItems || value.equippedArmorId || value.equippedShieldId || value.equippedWeaponId) {
      return;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Starting equipment bundle must define at least one item or equipped slot.",
      path: ["itemIds"],
    });
  });
export type StartingEquipmentBundle = z.infer<typeof StartingEquipmentBundleSchema>;

export const BackgroundSchema = EntityBaseSchema.extend({
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
export type Background = z.infer<typeof BackgroundSchema>;

const SpellSelectionLimitByLevelSchema = z.object({
  level: z.number().int().min(1).max(20),
  known: z.number().int().min(0).optional(),
  prepared: z.number().int().min(0).optional(),
  cantripsKnown: z.number().int().min(0).optional(),
});

const SpellSelectionLimitsByLevelSchema = z
  .array(SpellSelectionLimitByLevelSchema)
  .superRefine((value, ctx) => {
    const seen = new Set<number>();
    for (const entry of value) {
      if (seen.has(entry.level)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate spellcasting selection limit level: ${entry.level}.`,
          path: ["level"],
        });
      }
      seen.add(entry.level);
    }
  });

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
      selectionLimitsByLevel: SpellSelectionLimitsByLevelSchema.optional(),
    })
    .optional(),
  spellListRefIds: z.array(z.string()).optional(),
  spellListRefs: z.array(z.string()).optional(),
  classFeaturesByLevel: ClassFeaturesByLevelSchema.optional(),
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
        "Class spellListRefIds and legacy spellListRefs must match when both are provided.",
      path: ["spellListRefIds"],
    });
  }
});
export type Class = z.infer<typeof ClassSchema>;

export function getClassSpellListRefIds(
  klass: Pick<Class, "spellListRefIds" | "spellListRefs">,
): string[] {
  return klass.spellListRefIds ?? klass.spellListRefs ?? [];
}

export function getClassFeatureIdsForLevel(
  klass: Pick<Class, "classFeaturesByLevel">,
  level: number,
): string[] {
  const normalizedLevel = Math.max(1, Math.min(20, Math.floor(level)));
  const entries = klass.classFeaturesByLevel ?? [];
  const seen = new Set<string>();
  const ids: string[] = [];

  const sorted = [...entries].sort((a, b) => {
    if (a.level !== b.level) {
      return a.level - b.level;
    }
    return a.featureId.localeCompare(b.featureId);
  });

  for (const entry of sorted) {
    if (entry.level > normalizedLevel || seen.has(entry.featureId)) {
      continue;
    }
    seen.add(entry.featureId);
    ids.push(entry.featureId);
  }

  return ids;
}

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
      featureIds: z.array(z.string()).min(1).optional(),
      requiresSpellcasting: z.boolean().optional(),
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
  "adventuring_gear",
]);
export type EquipmentType = z.infer<typeof EquipmentTypeSchema>;

export const WeaponMasteryPropertySchema = z.enum([
  "cleave",
  "graze",
  "nick",
  "push",
  "sap",
  "slow",
  "topple",
  "vex",
]);
export type WeaponMasteryProperty = z.infer<typeof WeaponMasteryPropertySchema>;

export const EquipmentSchema = EntityBaseSchema.extend({
  type: EquipmentTypeSchema,
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
}).superRefine((value, ctx) => {
  if (!Object.prototype.hasOwnProperty.call(value, "ritual")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Spell must include ritual flag (true or false).",
      path: ["ritual"],
    });
  }

  if (!Object.prototype.hasOwnProperty.call(value, "concentration")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Spell must include concentration flag (true or false).",
      path: ["concentration"],
    });
  }
});
export type Spell = z.infer<typeof SpellSchema>;

export const SpellListSchema = EntityBaseSchema.extend({
  spellIds: z.array(z.string()).min(1),
});
export type SpellList = z.infer<typeof SpellListSchema>;
