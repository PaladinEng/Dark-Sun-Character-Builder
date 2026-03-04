import Link from "next/link";

import { getMergedContent } from "../src/lib/content";

export const runtime = "nodejs";

export default async function HomePage() {
  const { packs, content } = await getMergedContent();

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h1 className="text-3xl font-semibold">Dark Sun Builder</h1>
        <p className="mt-2 text-sm text-slate-300">
          Loaded packs: {packs.length}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold">Merged Counts</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Species: {content.species.length}</li>
            <li>Backgrounds: {content.backgrounds.length}</li>
            <li>Classes: {content.classes.length}</li>
            <li>Features: {content.features.length}</li>
            <li>Feats: {content.feats.length}</li>
            <li>Equipment: {content.equipment.length}</li>
          </ul>
        </div>
      </section>

      <footer className="flex flex-wrap gap-4 text-sm">
        <Link href="/builder" className="underline">
          Builder
        </Link>
        <Link href="/licenses" className="underline">
          Attribution &amp; Licenses
        </Link>
      </footer>
    </main>
  );
}
