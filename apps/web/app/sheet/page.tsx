import Link from "next/link";
import { getClassFeatureIdsForLevel } from "@dark-sun/content";
import type {
  Ability,
  AttunedItem,
  CharacterState,
  CompanionPlaceholder,
} from "@dark-sun/rules";
import {
  computeDerivedState,
  getSkillAndToolDisplayRows,
  validateCharacter,
} from "@dark-sun/rules";

import { getMergedContent } from "../../src/lib/content";
import { formatSpellNameWithFlags } from "../../src/lib/spells";

export const runtime = "nodejs";

type SheetPayload = {
  characterState: CharacterState;
  enabledPackIds: string[];
};

const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeAttunedItems(value: unknown): AttunedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: AttunedItem[] = [];
  for (const entry of value) {
    if (typeof entry === "string") {
      normalized.push({ name: entry });
      continue;
    }
    if (!isObjectRecord(entry)) {
      continue;
    }
    const name = normalizeOptionalString(entry.name);
    const itemId = normalizeOptionalString(entry.itemId);
    const notes = normalizeOptionalString(entry.notes);
    if (
      typeof name === "undefined" &&
      typeof itemId === "undefined" &&
      typeof notes === "undefined"
    ) {
      continue;
    }
    normalized.push({ name, itemId, notes });
  }

  return normalized;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function normalizeOptionalNonNegativeInt(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeCharacterState(input: CharacterState): CharacterState {
  const coins = isObjectRecord(input.coins) ? input.coins : undefined;

  return {
    ...input,
    chosenSkillProficiencies: Array.isArray(input.chosenSkillProficiencies)
      ? input.chosenSkillProficiencies
      : [],
    chosenSaveProficiencies: Array.isArray(input.chosenSaveProficiencies)
      ? input.chosenSaveProficiencies
      : [],
    knownSpellIds: Array.isArray(input.knownSpellIds) ? input.knownSpellIds : [],
    preparedSpellIds: Array.isArray(input.preparedSpellIds) ? input.preparedSpellIds : [],
    cantripsKnownIds: Array.isArray(input.cantripsKnownIds)
      ? input.cantripsKnownIds
      : [],
    selectedFeats: Array.isArray(input.selectedFeats) ? input.selectedFeats : [],
    selectedFeatureIds: Array.isArray(input.selectedFeatureIds)
      ? input.selectedFeatureIds
      : [],
    abilityIncreases: Array.isArray(input.abilityIncreases) ? input.abilityIncreases : [],
    advancements: Array.isArray(input.advancements) ? input.advancements : [],
    inventoryItemIds: Array.isArray(input.inventoryItemIds) ? input.inventoryItemIds : [],
    inventoryEntries: Array.isArray(input.inventoryEntries) ? input.inventoryEntries : [],
    armorProficiencies: normalizeStringArray(input.armorProficiencies),
    weaponProficiencies: normalizeStringArray(input.weaponProficiencies),
    toolProficiencies: normalizeStringArray(input.toolProficiencies),
    languages: normalizeStringArray(input.languages),
    attunedItems: normalizeAttunedItems(input.attunedItems),
    subclass: normalizeOptionalString(input.subclass),
    xp: normalizeOptionalNonNegativeInt(input.xp),
    heroicInspiration: input.heroicInspiration === true,
    tempHP: normalizeOptionalNonNegativeInt(input.tempHP),
    hitDiceTotal: normalizeOptionalNonNegativeInt(input.hitDiceTotal),
    hitDiceSpent: normalizeOptionalNonNegativeInt(input.hitDiceSpent),
    deathSaveSuccesses: normalizeOptionalNonNegativeInt(input.deathSaveSuccesses),
    deathSaveFailures: normalizeOptionalNonNegativeInt(input.deathSaveFailures),
    exhaustionLevel: normalizeOptionalNonNegativeInt(input.exhaustionLevel),
    otherWealth: normalizeOptionalString(input.otherWealth),
    appearance: normalizeOptionalString(input.appearance),
    physicalDescription: normalizeOptionalString(input.physicalDescription),
    backstory: normalizeOptionalString(input.backstory),
    alignment: normalizeOptionalString(input.alignment),
    notes: normalizeOptionalString(input.notes),
    companion: isObjectRecord(input.companion)
      ? {
          name: normalizeOptionalString(input.companion.name),
          type: normalizeOptionalString(input.companion.type),
          summary: normalizeOptionalString(input.companion.summary),
          notes: normalizeOptionalString(input.companion.notes),
        }
      : undefined,
    familiar: isObjectRecord(input.familiar)
      ? {
          name: normalizeOptionalString(input.familiar.name),
          type: normalizeOptionalString(input.familiar.type),
          summary: normalizeOptionalString(input.familiar.summary),
          notes: normalizeOptionalString(input.familiar.notes),
        }
      : undefined,
    coins: coins
      ? {
          cp: normalizeOptionalNonNegativeInt(coins.cp),
          sp: normalizeOptionalNonNegativeInt(coins.sp),
          ep: normalizeOptionalNonNegativeInt(coins.ep),
          gp: normalizeOptionalNonNegativeInt(coins.gp),
          pp: normalizeOptionalNonNegativeInt(coins.pp),
        }
      : undefined,
  };
}

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
    if (!isObjectRecord(parsed.characterState)) {
      return null;
    }
    return {
      characterState: normalizeCharacterState(parsed.characterState as CharacterState),
      enabledPackIds: Array.isArray(parsed.enabledPackIds)
        ? parsed.enabledPackIds.filter((entry): entry is string => typeof entry === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function sortIds(values: string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function formatSpellSlots(slots: readonly number[] | null | undefined): string {
  if (!slots) {
    return "None";
  }
  return slots.map((count, index) => `L${index + 1}:${count}`).join(" ");
}

function formatMasteryLabel(mastery: string): string {
  return mastery
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConditionLabel(conditionId: string): string {
  return conditionId
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSenseSummary(sense: { type: string; range?: number }): string {
  const typeLabel = sense.type
    .split(/[_\s-]+/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
  return typeof sense.range === "number" ? `${typeLabel} ${sense.range} ft.` : typeLabel;
}

function hasCompanionData(entity: CompanionPlaceholder | undefined): boolean {
  if (!entity) {
    return false;
  }
  return Boolean(
    entity.name?.trim() ||
      entity.type?.trim() ||
      entity.summary?.trim() ||
      entity.notes?.trim(),
  );
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)];
}

export default async function SheetPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const payload = decodePayload(params.payload);

  if (!payload) {
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6 text-slate-900">
        <h1 className="text-2xl font-semibold">Character Sheet (HTML)</h1>
        <p className="text-sm text-slate-700">
          Missing payload. Open Builder and use Open HTML Sheet to generate a
          payload-backed sheet URL.
        </p>
        <Link href="/builder" className="text-sm text-sky-700 underline">
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
  const armor = payload.characterState.equippedArmorId
    ? merged.content.equipmentById[payload.characterState.equippedArmorId]
    : undefined;
  const shield = payload.characterState.equippedShieldId
    ? merged.content.equipmentById[payload.characterState.equippedShieldId]
    : undefined;
  const weapon = payload.characterState.equippedWeaponId
    ? merged.content.equipmentById[payload.characterState.equippedWeaponId]
    : undefined;

  const level = Math.max(1, Math.floor(payload.characterState.level || 1));
  const xp = Number.isFinite(payload.characterState.xp)
    ? Math.max(0, Math.floor(payload.characterState.xp ?? 0))
    : 0;
  const tempHP = Number.isFinite(payload.characterState.tempHP)
    ? Math.max(0, Math.floor(payload.characterState.tempHP ?? 0))
    : 0;
  const hitDiceTotal = Number.isFinite(payload.characterState.hitDiceTotal)
    ? Math.max(0, Math.floor(payload.characterState.hitDiceTotal ?? 0))
    : null;
  const hitDiceSpent = Number.isFinite(payload.characterState.hitDiceSpent)
    ? Math.max(0, Math.floor(payload.characterState.hitDiceSpent ?? 0))
    : 0;
  const deathSaveSuccesses = Number.isFinite(payload.characterState.deathSaveSuccesses)
    ? Math.max(0, Math.min(3, Math.floor(payload.characterState.deathSaveSuccesses ?? 0)))
    : 0;
  const deathSaveFailures = Number.isFinite(payload.characterState.deathSaveFailures)
    ? Math.max(0, Math.min(3, Math.floor(payload.characterState.deathSaveFailures ?? 0)))
    : 0;
  const exhaustionLevel = Number.isFinite(payload.characterState.exhaustionLevel)
    ? Math.max(0, Math.min(10, Math.floor(payload.characterState.exhaustionLevel ?? 0)))
    : 0;

  const coinValues = payload.characterState.coins ?? {};
  const cpCoins = Number.isFinite(coinValues.cp)
    ? Math.max(0, Math.floor(coinValues.cp ?? 0))
    : 0;
  const spCoins = Number.isFinite(coinValues.sp)
    ? Math.max(0, Math.floor(coinValues.sp ?? 0))
    : 0;
  const epCoins = Number.isFinite(coinValues.ep)
    ? Math.max(0, Math.floor(coinValues.ep ?? 0))
    : 0;
  const gpCoins = Number.isFinite(coinValues.gp)
    ? Math.max(0, Math.floor(coinValues.gp ?? 0))
    : 0;
  const ppCoins = Number.isFinite(coinValues.pp)
    ? Math.max(0, Math.floor(coinValues.pp ?? 0))
    : 0;

  const inventoryCounts = new Map<string, number>();
  for (const itemId of payload.characterState.inventoryItemIds ?? []) {
    inventoryCounts.set(itemId, (inventoryCounts.get(itemId) ?? 0) + 1);
  }
  for (const entry of payload.characterState.inventoryEntries ?? []) {
    const quantity =
      typeof entry.quantity === "number" && Number.isFinite(entry.quantity)
        ? Math.max(1, Math.floor(entry.quantity))
        : 1;
    inventoryCounts.set(entry.itemId, Math.max(quantity, inventoryCounts.get(entry.itemId) ?? 0));
  }

  const inventoryItems = [...inventoryCounts.entries()]
    .map(([itemId, quantity]) => {
      const label = merged.content.equipmentById[itemId]?.name ?? itemId;
      return quantity > 1 ? `${label} x${quantity}` : label;
    })
    .sort((a, b) => a.localeCompare(b));

  const attunedItems = (payload.characterState.attunedItems ?? [])
    .map((item) => item.name?.trim() || item.itemId?.trim() || "")
    .filter((entry) => entry.length > 0);

  const skillAndToolRows = getSkillAndToolDisplayRows({
    skillDefinitions: merged.content.skillDefinitions,
    skills: derived.skills,
    toolProficiencies: derived.toolProficiencies,
  });

  const saveProficiencies = new Set(derived.saveProficiencies ?? []);
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellcastingModifier = spellcastingAbility ? derived.abilityMods[spellcastingAbility] : null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const shieldAC = payload.characterState.equippedShieldId ? 2 : 0;

  const knownSpellIds = derived.spellcasting?.knownSpellIds ?? sortIds(payload.characterState.knownSpellIds);
  const preparedSpellIds =
    derived.spellcasting?.preparedSpellIds ?? sortIds(payload.characterState.preparedSpellIds);
  const cantripIds =
    derived.spellcasting?.cantripsKnownIds ?? sortIds(payload.characterState.cantripsKnownIds);
  const knownSpellNames = knownSpellIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const preparedSpellNames = preparedSpellIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const cantripNames = cantripIds.map((id) => {
    const spell = merged.content.spellsById[id];
    return spell ? formatSpellNameWithFlags(spell) : id;
  });
  const spellListRefs = dedupeStrings([
    ...(selectedClass?.spellListRefIds ?? []),
    ...(selectedClass?.spellListRefs ?? []),
  ]);

  const classFeatureNames = selectedClass
    ? getClassFeatureIdsForLevel(selectedClass, level).map(
        (featureId) => merged.content.featuresById[featureId]?.name ?? featureId,
      )
    : [];
  const selectedFeatureNames = (payload.characterState.selectedFeatureIds ?? [])
    .map((featureId) => merged.content.featuresById[featureId]?.name ?? featureId)
    .filter((entry) => entry.length > 0);

  const speciesTraits = dedupeStrings([
    ...derived.senses.map((sense) => `Sense: ${formatSenseSummary(sense)}`),
    ...(derived.resistances.length > 0
      ? [`Resistances: ${derived.resistances.join(", ")}`]
      : []),
    ...derived.traits.map((trait) => `Trait: ${trait}`),
  ]);

  const activeConditionLabels = (derived.activeConditionIds ?? []).map((conditionId) =>
    formatConditionLabel(conditionId),
  );
  const activeModifierLabels = (derived.appliedModifiers ?? []).map((modifier) => {
    const effectSummary = modifier.effects
      .map((effect) => {
        if (effect.type === "add_speed") {
          const sign = effect.value >= 0 ? "+" : "";
          return `${sign}${effect.value} ft speed`;
        }
        return effect.type;
      })
      .join(", ");
    return effectSummary.length > 0
      ? `${modifier.label} (${effectSummary})`
      : modifier.label;
  });

  const attackRows: Array<{
    name: string;
    bonus: string;
    damage: string;
    notes: string;
  }> = [];
  if (derived.attack) {
    attackRows.push({
      name: derived.attack.name,
      bonus: formatModifier(derived.attack.toHit),
      damage: derived.attack.damage,
      notes:
        derived.attack.mastery && derived.attack.mastery.length > 0
          ? `Mastery: ${derived.attack.mastery.map((mastery) => formatMasteryLabel(mastery)).join(", ")}`
          : "",
    });
  } else if (weapon) {
    attackRows.push({
      name: weapon.name,
      bonus: "-",
      damage: weapon.damageDice ?? "-",
      notes: "No resolved attack bonus",
    });
  }
  while (attackRows.length < 3) {
    attackRows.push({ name: "", bonus: "", damage: "", notes: "" });
  }

  const hasCompanion = hasCompanionData(payload.characterState.companion);
  const hasFamiliar = hasCompanionData(payload.characterState.familiar);
  const showCompanionSection = hasCompanion || hasFamiliar;

  return (
    <main className="min-h-screen bg-slate-300 px-3 py-6 text-slate-950">
      <article className="mx-auto max-w-7xl overflow-hidden rounded border-2 border-slate-900 bg-white shadow-2xl">
        <header className="border-b-2 border-slate-900 px-4 py-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-wide">Character Sheet (HTML)</h1>
              <p className="text-xs text-slate-600">
                Payload-backed developer sheet aligned to 5E 2024 section structure.
              </p>
            </div>
            <div className="text-xs text-slate-600">
              Packs: {payload.enabledPackIds.join(", ") || "(none)"}
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded border border-slate-900 p-2 md:col-span-2 xl:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Character Name</div>
              <div className="pt-3 text-base font-semibold leading-none text-slate-700">
                ______________________________
              </div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Class</div>
              <div className="font-semibold">{selectedClass?.name ?? "Unset"}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Subclass</div>
              <div className="font-semibold">{payload.characterState.subclass ?? "-"}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Background</div>
              <div className="font-semibold">{selectedBackground?.name ?? "Unset"}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Species</div>
              <div className="font-semibold">{selectedSpecies?.name ?? "Unset"}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Level</div>
              <div className="font-semibold">{level}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">XP</div>
              <div className="font-semibold">{xp}</div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Inspiration</div>
              <div className="font-semibold">
                {payload.characterState.heroicInspiration ? "Yes" : "No"}
              </div>
            </div>
            <div className="rounded border border-slate-900 p-2">
              <div className="text-[11px] uppercase tracking-[0.08em] text-slate-600">Alignment</div>
              <div className="font-semibold">{payload.characterState.alignment || "-"}</div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Abilities
              </h2>
              <div className="grid gap-2 p-2">
                {ABILITIES.map((ability) => (
                  <div
                    key={ability}
                    className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-900 p-2"
                  >
                    <div>
                      <div className="text-xs font-semibold tracking-wide">
                        {ABILITY_LABELS[ability]}
                      </div>
                      <div className="text-[11px] text-slate-700">
                        Score {derived.finalAbilities[ability]}
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full border border-slate-900 text-center text-lg font-bold leading-10">
                      {formatModifier(derived.abilityMods[ability])}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Saving Throws
              </h2>
              <div className="space-y-1 p-2 text-sm">
                {ABILITIES.map((ability) => (
                  <div key={`save-${ability}`} className="flex items-center justify-between">
                    <span>
                      {saveProficiencies.has(ability) ? "* " : "- "}
                      {ABILITY_LABELS[ability]}
                    </span>
                    <span className="font-semibold">
                      {formatModifier(derived.savingThrows[ability])}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Skills & Tool Proficiencies
              </h2>
              <div className="max-h-[460px] overflow-auto p-2">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {skillAndToolRows.map((row) => (
                      <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-200">
                        <td className="py-1 pr-2">
                          <span className="mr-2 text-[10px] uppercase tracking-wide text-slate-500">
                            {row.kind === "skill" ? "Skill" : "Tool"}
                          </span>
                          {row.label}
                        </td>
                        <td className="py-1 text-right font-semibold">
                          {row.kind === "skill" ? formatModifier(row.value) : "Proficient"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Core Stats & Combat Summary
              </h2>
              <div className="grid grid-cols-2 gap-2 p-2 text-sm md:grid-cols-3">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Armor Class
                  </div>
                  <div className="text-lg font-bold">{derived.armorClass}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Shield AC</div>
                  <div className="text-lg font-bold">{shieldAC}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Initiative</div>
                  <div className="text-lg font-bold">{formatModifier(derived.abilityMods.dex)}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Speed</div>
                  <div className="text-lg font-bold">{derived.speed} ft</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Proficiency</div>
                  <div className="text-lg font-bold">
                    {formatModifier(derived.proficiencyBonus)}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Passive Perception
                  </div>
                  <div className="text-lg font-bold">{derived.passivePerception}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                HP / Temp HP / Hit Dice / Death Saves
              </h2>
              <div className="grid grid-cols-2 gap-2 p-2 text-sm">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Max HP</div>
                  <div className="text-lg font-bold">{derived.maxHP}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Current HP
                  </div>
                  <div className="text-lg font-bold">_____</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Temp HP</div>
                  <div className="text-lg font-bold">{tempHP}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Hit Dice</div>
                  <div className="text-lg font-bold">
                    {hitDiceSpent}/{hitDiceTotal ?? "-"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Death Save Successes
                  </div>
                  <div className="text-lg font-bold">{deathSaveSuccesses}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Death Save Failures
                  </div>
                  <div className="text-lg font-bold">{deathSaveFailures}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Weapons / Attacks
              </h2>
              <div className="p-2">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-600">
                      <th className="py-1 pr-2">Name</th>
                      <th className="py-1 pr-2 text-right">Bonus</th>
                      <th className="py-1 pr-2">Damage</th>
                      <th className="py-1">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attackRows.map((attack, index) => (
                      <tr key={`attack-row-${index}`} className="border-b border-slate-200">
                        <td className="py-1 pr-2">{attack.name}</td>
                        <td className="py-1 pr-2 text-right font-semibold">{attack.bonus}</td>
                        <td className="py-1 pr-2">{attack.damage}</td>
                        <td className="py-1">{attack.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Spellcasting Summary
              </h2>
              <div className="grid gap-2 p-2 text-sm sm:grid-cols-2">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Spellcasting Ability
                  </div>
                  <div className="font-semibold">
                    {spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "None"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Mode</div>
                  <div className="font-semibold">{selectedClass?.spellcasting?.mode ?? "None"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Spellcasting Modifier
                  </div>
                  <div className="font-semibold">
                    {spellcastingModifier !== null ? formatModifier(spellcastingModifier) : "-"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Spell Save DC
                  </div>
                  <div className="font-semibold">{spellSaveDC ?? "-"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Spell Attack Bonus
                  </div>
                  <div className="font-semibold">
                    {spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "-"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Slots</div>
                  <div className="font-semibold">{formatSpellSlots(spellSlots)}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Spell List Summary
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Cantrips</div>
                  <div>{cantripNames.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Known</div>
                  <div>{knownSpellNames.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Prepared</div>
                  <div>{preparedSpellNames.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Class Spell Lists
                  </div>
                  <div>{spellListRefs.join(", ") || "None"}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-3">
            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Equipment / Inventory
              </h2>
              <ul className="space-y-1 p-2 text-sm">
                <li>Armor: {armor?.name ?? "None"}</li>
                <li>Shield: {shield?.name ?? "None"}</li>
                <li>Weapon: {weapon?.name ?? "None"}</li>
                <li>Attuned Items: {attunedItems.join(", ") || "None"}</li>
                <li>Other Wealth: {payload.characterState.otherWealth || "None"}</li>
                <li>Inventory: {inventoryItems.join(", ") || "None"}</li>
              </ul>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Currency
              </h2>
              <div className="grid grid-cols-5 gap-2 p-2 text-center text-sm">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">CP</div>
                  <div className="font-semibold">{cpCoins}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">SP</div>
                  <div className="font-semibold">{spCoins}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">EP</div>
                  <div className="font-semibold">{epCoins}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">GP</div>
                  <div className="font-semibold">{gpCoins}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">PP</div>
                  <div className="font-semibold">{ppCoins}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Armor / Weapon / Tool / Language Proficiencies
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Armor</div>
                  <div>{payload.characterState.armorProficiencies?.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Weapons</div>
                  <div>{payload.characterState.weaponProficiencies?.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Tools</div>
                  <div>{derived.toolProficiencies.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Languages</div>
                  <div>{derived.languages.join(", ") || "None"}</div>
                </div>
              </div>
            </section>

            <section className="rounded border-2 border-slate-900">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Conditions / Exhaustion
              </h2>
              <div className="space-y-2 p-2 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Exhaustion Level
                  </div>
                  <div className="font-semibold">{exhaustionLevel}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Active Conditions
                  </div>
                  <div>{activeConditionLabels.join(", ") || "None"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Applied Modifiers
                  </div>
                  <div>{activeModifierLabels.join(" | ") || "None"}</div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-3 border-t-2 border-slate-900 p-4 lg:grid-cols-2">
          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Class Features
            </h2>
            <div className="space-y-2 p-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">
                  Features By Class Level
                </div>
                {classFeatureNames.length === 0 ? (
                  <p>None</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {classFeatureNames.map((name) => (
                      <li key={`class-feature-${name}`}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">
                  Additional Selected Features
                </div>
                {selectedFeatureNames.length === 0 ? (
                  <p>None</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {selectedFeatureNames.map((name) => (
                      <li key={`selected-feature-${name}`}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Species Traits
            </h2>
            <div className="space-y-2 p-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Species</div>
                <div>{selectedSpecies?.name ?? "Unset"}</div>
              </div>
              {selectedSpecies?.description ? (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">
                    Description
                  </div>
                  <div>{selectedSpecies.description}</div>
                </div>
              ) : null}
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">
                  Derived Trait Entries
                </div>
                {speciesTraits.length === 0 ? (
                  <p>None</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {speciesTraits.map((entry) => (
                      <li key={`species-trait-${entry}`}>{entry}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Feats
            </h2>
            {derived.feats.length === 0 ? (
              <p className="p-2 text-sm">None</p>
            ) : (
              <ul className="list-disc space-y-1 p-2 pl-7 text-sm">
                {derived.feats.map((feat) => (
                  <li key={feat.id}>{feat.name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Narrative
            </h2>
            <div className="space-y-2 p-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Alignment</div>
                <div>{payload.characterState.alignment || "None"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Appearance</div>
                <div>{payload.characterState.appearance || "None"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">
                  Physical Description
                </div>
                <div>{payload.characterState.physicalDescription || "None"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Backstory</div>
                <div>{payload.characterState.backstory || "None"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Notes</div>
                <div>{payload.characterState.notes || "None"}</div>
              </div>
            </div>
          </section>

          {showCompanionSection ? (
            <section className="rounded border-2 border-slate-900 lg:col-span-2">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Companion Placeholder
              </h2>
              <div className="grid gap-3 p-2 text-sm md:grid-cols-2">
                {hasCompanion ? (
                  <div className="rounded border border-slate-900 p-2">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Companion
                    </div>
                    <div>Name: {payload.characterState.companion?.name || "-"}</div>
                    <div>Type: {payload.characterState.companion?.type || "-"}</div>
                    <div>Summary: {payload.characterState.companion?.summary || "-"}</div>
                    <div>Notes: {payload.characterState.companion?.notes || "-"}</div>
                  </div>
                ) : null}
                {hasFamiliar ? (
                  <div className="rounded border border-slate-900 p-2">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      Familiar
                    </div>
                    <div>Name: {payload.characterState.familiar?.name || "-"}</div>
                    <div>Type: {payload.characterState.familiar?.type || "-"}</div>
                    <div>Summary: {payload.characterState.familiar?.summary || "-"}</div>
                    <div>Notes: {payload.characterState.familiar?.notes || "-"}</div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="rounded border-2 border-slate-900 lg:col-span-2">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Validation
            </h2>
            <div className="space-y-2 p-2 text-sm">
              <div className="font-semibold">
                Export Ready: {validation.isValidForExport ? "YES" : "NO"}
              </div>
              {validation.errors.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-rose-700">
                  {validation.errors.map((issue, index) => (
                    <li key={`error-${index}`}>
                      [{issue.code}] {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {validation.warnings.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-amber-700">
                  {validation.warnings.map((issue, index) => (
                    <li key={`warning-${index}`}>
                      [{issue.code}] {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="border-t-2 border-slate-900 bg-slate-100 px-4 py-2 text-xs">
          <Link href="/builder" className="underline">
            Back to Builder
          </Link>
        </footer>
      </article>
    </main>
  );
}
