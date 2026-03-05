import type {
  Background,
  Class,
  Feat,
  MergeProvenance,
  Spell,
  SpellList,
  Species
} from "@dark-sun/content";

import DebugContentClient, {
  type DebugContentData,
  type DebugEntityProvenance,
  type DebugEntityRow,
  type DebugEntityType,
  type DebugPackManifestRow
} from "./DebugContentClient";
import { getMergedContent, loadAllPacks } from "../../../src/lib/content";

export const runtime = "nodejs";

function toManifestRows(
  manifests: Array<{
    id: string;
    name: string;
    version: string;
    license: string;
  }>
): DebugPackManifestRow[] {
  return manifests.map((manifest) => ({
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    license: manifest.license
  }));
}

function toRows<T extends { id: string; name: string; sourcePackId?: string; replaces?: string }>(
  entities: T[]
): DebugEntityRow[] {
  return [...entities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entity) => ({
      id: entity.id,
      name: entity.name,
      sourcePackId: entity.sourcePackId,
      replaces: entity.replaces
    }));
}

function mapById<T extends { id: string }>(entities: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const entity of entities) {
    out[entity.id] = entity;
  }
  return out;
}

function toDebugProvenance(
  provenance: MergeProvenance | undefined
): Record<DebugEntityType, Record<string, DebugEntityProvenance>> {
  if (!provenance) {
    return {
      species: {},
      backgrounds: {},
      classes: {},
      feats: {},
      spells: {},
      spellLists: {}
    };
  }

  return {
    species: provenance.speciesById,
    backgrounds: provenance.backgroundsById,
    classes: provenance.classesById,
    feats: provenance.featsById,
    spells: provenance.spellsById,
    spellLists: provenance.spellListsById
  };
}

function toPackEntityLookup(
  packs: Awaited<ReturnType<typeof loadAllPacks>>
): Record<DebugEntityType, Record<string, Record<string, unknown>>> {
  const out: Record<DebugEntityType, Record<string, Record<string, unknown>>> = {
    species: {},
    backgrounds: {},
    classes: {},
    feats: {},
    spells: {},
    spellLists: {}
  };

  for (const pack of packs) {
    out.species[pack.manifest.id] = mapById(pack.entities.species);
    out.backgrounds[pack.manifest.id] = mapById(pack.entities.backgrounds);
    out.classes[pack.manifest.id] = mapById(pack.entities.classes);
    out.feats[pack.manifest.id] = mapById(pack.entities.feats);
    out.spells[pack.manifest.id] = mapById(pack.entities.spells);
    out.spellLists[pack.manifest.id] = mapById(pack.entities.spellLists);
  }

  return out;
}

export default async function DebugContentPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Debug: Content</h1>
        <p className="mt-4 text-sm">This page is disabled in production.</p>
      </main>
    );
  }

  const [allPacks, merged] = await Promise.all([
    loadAllPacks(),
    getMergedContent(undefined, { includeProvenance: true })
  ]);
  const content = merged.content;

  const species: Species[] = content.species;
  const backgrounds: Background[] = content.backgrounds;
  const classes: Class[] = content.classes;
  const feats: Feat[] = content.feats;
  const spells: Spell[] = content.spells;
  const spellLists: SpellList[] = content.spellLists;

  const data: DebugContentData = {
    manifests: toManifestRows(merged.packs.map((pack) => pack.manifest)),
    counts: {
      species: content.species.length,
      backgrounds: content.backgrounds.length,
      classes: content.classes.length,
      features: content.features.length,
      feats: content.feats.length,
      equipment: content.equipment.length,
      spells: content.spells.length,
      spellLists: content.spellLists.length
    },
    entities: {
      species: toRows(species),
      backgrounds: toRows(backgrounds),
      classes: toRows(classes),
      feats: toRows(feats),
      spells: toRows(spells),
      spellLists: toRows(spellLists)
    },
    entitiesByTypeAndId: {
      species: mapById(species),
      backgrounds: mapById(backgrounds),
      classes: mapById(classes),
      feats: mapById(feats),
      spells: mapById(spells),
      spellLists: mapById(spellLists)
    },
    spellAccessPreviewByClassId: Object.fromEntries(
      classes.map((klass) => {
        const spellListIds = klass.spellListRefs ?? [];
        const spellIds = Array.from(
          new Set(
            spellListIds.flatMap(
              (spellListId) => content.spellListsById[spellListId]?.spellIds ?? []
            )
          )
        ).sort((a, b) => a.localeCompare(b));
        return [klass.id, { spellListIds, spellIds }];
      })
    ),
    packEntityLookupByType: toPackEntityLookup(allPacks),
    provenanceByTypeAndId: toDebugProvenance(merged.provenance)
  };

  return <DebugContentClient data={data} />;
}
