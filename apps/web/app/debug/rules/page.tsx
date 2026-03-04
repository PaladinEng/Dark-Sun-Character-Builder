import type { Background } from "@dark-sun/content";
import { generateRulesCoverageReport } from "@dark-sun/rules";

import { getMergedContent } from "../../../src/lib/content";

export const runtime = "nodejs";

function findAcolyte(backgrounds: Background[]): Background | null {
  return backgrounds.find((background) => background.id === "srd52:background:acolyte") ?? null;
}

export default async function DebugRulesPage() {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold">Debug: Rules Coverage</h1>
        <p className="mt-4 text-sm">This page is disabled in production.</p>
      </main>
    );
  }

  const { content } = await getMergedContent();
  const acolyte = findAcolyte(content.backgrounds);
  const report = generateRulesCoverageReport(content);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Rules Coverage Report</h1>
      </header>

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-lg font-semibold">Probe</h2>
        <p className="mt-2 text-sm">
          Probe: acolyte.grantsFeat ={" "}
          <span className="font-mono">{acolyte?.grantsFeat ?? "null"}</span>
        </p>
        <pre className="mt-3 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(acolyte, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Effect Types</h2>
        <div>
          <div className="text-sm font-semibold">Supported</div>
          <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(report.supportedEffectTypes, null, 2)}
          </pre>
        </div>
        <div>
          <div className="text-sm font-semibold">Used</div>
          <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(report.usedEffectTypes, null, 2)}
          </pre>
        </div>
        <div>
          <div className="text-sm font-semibold">Missing Handlers</div>
          <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(report.missingEffectHandlers, null, 2)}
          </pre>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">RAW 2024 Mechanics Coverage</h2>
        <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(report.raw2024Mechanics, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Origin Feat Evidence</h2>
        <div>
          <div className="text-sm font-semibold">Backgrounds with grantsFeat</div>
          <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(
              report.originFeatEvidence.backgroundsWithGrantsFeat,
              null,
              2,
            )}
          </pre>
        </div>
        <div>
          <div className="text-sm font-semibold">Missing feat ids referenced</div>
          <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
            {JSON.stringify(
              report.originFeatEvidence.missingFeatsReferenced,
              null,
              2,
            )}
          </pre>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Content Counts</h2>
        <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(report.contentUsage, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Warnings</h2>
        <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(report.warnings, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Raw JSON</h2>
        <pre className="mt-1 overflow-auto rounded bg-slate-950 p-3 text-xs">
          {JSON.stringify(report, null, 2)}
        </pre>
      </section>
    </main>
  );
}
