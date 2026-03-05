"use client";

import { useMemo, useState } from "react";

export type DebugEntityType =
  | "species"
  | "backgrounds"
  | "classes"
  | "feats"
  | "spells"
  | "spellLists";

export type DebugEntityRow = {
  id: string;
  name: string;
  sourcePackId?: string;
  replaces?: string;
};

export type DebugEntityProvenance = {
  entityId: string;
  sourcePackId?: string;
  fieldSources: Record<string, string>;
  lineage: Array<{
    entityId: string;
    packId: string;
    replaces?: string;
    missingTarget?: boolean;
  }>;
};

export type DebugPackManifestRow = {
  id: string;
  name: string;
  version: string;
  license: string;
};

export type DebugContentData = {
  manifests: DebugPackManifestRow[];
  counts: {
    species: number;
    backgrounds: number;
    classes: number;
    features: number;
    feats: number;
    equipment: number;
    spells: number;
    spellLists: number;
  };
  entities: Record<DebugEntityType, DebugEntityRow[]>;
  entitiesByTypeAndId: Record<DebugEntityType, Record<string, unknown>>;
  spellAccessPreviewByClassId: Record<
    string,
    {
      spellListIds: string[];
      spellIds: string[];
    }
  >;
  packEntityLookupByType: Record<
    DebugEntityType,
    Record<string, Record<string, unknown>>
  >;
  provenanceByTypeAndId: Record<DebugEntityType, Record<string, DebugEntityProvenance>>;
};

const ENTITY_TYPE_OPTIONS: Array<{ value: DebugEntityType; label: string }> = [
  { value: "species", label: "Species" },
  { value: "backgrounds", label: "Backgrounds" },
  { value: "classes", label: "Classes" },
  { value: "feats", label: "Feats" },
  { value: "spells", label: "Spells" },
  { value: "spellLists", label: "Spell Lists" }
];

export default function DebugContentClient({ data }: { data: DebugContentData }) {
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState<DebugEntityType>("species");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [showProvenance, setShowProvenance] = useState(true);

  const filteredRows = useMemo(() => {
    const rows = data.entities[entityType] ?? [];
    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) {
      return rows;
    }
    return rows.filter((row) => {
      return (
        row.id.toLowerCase().includes(searchTerm) ||
        row.name.toLowerCase().includes(searchTerm)
      );
    });
  }, [data.entities, entityType, search]);

  const resolvedEntityId =
    selectedEntityId && filteredRows.some((row) => row.id === selectedEntityId)
      ? selectedEntityId
      : filteredRows[0]?.id ?? "";

  const selectedEntity =
    resolvedEntityId.length > 0
      ? data.entitiesByTypeAndId[entityType]?.[resolvedEntityId] ?? null
      : null;

  const selectedProvenance =
    resolvedEntityId.length > 0
      ? data.provenanceByTypeAndId[entityType]?.[resolvedEntityId] ?? null
      : null;

  const lineage = selectedProvenance?.lineage ?? [];
  const baseLineageStep = lineage[0];
  const finalLineageStep = lineage[lineage.length - 1];
  const baseEntity = baseLineageStep
    ? data.packEntityLookupByType[entityType]?.[baseLineageStep.packId]?.[
        baseLineageStep.entityId
      ] ?? null
    : null;
  const overrideEntity = finalLineageStep
    ? data.packEntityLookupByType[entityType]?.[finalLineageStep.packId]?.[
        finalLineageStep.entityId
      ] ?? null
    : selectedEntity;
  const fieldDiff = useMemo(() => {
    if (!baseEntity || !overrideEntity) {
      return null;
    }
    const base = baseEntity as Record<string, unknown>;
    const next = overrideEntity as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(base), ...Object.keys(next)])).sort((a, b) =>
      a.localeCompare(b)
    );
    const out: Record<string, { base: unknown; override: unknown }> = {};
    for (const key of keys) {
      const left = base[key];
      const right = next[key];
      if (JSON.stringify(left) === JSON.stringify(right)) {
        continue;
      }
      out[key] = { base: left, override: right };
    }
    return out;
  }, [baseEntity, overrideEntity]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Debug: Content</h1>
        <p className="mt-2 text-sm text-slate-300">
          Merged entity inspector with per-field provenance and replacement lineage.
        </p>
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Loaded Pack Manifests</h2>
        <div className="mt-2 overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-2 py-1">id</th>
                <th className="px-2 py-1">name</th>
                <th className="px-2 py-1">version</th>
                <th className="px-2 py-1">license</th>
              </tr>
            </thead>
            <tbody>
              {data.manifests.map((manifest) => (
                <tr key={manifest.id} className="border-b border-slate-800">
                  <td className="px-2 py-1 font-mono">{manifest.id}</td>
                  <td className="px-2 py-1">{manifest.name}</td>
                  <td className="px-2 py-1">{manifest.version}</td>
                  <td className="px-2 py-1">{manifest.license}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Merged Counts</h2>
        <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(data.counts, null, 2)}
        </pre>
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4 md:grid-cols-4">
        <label className="text-sm md:col-span-2">
          Search
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by id or name"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Entity Type
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value as DebugEntityType);
              setSelectedEntityId("");
            }}
          >
            {ENTITY_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Entity
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={resolvedEntityId}
            onChange={(event) => setSelectedEntityId(event.target.value)}
          >
            {filteredRows.length === 0 ? (
              <option value="">No matches</option>
            ) : null}
            {filteredRows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.id}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Merged Entity JSON</h2>
        <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(selectedEntity, null, 2)}
        </pre>
      </section>

      {entityType === "classes" && resolvedEntityId ? (
        <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Effective Spell Access Preview</h2>
          <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(data.spellAccessPreviewByClassId[resolvedEntityId] ?? null, null, 2)}
          </pre>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Base vs Override Field Diff</h2>
        <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(
            {
              base: baseLineageStep
                ? { packId: baseLineageStep.packId, entityId: baseLineageStep.entityId }
                : null,
              override: finalLineageStep
                ? { packId: finalLineageStep.packId, entityId: finalLineageStep.entityId }
                : null,
              fields: fieldDiff
            },
            null,
            2
          )}
        </pre>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showProvenance}
            onChange={(event) => setShowProvenance(event.target.checked)}
          />
          Show Provenance
        </label>

        {showProvenance ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Field Sources
              </h3>
              <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
                {JSON.stringify(selectedProvenance?.fieldSources ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Replacement Lineage
              </h3>
              <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
                {JSON.stringify(selectedProvenance?.lineage ?? null, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
