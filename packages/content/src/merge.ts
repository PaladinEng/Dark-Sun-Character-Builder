import type {
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  SkillDefinition,
  Spell,
  SpellList,
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
  skillDefinitions: MergeCount;
  backgrounds: MergeCount;
  classes: MergeCount;
  features: MergeCount;
  feats: MergeCount;
  equipment: MergeCount;
  spells: MergeCount;
  spellLists: MergeCount;
}

export interface ProvenanceLineageStep {
  entityId: string;
  packId: string;
  replaces?: string;
  missingTarget?: boolean;
}

export interface EntityProvenance {
  entityId: string;
  entityType: EntityType;
  sourcePackId?: string;
  fieldSources: Record<string, string>;
  lineage: ProvenanceLineageStep[];
}

export interface MergeProvenance {
  speciesById: Record<string, EntityProvenance>;
  skillDefinitionsById: Record<string, EntityProvenance>;
  backgroundsById: Record<string, EntityProvenance>;
  classesById: Record<string, EntityProvenance>;
  featuresById: Record<string, EntityProvenance>;
  featsById: Record<string, EntityProvenance>;
  equipmentById: Record<string, EntityProvenance>;
  spellsById: Record<string, EntityProvenance>;
  spellListsById: Record<string, EntityProvenance>;
}

export interface MergedContent {
  manifests: PackManifest[];
  species: Species[];
  skillDefinitions: SkillDefinition[];
  backgrounds: Background[];
  classes: Class[];
  features: Feature[];
  feats: Feat[];
  equipment: Equipment[];
  spells: Spell[];
  spellLists: SpellList[];
  speciesById: Record<string, Species>;
  skillDefinitionsById: Record<string, SkillDefinition>;
  backgroundsById: Record<string, Background>;
  classesById: Record<string, Class>;
  featuresById: Record<string, Feature>;
  featsById: Record<string, Feat>;
  equipmentById: Record<string, Equipment>;
  spellsById: Record<string, Spell>;
  spellListsById: Record<string, SpellList>;
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

function toProvenanceById(
  items: Array<[string, EntityProvenance]>
): Record<string, EntityProvenance> {
  const result: Record<string, EntityProvenance> = {};
  for (const [id, provenance] of items) {
    result[id] = provenance;
  }
  return result;
}

function makeFieldSources(
  entity: ReplaceableEntity,
  sourcePackId: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(entity)) {
    if (key === "sourcePackId") {
      continue;
    }
    out[key] = sourcePackId;
  }
  return out;
}

function mergeEntityType<T extends ReplaceableEntity>(
  packs: Pack[],
  entityType: EntityType
): { items: T[]; report: MergeCount; provenanceById: Record<string, EntityProvenance> } {
  const byId = new Map<string, T>();
  const provenanceById = new Map<string, EntityProvenance>();
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
        const replacedEntity = byId.get(incoming.replaces);
        const replacedProvenance = provenanceById.get(incoming.replaces);

        byId.delete(incoming.replaces);
        provenanceById.delete(incoming.replaces);
        byId.set(incoming.id, incoming);

        const lineage = replacedProvenance
          ? [...replacedProvenance.lineage]
          : replacedEntity
            ? [
                {
                  entityId: replacedEntity.id,
                  packId:
                    replacedEntity.sourcePackId ?? pack.manifest.id
                }
              ]
            : [
                {
                  entityId: incoming.replaces,
                  packId: pack.manifest.id,
                  missingTarget: true
                }
              ];
        lineage.push({
          entityId: incoming.id,
          packId: pack.manifest.id,
          replaces: incoming.replaces
        });

        provenanceById.set(incoming.id, {
          entityId: incoming.id,
          entityType,
          sourcePackId: pack.manifest.id,
          fieldSources: makeFieldSources(incoming, pack.manifest.id),
          lineage
        });
        report.replaced += 1;
        continue;
      }

      const existing = byId.get(incoming.id);
      if (existing) {
        byId.set(incoming.id, deepMerge(existing, incoming));
        const previous =
          provenanceById.get(incoming.id) ??
          ({
            entityId: incoming.id,
            entityType,
            sourcePackId: existing.sourcePackId,
            fieldSources: {},
            lineage: [
              {
                entityId: incoming.id,
                packId: existing.sourcePackId ?? pack.manifest.id
              }
            ]
          } satisfies EntityProvenance);
        const nextFieldSources = {
          ...previous.fieldSources,
          ...makeFieldSources(incoming, pack.manifest.id)
        };
        const nextLineage = [...previous.lineage];
        const lastStep = nextLineage[nextLineage.length - 1];
        if (lastStep?.packId !== pack.manifest.id) {
          nextLineage.push({
            entityId: incoming.id,
            packId: pack.manifest.id
          });
        }
        provenanceById.set(incoming.id, {
          ...previous,
          sourcePackId: pack.manifest.id,
          fieldSources: nextFieldSources,
          lineage: nextLineage
        });
        report.overridden += 1;
      } else {
        byId.set(incoming.id, incoming);
        provenanceById.set(incoming.id, {
          entityId: incoming.id,
          entityType,
          sourcePackId: pack.manifest.id,
          fieldSources: makeFieldSources(incoming, pack.manifest.id),
          lineage: [
            {
              entityId: incoming.id,
              packId: pack.manifest.id
            }
          ]
        });
        report.added += 1;
      }
    }
  }

  return {
    items: [...byId.values()],
    report,
    provenanceById: toProvenanceById([...provenanceById.entries()])
  };
}

