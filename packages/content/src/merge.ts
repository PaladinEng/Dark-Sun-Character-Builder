import type {
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  Species
} from "./entities";
import type { Pack } from "./load";
import type { PackManifest } from "./manifest";

interface ReplaceableEntity {
  id: string;
  replaces?: string;
  sourcePackId?: string;
  [key: string]: unknown;
}

export interface MergeCount {
  added: number;
  overridden: number;
  replaced: number;
}

export interface MergeReport {
  species: MergeCount;
  backgrounds: MergeCount;
  classes: MergeCount;
  features: MergeCount;
  feats: MergeCount;
  equipment: MergeCount;
}

export interface MergedContent {
  manifests: PackManifest[];
  species: Species[];
  backgrounds: Background[];
  classes: Class[];
  features: Feature[];
  feats: Feat[];
  equipment: Equipment[];
  speciesById: Record<string, Species>;
  backgroundsById: Record<string, Background>;
  classesById: Record<string, Class>;
  featuresById: Record<string, Feature>;
  featsById: Record<string, Feat>;
  equipmentById: Record<string, Equipment>;
}

type EntityType = keyof Pack["entities"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, incoming: T): T {
  if (Array.isArray(base) && Array.isArray(incoming)) {
    return incoming as T;
  }

  if (isPlainObject(base) && isPlainObject(incoming)) {
    const out: Record<string, unknown> = { ...base };
    for (const [key, next] of Object.entries(incoming)) {
      const prev = out[key];
      if (Array.isArray(next)) {
        out[key] = next;
      } else if (isPlainObject(prev) && isPlainObject(next)) {
        out[key] = deepMerge(prev, next);
      } else {
        out[key] = next;
      }
    }
    return out as T;
  }

  return incoming;
}

function toById<T extends { id: string }>(items: T[]): Record<string, T> {
  const result: Record<string, T> = {};
  for (const item of items) {
    result[item.id] = item;
  }
  return result;
}

function mergeEntityType<T extends ReplaceableEntity>(
  packs: Pack[],
  entityType: EntityType
): { items: T[]; report: MergeCount } {
  const byId = new Map<string, T>();
  const report: MergeCount = { added: 0, overridden: 0, replaced: 0 };

  for (const pack of packs) {
    const entities = ((pack.entities[entityType] ?? []) as unknown as T[]);
    const seenIds = new Set<string>();
    const seenReplaceTargets = new Set<string>();

    for (const entity of entities) {
      if (seenIds.has(entity.id)) {
        throw new Error(
          `Duplicate ${entityType} id "${entity.id}" in pack "${pack.manifest.id}"`
        );
      }
      seenIds.add(entity.id);

      if (entity.replaces) {
        if (seenReplaceTargets.has(entity.replaces)) {
          throw new Error(
            `Conflicting ${entityType} replacements in pack "${pack.manifest.id}" for "${entity.replaces}"`
          );
        }
        seenReplaceTargets.add(entity.replaces);
      }
    }

    for (const entity of entities) {
      const incoming = {
        ...entity,
        sourcePackId: pack.manifest.id
      } as T;

      if (incoming.replaces) {
        byId.delete(incoming.replaces);
        byId.set(incoming.id, incoming);
        report.replaced += 1;
        continue;
      }

      const existing = byId.get(incoming.id);
      if (existing) {
        byId.set(incoming.id, deepMerge(existing, incoming));
        report.overridden += 1;
      } else {
        byId.set(incoming.id, incoming);
        report.added += 1;
      }
    }
  }

  return { items: [...byId.values()], report };
}

export function mergePacks(
  packs: Pack[]
): { content: MergedContent; report: MergeReport } {
  const species = mergeEntityType<Species & ReplaceableEntity>(packs, "species");
  const backgrounds = mergeEntityType<Background & ReplaceableEntity>(
    packs,
    "backgrounds"
  );
  const classes = mergeEntityType<Class & ReplaceableEntity>(packs, "classes");
  const features = mergeEntityType<Feature & ReplaceableEntity>(packs, "features");
  const feats = mergeEntityType<Feat & ReplaceableEntity>(packs, "feats");
  const equipment = mergeEntityType<Equipment & ReplaceableEntity>(packs, "equipment");

  return {
    content: {
      manifests: packs.map((pack) => pack.manifest),
      species: species.items,
      backgrounds: backgrounds.items,
      classes: classes.items,
      features: features.items,
      feats: feats.items,
      equipment: equipment.items,
      speciesById: toById(species.items),
      backgroundsById: toById(backgrounds.items),
      classesById: toById(classes.items),
      featuresById: toById(features.items),
      featsById: toById(feats.items),
      equipmentById: toById(equipment.items)
    },
    report: {
      species: species.report,
      backgrounds: backgrounds.report,
      classes: classes.report,
      features: features.report,
      feats: feats.report,
      equipment: equipment.report
    }
  };
}
