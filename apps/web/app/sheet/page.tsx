import Link from "next/link";
import type { CharacterState } from "@dark-sun/rules";
import { computeDerivedState, validateCharacter } from "@dark-sun/rules";

import { getMergedContent } from "../../src/lib/content";

export const runtime = "nodejs";

type SheetPayload = {
  characterState: CharacterState;
  enabledPackIds: string[];
};

function decodePayload(raw: string | string[] | undefined): SheetPayload | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return null;
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    const decoded = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as Partial<SheetPayload>;
    if (!parsed.characterState || typeof parsed.characterState !== "object") {
      return null;
    }
    return {
      characterState: parsed.characterState as CharacterState,
      enabledPackIds: Array.isArray(parsed.enabledPackIds)
        ? parsed.enabledPackIds.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

const ABILITIES: Array<"str" | "dex" | "con" | "int" | "wis" | "cha"> = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

export default async function SheetPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const payload = decodePayload(params.payload);

  if (!payload) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Character Sheet (HTML)</h1>
        <p className="text-sm text-slate-300">
          Missing payload. Open Builder and use Download PDF to generate a payload-backed sheet URL.
        </p>
        <Link href="/builder" className="text-sm text-sky-300 underline">
          Back to Builder
        </Link>
      </main>
    );
  }

  const merged = await getMergedContent(payload.enabledPackIds);
  const derived = computeDerivedState(payload.characterState, merged.content);
  const validation = validateCharacter(payload.characterState, merged.content);

  const selectedClass = payload.characterState.selectedClassId
    ? merged.content.classesById[payload.characterState.selectedClassId]
    : undefined;
  const selectedSpecies = payload.characterState.selectedSpeciesId
    ? merged.content.speciesById[payload.characterState.selectedSpeciesId]
    : undefined;
  const selectedBackground = payload.characterState.selectedBackgroundId
    ? merged.content.backgroundsById[payload.characterState.selectedBackgroundId]
    : undefined;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Character Sheet (HTML)</h1>
        <p className="text-sm text-slate-300">
          Class: {selectedClass?.name ?? "Unset"} | Species: {selectedSpecies?.name ?? "Unset"} | Background:{" "}
          {selectedBackground?.name ?? "Unset"} | Level: {payload.characterState.level}
        </p>
      </header>

      <section className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Core Stats</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <div>AC: {derived.armorClass}</div>
          <div>HP: {derived.maxHP}</div>
          <div>Speed: {derived.speed}</div>
          <div>Prof: {formatModifier(derived.proficiencyBonus)}</div>
        </div>
      </section>

      <section className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Abilities</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          {ABILITIES.map((ability) => (
            <div key={ability}>
              {ability.toUpperCase()}: {derived.finalAbilities[ability]} ({formatModifier(derived.abilityMods[ability])})
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Attack</h2>
        <p className="mt-2 text-sm">
          {derived.attack
            ? `${derived.attack.name} ${formatModifier(derived.attack.toHit)} (${derived.attack.damage})`
            : "None"}
        </p>
      </section>

      <section className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Feats</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {derived.feats.length === 0 ? <li>None</li> : null}
          {derived.feats.map((feat) => (
            <li key={feat.id}>{feat.name}</li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold">Validation</h2>
        <p className="mt-2 text-sm">Export Ready: {validation.isValidForExport ? "YES" : "NO"}</p>
        {validation.errors.length > 0 ? (
          <ul className="mt-2 list-disc pl-5 text-sm text-rose-300">
            {validation.errors.map((issue, index) => (
              <li key={`error-${index}`}>[{issue.code}] {issue.message}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