export function mergePacks(
  packs: Pack[]
): { content: MergedContent; report: MergeReport } {
  const merged = mergePacksWithProvenance(packs);
  return {
    content: merged.content,
    report: merged.report
  };
}

export function mergePacksWithProvenance(
  packs: Pack[]
): { content: MergedContent; report: MergeReport; provenance: MergeProvenance } {
  const species = mergeEntityType<Species & ReplaceableEntity>(packs, "species");
  const skillDefinitions = mergeEntityType<SkillDefinition & ReplaceableEntity>(
    packs,
    "skillDefinitions"
  );
  const backgrounds = mergeEntityType<Background & ReplaceableEntity>(
    packs,
    "backgrounds"
  );
  const classes = mergeEntityType<Class & ReplaceableEntity>(packs, "classes");
  const features = mergeEntityType<Feature & ReplaceableEntity>(packs, "features");
  const feats = mergeEntityType<Feat & ReplaceableEntity>(packs, "feats");
  const equipment = mergeEntityType<Equipment & ReplaceableEntity>(packs, "equipment");
  const spells = mergeEntityType<Spell & ReplaceableEntity>(packs, "spells");
  const spellLists = mergeEntityType<SpellList & ReplaceableEntity>(packs, "spellLists");

  return {
    content: {
      manifests: packs.map((pack) => pack.manifest),
      species: species.items,
      skillDefinitions: skillDefinitions.items,
      backgrounds: backgrounds.items,
      classes: classes.items,
      features: features.items,
      feats: feats.items,
      equipment: equipment.items,
      spells: spells.items,
      spellLists: spellLists.items,
      speciesById: toById(species.items),
      skillDefinitionsById: toById(skillDefinitions.items),
      backgroundsById: toById(backgrounds.items),
      classesById: toById(classes.items),
      featuresById: toById(features.items),
      featsById: toById(feats.items),
      equipmentById: toById(equipment.items),
      spellsById: toById(spells.items),
      spellListsById: toById(spellLists.items)
    },
    report: {
      species: species.report,
      skillDefinitions: skillDefinitions.report,
      backgrounds: backgrounds.report,
      classes: classes.report,
      features: features.report,
      feats: feats.report,
      equipment: equipment.report,
      spells: spells.report,
      spellLists: spellLists.report
    },
    provenance: {
      speciesById: species.provenanceById,
      skillDefinitionsById: skillDefinitions.provenanceById,
      backgroundsById: backgrounds.provenanceById,
      classesById: classes.provenanceById,
      featuresById: features.provenanceById,
      featsById: feats.provenanceById,
      equipmentById: equipment.provenanceById,
      spellsById: spells.provenanceById,
      spellListsById: spellLists.provenanceById
    }
  };
}
