"use client";

import { useMemo, useState } from "react";

import type { MergedContent, PackManifest } from "@dark-sun/content";

interface Props {
  content: MergedContent;
  packs: PackManifest[];
}

type Entity = { id: string; name: string; sourcePackId?: string; replaces?: string };

function sample(items: Entity[], search: string): Entity[] {
  const lower = search.toLowerCase();
  const filtered = lower
    ? items.filter((item) => {
        return item.id.toLowerCase().includes(lower) || item.name.toLowerCase().includes(lower);
      })
    : items;
  return filtered.slice(0, 5);
}

function EntityTable(props: { title: string; items: Entity[]; search: string }) {
  const rows = useMemo(() => sample(props.items, props.search), [props.items, props.search]);
  return (
    <section className="rounded border border-slate-700 p-3">
      <h3 className="font-semibold">{props.title}</h3>
      <table className="mt-2 w-full text-left text-xs">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>sourcePackId</th>
            <th>replaces</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.name}</td>
              <td>{row.sourcePackId ?? ""}</td>
              <td>{row.replaces ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function ContentDebugClient({ content, packs }: Props) {
  const [search, setSearch] = useState("");
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold">Debug Content</h1>
      <p className="mt-2 text-slate-300">Local development inspector for merged content.</p>

      <label className="mt-4 block text-sm">
        Search
        <input
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by id or name"
        />
      </label>

      <section className="mt-6 rounded border border-slate-700 p-3">
        <h2 className="font-semibold">Pack Manifests</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {packs.map((pack) => (
            <li key={pack.id}>
              {pack.id} - {pack.name} v{pack.version} ({pack.license})
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded border border-slate-700 p-3 text-sm">
        <h2 className="font-semibold">Merged Counts</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>Species: {content.species.length}</div>
          <div>Backgrounds: {content.backgrounds.length}</div>
          <div>Classes: {content.classes.length}</div>
          <div>Features: {content.features.length}</div>
          <div>Feats: {content.feats.length}</div>
          <div>Equipment: {content.equipment.length}</div>
        </div>
      </section>

      <div className="mt-6 grid gap-4">
        <EntityTable title="Species" items={content.species} search={search} />
        <EntityTable title="Backgrounds" items={content.backgrounds} search={search} />
        <EntityTable title="Classes" items={content.classes} search={search} />
        <EntityTable title="Features" items={content.features} search={search} />
        <EntityTable title="Feats" items={content.feats} search={search} />
        <EntityTable title="Equipment" items={content.equipment} search={search} />
      </div>
    </main>
  );
}
