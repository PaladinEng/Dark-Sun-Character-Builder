"use client";

import { useMemo, useState } from "react";

export type DebugEntityRow = {
  id: string;
  name: string;
  sourcePackId?: string;
  replaces?: string;
  grantsFeat?: string;
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
  };
  samples: {
    species: DebugEntityRow[];
    backgrounds: DebugEntityRow[];
    classes: DebugEntityRow[];
    features: DebugEntityRow[];
    feats: DebugEntityRow[];
    equipment: DebugEntityRow[];
  };
  backgroundProbe: unknown;
};

function SampleTable({
  title,
  rows,
  includeGrantsFeat = false,
}: {
  title: string;
  rows: DebugEntityRow[];
  includeGrantsFeat?: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 overflow-auto">
        <table className="min-w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-2 py-1">id</th>
              <th className="px-2 py-1">name</th>
              <th className="px-2 py-1">sourcePackId</th>
              <th className="px-2 py-1">replaces</th>
              {includeGrantsFeat ? <th className="px-2 py-1">grantsFeat</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-800">
                <td className="px-2 py-1 font-mono">{row.id}</td>
                <td className="px-2 py-1">{row.name}</td>
                <td className="px-2 py-1">{row.sourcePackId ?? ""}</td>
                <td className="px-2 py-1 font-mono">{row.replaces ?? ""}</td>
                {includeGrantsFeat ? (
                  <td className="px-2 py-1 font-mono">{row.grantsFeat ?? ""}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DebugContentClient({ data }: { data: DebugContentData }) {
  const [search, setSearch] = useState("");
  const searchLower = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!searchLower) {
      return data.samples;
    }

    const predicate = (row: DebugEntityRow) =>
      row.id.toLowerCase().includes(searchLower) ||
      row.name.toLowerCase().includes(searchLower);

    return {
      species: data.samples.species.filter(predicate),
      backgrounds: data.samples.backgrounds.filter(predicate),
      classes: data.samples.classes.filter(predicate),
      features: data.samples.features.filter(predicate),
      feats: data.samples.feats.filter(predicate),
      equipment: data.samples.equipment.filter(predicate),
    };
  }, [data.samples, searchLower]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Debug: Content</h1>
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

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Search</h2>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by id or name"
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </section>

      <SampleTable title="Species (first 5)" rows={filtered.species.slice(0, 5)} />
      <SampleTable
        title="Backgrounds (first 5)"
        rows={filtered.backgrounds.slice(0, 5)}
        includeGrantsFeat
      />
      <SampleTable title="Classes (first 5)" rows={filtered.classes.slice(0, 5)} />
      <SampleTable title="Features (first 5)" rows={filtered.features.slice(0, 5)} />
      <SampleTable title="Feats (first 5)" rows={filtered.feats.slice(0, 5)} />
      <SampleTable title="Equipment (first 5)" rows={filtered.equipment.slice(0, 5)} />

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Background Field Probe</h2>
        <pre className="mt-2 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(data.backgroundProbe, null, 2)}
        </pre>
      </section>
    </main>
  );
}
