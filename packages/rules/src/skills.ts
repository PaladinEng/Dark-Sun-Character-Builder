import type { MergedContent } from "@dark-sun/content";

import type { Ability } from "./types";

export type ResolvedSkillDefinition = {
  id: string;
  name: string;
  ability: Ability;
};

export type SkillAndToolDisplayRow =
  | {
      kind: "skill";
      id: string;
      label: string;
      value: number;
    }
  | {
      kind: "tool";
      id: string;
      label: string;
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

function formatSkillLabel(skillId: string): string {
  return skillId
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

type DisplaySkillDefinition = {
  id: string;
  name: string;
};

export function getSkillAndToolDisplayRows(input: {
  skillDefinitions?: ReadonlyArray<DisplaySkillDefinition>;
  skills?: Readonly<Record<string, number>>;
  toolProficiencies?: readonly string[];
}): SkillAndToolDisplayRow[] {
  const rows: SkillAndToolDisplayRow[] = [];
  const seenSkillIds = new Set<string>();

  for (const definition of input.skillDefinitions ?? []) {
    if (!definition || typeof definition.id !== "string" || definition.id.length === 0) {
      continue;
    }
    if (seenSkillIds.has(definition.id)) {
      continue;
    }
    seenSkillIds.add(definition.id);
    rows.push({
      kind: "skill",
      id: definition.id,
      label: definition.name,
      value: input.skills?.[definition.id] ?? 0,
    });
  }

  const unknownSkillIds = Object.keys(input.skills ?? {})
    .filter((skillId) => !seenSkillIds.has(skillId))
    .sort((left, right) => left.localeCompare(right));
  for (const skillId of unknownSkillIds) {
    rows.push({
      kind: "skill",
      id: skillId,
      label: formatSkillLabel(skillId),
      value: input.skills?.[skillId] ?? 0,
    });
  }

  const seenTools = new Set<string>();
  const orderedTools = [...(input.toolProficiencies ?? [])]
    .filter((tool): tool is string => typeof tool === "string" && tool.trim().length > 0)
    .map((tool) => tool.trim())
    .sort((left, right) => left.localeCompare(right));
  for (const tool of orderedTools) {
    if (seenTools.has(tool)) {
      continue;
    }
    seenTools.add(tool);
    rows.push({
      kind: "tool",
      id: tool,
      label: tool,
    });
  }

  return rows;
}
