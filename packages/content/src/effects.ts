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
    type: z.literal("grant_tool_proficiency"),
    tool: z.string().min(1)
  })
]);

export type Effect = z.infer<typeof EffectSchema>;
