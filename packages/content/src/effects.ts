import { z } from "zod";

export const AbilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
export type Ability = z.infer<typeof AbilitySchema>;

export const EffectSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("grant_skill_proficiency"),
    skill: z.string().min(1)
  }),
  z.object({
    type: z.literal("grant_save_proficiency"),
    ability: AbilitySchema
  }),
  z.object({
    type: z.literal("add_bonus"),
    target: z.enum(["skill", "save"]),
    key: z.string().min(1),
    value: z.number()
  }),
  z.object({
    type: z.literal("set_speed"),
    value: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal("add_armor_class_bonus"),
    value: z.number().int(),
    condition: z.enum(["always", "wearing_armor", "unarmored"]).optional()
  }),
  z.object({
    type: z.literal("add_attack_bonus"),
    value: z.number().int(),
    condition: z.enum(["always", "ranged_weapon"]).optional()
  }),
  z.object({
    type: z.literal("set_unarmored_defense"),
    ability: AbilitySchema
  }),
  z.object({
    type: z.literal("grant_sense"),
    sense: z.string().min(1),
    range: z.number().int().positive().optional()
  }),
  z.object({
    type: z.literal("grant_resistance"),
    damageType: z.string().min(1)
  }),
  z.object({
    type: z.literal("grant_trait"),
    name: z.string().min(1),
    description: z.string().optional()
  }),
  z.object({
    type: z.literal("grant_tool_proficiency"),
    tool: z.string().min(1)
  }),
  z.object({
    type: z.literal("grant_language"),
    language: z.string().min(1)
  })
]);

export type Effect = z.infer<typeof EffectSchema>;
