import type {
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  Species,
} from "./entities";
import type { SeedPack } from "./seed";

export type NormalizedEntities = {
  species: Species[];
  backgrounds: Background[];
  classes: Class[];
  features: Feature[];
  feats: Feat[];
  equipment: Equipment[];
};

type SeedBackgroundEntry = NonNullable<SeedPack["backgrounds"]>[number];
type SeedEquipmentEntry = NonNullable<SeedPack["equipment"]>[number];
type SeedFeatEntry = NonNullable<SeedPack["feats"]>[number];

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
  };

  return {
    id: slugToId(packId, "background", entry.slug),
    name: entry.name,
    description: entry.description,
    abilityOptions: metadata.abilityOptions,
    grantsFeat: metadata.grantsFeat,
    effects: entry.effects,
  };
}

function normalizeFeat(packId: string, entry: SeedFeatEntry): Feat {
  return {
    id: slugToId(packId, "feat", entry.slug),
    name: entry.name,
    description: entry.description,
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
    properties: entry.properties,
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

  const backgrounds: Background[] = (seed.backgrounds ?? []).map((entry) =>
    normalizeBackground(packId, entry),
  );

  const classes: Class[] = (seed.classes ?? []).map((entry) => ({
    id: slugToId(packId, "class", entry.slug),
    name: entry.name,
    description: entry.description,
    hitDie: entry.hitDie,
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

  return {
    species,
    backgrounds,
    classes,
    features,
    feats,
    equipment,
  };
}
