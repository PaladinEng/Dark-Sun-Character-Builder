import type { MergedContent } from "@dark-sun/content";

export type RulesCoverageReport = {
  supportedEffectTypes: string[];
  usedEffectTypes: string[];
  missingEffectHandlers: string[];
  raw2024Mechanics: {
    abilityScoreIncrease: boolean;
    originFeat: boolean;
    featOrAsiAdvancements: boolean;
    proficiencyBonus: boolean;
    skillProficiencies: boolean;
    toolProficiencies: boolean;
    savingThrows: boolean;
    hpScaling: boolean;
    armorClassCalculation: boolean;
    weaponAttackCalculation: boolean;
    abilityScoreCap: boolean;
  };
  originFeatEvidence: {
    backgroundsWithGrantsFeat: Array<{ id: string; grantsFeat: string }>;
    missingFeatsReferenced: string[];
  };
  contentUsage: {
    speciesCount: number;
    backgroundsCount: number;
    classesCount: number;
    featsCount: number;
    equipmentCount: number;
  };
  warnings: string[];
};

const SUPPORTED_EFFECT_TYPES = [
  "grant_skill_proficiency",
  "grant_save_proficiency",
  "add_bonus",
  "set_speed",
  "grant_tool_proficiency",
] as const;

function collectArrayFromContent<T = unknown>(
  content: unknown,
  key: string,
): T[] {
  const anyContent = content as Record<string, unknown>;
  const fromList = anyContent[key];
  if (Array.isArray(fromList)) {
    return fromList as T[];
  }

  const byIdKey = `${key}ById`;
  const fromById = anyContent[byIdKey] as Record<string, T> | undefined;
  if (fromById && typeof fromById === "object") {
    return Object.values(fromById);
  }

  const entities = anyContent.entities as Record<string, unknown> | undefined;
  if (entities && Array.isArray(entities[key])) {
    return entities[key] as T[];
  }

  return [];
}

function collectEffectTypesFromEntities(
  entities: Array<{ effects?: Array<{ type?: string }> }>,
): string[] {
  const types = new Set<string>();

  for (const entity of entities) {
    for (const effect of entity.effects ?? []) {
      if (typeof effect?.type === "string" && effect.type.length > 0) {
        types.add(effect.type);
      }
    }
  }

  return Array.from(types).sort();
}

function buildFeatsById(content: unknown): Record<string, unknown> {
  const anyContent = content as Record<string, unknown>;

  const direct = anyContent.featsById as Record<string, unknown> | undefined;
  if (direct && typeof direct === "object") {
    return direct;
  }

  const featsArray = collectArrayFromContent<{ id: string }>(content, "feats");
  if (featsArray.length > 0) {
    return Object.fromEntries(featsArray.map((feat) => [feat.id, feat]));
  }

  const entities = anyContent.entities as Record<string, unknown> | undefined;
  const nested = entities?.featsById as Record<string, unknown> | undefined;
  return nested && typeof nested === "object" ? nested : {};
}

export function generateRulesCoverageReport(
  content: MergedContent,
): RulesCoverageReport {
  const species = collectArrayFromContent(content, "species");
  const backgrounds = collectArrayFromContent<{
    id: string;
    grantsFeat?: string;
    effects?: Array<{ type?: string }>;
    abilityOptions?: unknown;
  }>(content, "backgrounds");
  const classes = collectArrayFromContent<{
    hitDie?: number;
    effects?: Array<{ type?: string }>;
  }>(content, "classes");
  const features = collectArrayFromContent<{ effects?: Array<{ type?: string }> }>(
    content,
    "features",
  );
  const feats = collectArrayFromContent<{ effects?: Array<{ type?: string }> }>(
    content,
    "feats",
  );
  const equipment = collectArrayFromContent<{
    type?: string;
    armorClassBase?: number;
    damageDice?: string;
    effects?: Array<{ type?: string }>;
  }>(content, "equipment");

  const allEntityGroups = [
    species as Array<{ effects?: Array<{ type?: string }> }>,
    backgrounds,
    classes,
    features,
    feats,
    equipment,
  ];

  const usedEffectTypes = collectEffectTypesFromEntities(allEntityGroups.flat());
  const supportedEffectTypes = [...SUPPORTED_EFFECT_TYPES];
  const missingEffectHandlers = usedEffectTypes.filter(
    (type) => !supportedEffectTypes.includes(type as (typeof SUPPORTED_EFFECT_TYPES)[number]),
  );

  const featsById = buildFeatsById(content);
  const backgroundsWithGrantsFeat = backgrounds
    .filter(
      (bg) =>
        typeof bg?.grantsFeat === "string" &&
        (bg.grantsFeat as string).trim().length > 0,
    )
    .map((bg) => ({ id: bg.id, grantsFeat: bg.grantsFeat as string }));

  const backgroundsMissingGrantsFeat = backgrounds
    .filter(
      (bg) =>
        typeof bg?.id === "string" &&
        !(typeof bg?.grantsFeat === "string" && bg.grantsFeat.trim().length > 0),
    )
    .map((bg) => bg.id);

  const missingFeatsReferenced = backgroundsWithGrantsFeat
    .map((entry) => entry.grantsFeat)
    .filter((featId) => !featsById[featId]);

  const raw2024Mechanics = {
    abilityScoreIncrease: true,
    originFeat: backgroundsWithGrantsFeat.length > 0,
    featOrAsiAdvancements: true,
    proficiencyBonus: true,
    skillProficiencies: supportedEffectTypes.includes("grant_skill_proficiency"),
    toolProficiencies: supportedEffectTypes.includes("grant_tool_proficiency"),
    savingThrows: supportedEffectTypes.includes("grant_save_proficiency"),
    hpScaling: classes.some((klass) => typeof klass.hitDie === "number"),
    armorClassCalculation: equipment.some(
      (item) =>
        typeof item.armorClassBase === "number" ||
        item.type === "shield" ||
        item.type === "armor_light" ||
        item.type === "armor_medium" ||
        item.type === "armor_heavy",
    ),
    weaponAttackCalculation: equipment.some(
      (item) => item.type === "weapon" || typeof item.damageDice === "string",
    ),
    abilityScoreCap: true,
  };

  const warnings: string[] = [];

  for (const missingType of missingEffectHandlers) {
    warnings.push(`Missing effect handler for content effect type: ${missingType}`);
  }

  if (!raw2024Mechanics.originFeat) {
    warnings.push("RAW 2024 coverage gap: originFeat");
  }

  for (const missingFeatId of missingFeatsReferenced) {
    warnings.push(
      `Background grantsFeat refers to missing feat id: ${missingFeatId}`,
    );
  }

  if (backgrounds.length > 0 && backgroundsMissingGrantsFeat.length > 0) {
    warnings.push(
      `Strict RAW background feat warning: missing grantsFeat on backgrounds: ${backgroundsMissingGrantsFeat.join(", ")}`,
    );
  }

  const rawCoverageEntries = Object.entries(raw2024Mechanics);
  for (const [key, value] of rawCoverageEntries) {
    if (!value && key !== "originFeat") {
      warnings.push(`RAW 2024 coverage gap: ${key}`);
    }
  }

  return {
    supportedEffectTypes,
    usedEffectTypes,
    missingEffectHandlers,
    raw2024Mechanics,
    originFeatEvidence: {
      backgroundsWithGrantsFeat,
      missingFeatsReferenced,
    },
    contentUsage: {
      speciesCount: species.length,
      backgroundsCount: backgrounds.length,
      classesCount: classes.length,
      featsCount: feats.length,
      equipmentCount: equipment.length,
    },
    warnings,
  };
}
