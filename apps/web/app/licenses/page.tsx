import type { LoadedPackManifest } from "../../src/lib/content";
import { getMergedContent } from "../../src/lib/content";

export const runtime = "nodejs";

export default async function LicensesPage() {
  const { packs } = await getMergedContent();

  return (
    <main className="mx-auto max-w-4xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Attribution &amp; Licenses</h1>
      {packs.map((pack: { manifest: LoadedPackManifest }) => {
        const manifest = pack.manifest;
        return (
          <section
            key={manifest.id}
            className="rounded-lg border border-slate-700 bg-slate-900/60 p-4"
          >
            <h2 className="text-lg font-semibold">{manifest.name}</h2>
            <dl className="mt-2 grid gap-1 text-sm">
              <div>
                <dt className="inline font-semibold">Version:</dt>{" "}
                <dd className="inline">{manifest.version}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">License:</dt>{" "}
                <dd className="inline">{manifest.license}</dd>
              </div>
              <div>
                <dt className="inline font-semibold">Source:</dt>{" "}
                <dd className="inline">{manifest.source ?? ""}</dd>
              </div>
            </dl>
            {manifest.attributionText ? (
              <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs">
                {manifest.attributionText}
              </pre>
            ) : null}
          </section>
        );
      })}
    </main>
  );
}
