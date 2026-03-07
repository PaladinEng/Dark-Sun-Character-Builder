import type {
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  SkillDefinition,
  Spell,
  SpellList,
  Species,
} from "./entities";
import { getClassSpellListRefIds } from "./entities";
import type { SeedPack } from "./seed";

export type NormalizedEntities = {
  species: Species[];
  skillDefinitions: SkillDefinition[];
  backgrounds: Background[];
  classes: Class[];
  features: Feature[];
  feats: Feat[];
  equipment: Equipment[];
  spells: Spell[];
  spellLists: SpellList[];
};

type SeedBackgroundEntry = NonNullable<SeedPack["backgrounds"]>[number];
type SeedEquipmentEntry = NonNullable<SeedPack["equipment"]>[number];
type SeedFeatEntry = NonNullable<SeedPack["feats"]>[number];
type SeedSkillEntry = NonNullable<SeedPack["skills"]>[number];

export function slugToId(packId: string, type: string, slug: string): string {
  return `${packId}:${type}:${slug}`;
}

function missingRequiredValue(slug: string, field: string): never {
  throw new Error(
    `Normalization error for equipment '${slug}': missing required value (field: ${field})`,
  );
}

function normalizeBackground(
  packId: string,
  entry: SeedBackgroundEntry,
): Background {
  const metadata = entry as {
    abilityOptions?: Background["abilityOptions"];
    grantsFeat?: string;
    grantsOriginFeatId?: string;
    startingEquipment?: Background["startingEquipment"];
    originFeatChoice?: Background["originFeatChoice"];
  };

  return {
    id: slugToId(packId, "background", entry.slug),
    name: entry.name,
    description: entry.description,
    abilityOptions: metadata.abilityOptions,
    grantsFeat: metadata.grantsFeat,
    grantsOriginFeatId: metadata.grantsOriginFeatId,
    startingEquipment: metadata.startingEquipment,
    originFeatChoice: metadata.originFeatChoice,
    effects: entry.effects,
  };
}

function normalizeSkill(entry: SeedSkillEntry): SkillDefinition {
  return {
    id: entry.slug,
    name: entry.name,
    description: entry.description,
    ability: entry.ability,
    sortOrder: entry.sortOrder,
  };
}

function normalizeFeat(packId: string, entry: SeedFeatEntry): Feat {
  const metadata = entry as {
    category?: Feat["category"];
    repeatable?: boolean;
    prerequisites?: Feat["prerequisites"];
  };
  return {
    id: slugToId(packId, "feat", entry.slug),
    name: entry.name,
    description: entry.description,
    category: metadata.category,
    repeatable: metadata.repeatable,
    prerequisites: metadata.prerequisites,
    effects: entry.effects,
  };
}

function normalizeEquipment(packId: string, entry: SeedEquipmentEntry): Equipment {
  const entryWithExtras = entry as SeedEquipmentEntry & {
    strengthRequirement?: number;
    stealthDisadvantage?: boolean;
  };

  const base: Omit<Equipment, "id" | "type" | "name"> & {
    name: string;
  } = {
    name: entry.name,
    description: entry.description,
    armorClassBase: entry.armorClassBase,
    dexCap: entry.dexCap,
    hasShieldBonus: entry.hasShieldBonus,
    damageDice: entry.damageDice,
    weaponCategory: entry.weaponCategory,
    properties: entry.properties,
    masteryProperties: entry.masteryProperties,
    effects: entry.effects,
    strengthRequirement: entryWithExtras.strengthRequirement,
    stealthDisadvantage: entryWithExtras.stealthDisadvantage,
  };

  if (entry.type === "shield") {
    return {
      id: slugToId(packId, "equipment", entry.slug),
      type: "shield",
      ...base,
      hasShieldBonus: entry.hasShieldBonus ?? true,
    };
  }

  if (entry.type === "weapon") {
    if (!entry.damageDice) {
      missingRequiredValue(entry.slug, "damageDice");
    }
    return {
      id: slugToId(packId, "equipment", entry.slug),
      type: "weapon",
      ...base,
      damageDice: entry.damageDice,
    };
  }

  if (entry.type === "gear") {
    return {
      id: slugToId(packId, "equipment", entry.slug),
      type: "adventuring_gear",
      ...base,
    };
  }

  if (!entry.armorCategory) {
    missingRequiredValue(entry.slug, "armorCategory");
  }

  const armorTypeMap = {
    light: "armor_light",
    medium: "armor_medium",
    heavy: "armor_heavy",
  } as const;

  const mappedArmorType = armorTypeMap[entry.armorCategory];
  if (!mappedArmorType) {
    throw new Error(
      `Normalization error for equipment '${entry.slug}': invalid value (field: armorCategory)`,
    );
  }

  return {
    id: slugToId(packId, "equipment", entry.slug),
    type: mappedArmorType,
    ...base,
  };
}

export function normalizeSeedPack(
  seed: SeedPack,
  packId: string,
): NormalizedEntities {
  const species: Species[] = (seed.species ?? []).map((entry) => ({
    id: slugToId(packId, "species", entry.slug),
    name: entry.name,
    description: entry.description,
    effects: entry.effects,
  }));

  const legacySeedSkills = seed.skillDefinitions;
  const rawSkillEntries = seed.skills ?? legacySeedSkills ?? [];
  const skillDefinitions: SkillDefinition[] = rawSkillEntries.map((entry) =>
    normalizeSkill(entry),
  );

  const backgrounds: Background[] = (seed.backgrounds ?? []).map((entry) =>
    normalizeBackground(packId, entry),
  );

  const classes: Class[] = (seed.classes ?? []).map((entry) => ({
    id: slugToId(packId, "class", entry.slug),
    name: entry.name,
    description: entry.description,
    hitDie: entry.hitDie,
    classSkillChoices: entry.classSkillChoices,
    weaponProficiencies: entry.weaponProficiencies,
    spellcasting: entry.spellcasting,
    spellListRefIds: getClassSpellListRefIds(entry),
    classFeaturesByLevel: entry.classFeaturesByLevel,
    startingEquipment: entry.startingEquipment,
    effects: entry.effects,
  }));

  const features: Feature[] = (seed.features ?? []).map((entry) => ({
    id: slugToId(packId, "feature", entry.slug),
    name: entry.name,
    description: entry.description,
    effects: entry.effects,
  }));

  const feats: Feat[] = (seed.feats ?? []).map((entry) =>
    normalizeFeat(packId, entry),
  );

  const equipment: Equipment[] = (seed.equipment ?? []).map((entry) =>
    normalizeEquipment(packId, entry),
  );

  const spells: Spell[] = (seed.spells ?? []).map((entry) => ({
    id: slugToId(packId, "spell", entry.slug),
    name: entry.name,
    description: entry.description,
    level: entry.level,
    school: entry.school,
    ritual: entry.ritual ?? false,
    castingTime: entry.castingTime,
    range: entry.range,
    components: entry.components,
    duration: entry.duration,
    concentration: entry.concentration ?? false,
    summary: entry.summary,
    notes: entry.notes,
    page: entry.page,
    reference: entry.reference,
    effects: entry.effects,
  }));

  const spellLists: SpellList[] = (seed.spellLists ?? []).map((entry) => ({
    id: slugToId(packId, "spelllist", entry.slug),
    name: entry.name,
    description: entry.description,
    spellIds: entry.spellIds,
    effects: entry.effects,
  }));

  return {
    species,
    skillDefinitions,
    backgrounds,
    classes,
    features,
    feats,
    equipment,
    spells,
    spellLists,
  };
}
