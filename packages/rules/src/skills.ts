import type { MergedContent } from "@dark-sun/content";

import type { Ability } from "./types";

export type ResolvedSkillDefinition = {
  id: string;
  name: string;
  ability: Ability;
};

const ABILITY_SET = new Set<Ability>(["str", "dex", "con", "int", "wis", "cha"]);

const DEFAULT_SKILL_DEFINITIONS: readonly ResolvedSkillDefinition[] = [
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "sleight_of_hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "history", name: "History", ability: "int" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "animal_handling", name: "Animal Handling", ability: "wis" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "survival", name: "Survival", ability: "wis" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" }
];

export function getResolvedSkillDefinitions(
  content: Pick<MergedContent, "skillDefinitions">
): readonly ResolvedSkillDefinition[] {
  if (!content.skillDefinitions || content.skillDefinitions.length === 0) {
    return DEFAULT_SKILL_DEFINITIONS;
  }

  const seen = new Set<string>();
  const resolved: Array<ResolvedSkillDefinition & { sortOrder: number; index: number }> = [];

  for (const [index, definition] of content.skillDefinitions.entries()) {
    if (!definition || typeof definition.id !== "string" || definition.id.length === 0) {
      continue;
    }
    if (seen.has(definition.id)) {
      continue;
    }
    seen.add(definition.id);

    const normalizedAbility = ABILITY_SET.has(definition.ability as Ability)
      ? (definition.ability as Ability)
      : "wis";
    const rawSortOrder =
      typeof (definition as { sortOrder?: unknown }).sortOrder === "number"
        ? Number((definition as { sortOrder: number }).sortOrder)
        : Number.POSITIVE_INFINITY;

    resolved.push({
      id: definition.id,
      name: definition.name,
      ability: normalizedAbility,
      sortOrder: Number.isFinite(rawSortOrder) ? rawSortOrder : Number.POSITIVE_INFINITY,
      index
    });
  }

  if (resolved.length === 0) {
    return DEFAULT_SKILL_DEFINITIONS;
  }

  return resolved
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.index - right.index;
    })
    .map(({ id, name, ability }) => ({ id, name, ability }));
}

export function getResolvedSkillIds(
  content: Pick<MergedContent, "skillDefinitions">
): Set<string> {
  return new Set(getResolvedSkillDefinitions(content).map((definition) => definition.id));
}
