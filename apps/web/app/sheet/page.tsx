import Link from "next/link";
import { getClassFeatureIdsForLevel, getSubclassFeatureIdsForLevel } from "@dark-sun/content";
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

const DEFAULT_SKILL_ABILITY_BY_ID: Record<string, Ability> = {
  athletics: "str",
  acrobatics: "dex",
  sleight_of_hand: "dex",
  stealth: "dex",
  arcana: "int",
  history: "int",
  investigation: "int",
  nature: "int",
  religion: "int",
  animal_handling: "wis",
  insight: "wis",
  medicine: "wis",
  perception: "wis",
  survival: "wis",
  deception: "cha",
  intimidation: "cha",
  performance: "cha",
  persuasion: "cha",
};

const STANDARD_CONDITION_LABELS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

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

function normalizeOptionalNonNegativeInt(
  value: unknown,
  maximum?: number
): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const bounded = Math.max(0, Math.floor(parsed));
  if (typeof maximum === "number") {
    return Math.min(maximum, bounded);
  }
  return bounded;
}

function normalizeWarlockMysticArcanumByLevel(
  value: unknown,
): Partial<Record<6 | 7 | 8 | 9, string>> {
  if (!isObjectRecord(value)) {
    return {};
  }
  const out: Partial<Record<6 | 7 | 8 | 9, string>> = {};
  for (const [key, spellId] of Object.entries(value)) {
    const tier = Number(key);
    if ((tier !== 6 && tier !== 7 && tier !== 8 && tier !== 9) || typeof spellId !== "string") {
      continue;
    }
    if (spellId.length > 0) {
      out[tier] = spellId;
    }
  }
  return out;
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
    warlockInvocationFeatureIds: Array.isArray(input.warlockInvocationFeatureIds)
      ? input.warlockInvocationFeatureIds.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
    warlockPactBoonFeatureId: normalizeOptionalString(input.warlockPactBoonFeatureId),
    warlockMysticArcanumByLevel: normalizeWarlockMysticArcanumByLevel(
      input.warlockMysticArcanumByLevel,
    ),
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
    deathSaveSuccesses: normalizeOptionalNonNegativeInt(input.deathSaveSuccesses, 3),
    deathSaveFailures: normalizeOptionalNonNegativeInt(input.deathSaveFailures, 3),
    exhaustionLevel: normalizeOptionalNonNegativeInt(input.exhaustionLevel, 10),
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
  const selectedSubclass = payload.characterState.subclass
    ? merged.content.subclassesById?.[payload.characterState.subclass]
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

  const inventoryRows = [...inventoryCounts.entries()]
    .map(([itemId, quantity]) => ({
      itemId,
      quantity,
      label: merged.content.equipmentById[itemId]?.name ?? itemId,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  const attunedItems = (payload.characterState.attunedItems ?? [])
    .map((item) => {
      const name = item.name?.trim() ?? "";
      const itemId = item.itemId?.trim() ?? "";
      if (name && itemId) {
        return `${name} (${itemId})`;
      }
      return name || itemId || item.notes?.trim() || "";
    })
    .filter((entry) => entry.length > 0);

  const skillAndToolRows = getSkillAndToolDisplayRows({
    skillDefinitions: merged.content.skillDefinitions,
    skills: derived.skills,
    toolProficiencies: derived.toolProficiencies,
  });
  const skillRows = skillAndToolRows.flatMap((row) => (row.kind === "skill" ? [row] : []));
  const proficientToolRows = skillAndToolRows.flatMap((row) => (row.kind === "tool" ? [row] : []));
  const skillProficiencySet = new Set(derived.skillProficiencies ?? []);
  const skillAbilityById = new Map<string, Ability>(
    Object.entries(DEFAULT_SKILL_ABILITY_BY_ID) as Array<[string, Ability]>,
  );
  for (const definition of merged.content.skillDefinitions ?? []) {
    if (!definition || typeof definition.id !== "string" || definition.id.length === 0) {
      continue;
    }
    if (ABILITIES.includes(definition.ability as Ability)) {
      skillAbilityById.set(definition.id, definition.ability as Ability);
    }
  }

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
    ...(selectedSubclass?.spellListRefIds ?? []),
    ...(selectedSubclass?.spellListRefs ?? []),
  ]);

  const classFeatureNames = selectedClass
    ? getClassFeatureIdsForLevel(selectedClass, level).map(
        (featureId) => merged.content.featuresById[featureId]?.name ?? featureId,
      )
    : [];
  const subclassFeatureNames =
    selectedSubclass && selectedClass && selectedSubclass.classId === selectedClass.id
      ? getSubclassFeatureIdsForLevel(selectedSubclass, level).map(
          (featureId) => merged.content.featuresById[featureId]?.name ?? featureId,
        )
      : [];
  const progressionFeatureNames = dedupeStrings([...classFeatureNames, ...subclassFeatureNames]);
  const selectedFeatureNames = dedupeStrings([
    ...(payload.characterState.selectedFeatureIds ?? []),
    ...(payload.characterState.warlockInvocationFeatureIds ?? []),
    ...(payload.characterState.warlockPactBoonFeatureId
      ? [payload.characterState.warlockPactBoonFeatureId]
      : []),
  ])
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

  const characterStateWithOptionalIdentity = payload.characterState as CharacterState & {
    characterName?: unknown;
    name?: unknown;
    playerName?: unknown;
    player?: unknown;
    campaignName?: unknown;
    campaign?: unknown;
    currentHP?: unknown;
    currentHp?: unknown;
    currentHitPoints?: unknown;
  };
  const rawCharacterName =
    normalizeOptionalString(characterStateWithOptionalIdentity.characterName) ??
    normalizeOptionalString(characterStateWithOptionalIdentity.name);
  const rawPlayerName =
    normalizeOptionalString(characterStateWithOptionalIdentity.playerName) ??
    normalizeOptionalString(characterStateWithOptionalIdentity.player);
  const rawCampaignName =
    normalizeOptionalString(characterStateWithOptionalIdentity.campaignName) ??
    normalizeOptionalString(characterStateWithOptionalIdentity.campaign);
  const characterName = rawCharacterName?.trim() || "______________________________";
  const playerName = rawPlayerName?.trim() || "-";
  const campaignName = rawCampaignName?.trim() || "-";
  const currentHP = normalizeOptionalNonNegativeInt(
    characterStateWithOptionalIdentity.currentHP ??
      characterStateWithOptionalIdentity.currentHp ??
      characterStateWithOptionalIdentity.currentHitPoints,
  );
  const hitDiceRemaining =
    typeof hitDiceTotal === "number" ? Math.max(0, hitDiceTotal - hitDiceSpent) : null;

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
  }
  if (weapon && (!derived.attack || derived.attack.name !== weapon.name)) {
    attackRows.push({
      name: weapon.name,
      bonus: "-",
      damage: weapon.damageDice ?? "-",
      notes: "No resolved attack bonus",
    });
  }
  for (const cantripName of cantripNames.slice(0, 2)) {
    attackRows.push({
      name: `Cantrip: ${cantripName}`,
      bonus: spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "-",
      damage: "See spell",
      notes: "Spell attack or save cantrip",
    });
  }
  while (attackRows.length < 6) {
    attackRows.push({ name: "", bonus: "", damage: "", notes: "" });
  }

  const spellSlotRows = Array.from({ length: 9 }, (_, index) => ({
    level: index + 1,
    total: spellSlots ? (spellSlots[index] ?? 0) : 0,
  }));
  const hasSpellSlots = spellSlotRows.some((slotRow) => slotRow.total > 0);
  const armorProficiencies = dedupeStrings(payload.characterState.armorProficiencies ?? []);
  const weaponProficiencies = dedupeStrings(payload.characterState.weaponProficiencies ?? []);
  const toolProficiencies = dedupeStrings(derived.toolProficiencies);
  const languageProficiencies = dedupeStrings(derived.languages);
  const activeConditionSet = new Set(activeConditionLabels.map((condition) => condition.toLowerCase()));
  const conditionRows = STANDARD_CONDITION_LABELS.map((label) => ({
    label,
    active: activeConditionSet.has(label.toLowerCase()),
  }));
  const allClassFeatures = dedupeStrings([
    ...classFeatureNames,
    ...subclassFeatureNames,
    ...selectedFeatureNames,
  ]);

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
            <div className="text-xs text-slate-600">Packs: {payload.enabledPackIds.join(", ") || "(none)"}</div>
          </div>
        </header>

        <div className="space-y-4 p-4">
          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Identity Header
            </h2>
            <div className="grid gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded border border-slate-900 p-2 sm:col-span-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Character Name</div>
                  <div className="text-base font-semibold leading-tight">{characterName}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Class</div>
                  <div className="font-semibold">{selectedClass?.name ?? "Unset"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Subclass</div>
                  <div className="font-semibold">{selectedSubclass?.name ?? payload.characterState.subclass ?? "-"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Background</div>
                  <div className="font-semibold">{selectedBackground?.name ?? "Unset"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Species</div>
                  <div className="font-semibold">{selectedSpecies?.name ?? "Unset"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Player</div>
                  <div className="font-semibold">{playerName}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Campaign</div>
                  <div className="font-semibold">{campaignName}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Level</div>
                  <div className="text-lg font-bold">{level}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">XP</div>
                  <div className="text-lg font-bold">{xp}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Armor Class</div>
                  <div className="text-lg font-bold">{derived.armorClass}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">HP (Current / Max)</div>
                  <div className="text-lg font-bold">
                    {typeof currentHP === "number" ? currentHP : "___"} / {derived.maxHP}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Hit Dice (Spent / Max)</div>
                  <div className="text-lg font-bold">
                    {hitDiceSpent}/{hitDiceTotal ?? "-"}
                  </div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Death Saves (S / F)</div>
                  <div className="text-lg font-bold">
                    {deathSaveSuccesses} / {deathSaveFailures}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded border-2 border-slate-900">
            <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
              Combat Summary
            </h2>
            <div className="grid gap-2 p-2 text-sm md:grid-cols-6">
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Initiative</div>
                <div className="text-lg font-bold">{formatModifier(derived.abilityMods.dex)}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Speed</div>
                <div className="text-lg font-bold">{derived.speed} ft</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Prof Bonus</div>
                <div className="text-lg font-bold">{formatModifier(derived.proficiencyBonus)}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Passive Perception</div>
                <div className="text-lg font-bold">{derived.passivePerception}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Heroic Inspiration</div>
                <div className="text-lg font-bold">{payload.characterState.heroicInspiration ? "Yes" : "No"}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Alignment</div>
                <div className="text-lg font-bold">{payload.characterState.alignment || "-"}</div>
              </div>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)_340px]">
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
                        <div className="text-xs font-semibold tracking-wide">{ABILITY_LABELS[ability]}</div>
                        <div className="text-[11px] text-slate-700">Score {derived.finalAbilities[ability]}</div>
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
                        {saveProficiencies.has(ability) ? "● " : "○ "}
                        {ABILITY_LABELS[ability]}
                      </span>
                      <span className="font-semibold">{formatModifier(derived.savingThrows[ability])}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded border-2 border-slate-900">
                <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Skills & Proficiency Rows
                </h2>
                <div className="max-h-[560px] overflow-auto p-2">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-600">
                        <th className="py-1 pr-2">Prof</th>
                        <th className="py-1 pr-2">Skill / Tool</th>
                        <th className="py-1 pr-2">Ability</th>
                        <th className="py-1 text-right">Bonus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillRows.map((row) => {
                        const skillAbility = skillAbilityById.get(row.id);
                        return (
                          <tr key={`skill-${row.id}`} className="border-b border-slate-200">
                            <td className="py-1 pr-2">{skillProficiencySet.has(row.id) ? "●" : "○"}</td>
                            <td className="py-1 pr-2">{row.label}</td>
                            <td className="py-1 pr-2 text-slate-600">
                              {skillAbility ? ABILITY_LABELS[skillAbility] : "-"}
                            </td>
                            <td className="py-1 text-right font-semibold">{formatModifier(row.value)}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-b border-slate-300 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-600">
                        <td className="py-1 pr-2">-</td>
                        <td className="py-1 pr-2" colSpan={3}>
                          Proficient Tool Rows
                        </td>
                      </tr>
                      {proficientToolRows.length === 0 ? (
                        <tr className="border-b border-slate-200">
                          <td className="py-1 pr-2">○</td>
                          <td className="py-1 pr-2">No tool proficiencies</td>
                          <td className="py-1 pr-2 text-slate-600">-</td>
                          <td className="py-1 text-right">-</td>
                        </tr>
                      ) : (
                        proficientToolRows.map((row) => (
                          <tr key={`tool-${row.id}`} className="border-b border-slate-200">
                            <td className="py-1 pr-2">●</td>
                            <td className="py-1 pr-2">{row.label}</td>
                            <td className="py-1 pr-2 text-slate-600">Tool</td>
                            <td className="py-1 text-right font-semibold">Proficient</td>
                          </tr>
                        ))
                      )}
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
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Armor Class</div>
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
                    <div className="text-lg font-bold">{formatModifier(derived.proficiencyBonus)}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Passive Perception</div>
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
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Current HP</div>
                    <div className="text-lg font-bold">{typeof currentHP === "number" ? currentHP : "_____"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Temp HP</div>
                    <div className="text-lg font-bold">{tempHP}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Hit Dice Remaining</div>
                    <div className="text-lg font-bold">{hitDiceRemaining ?? "-"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Death Save Successes</div>
                    <div className="text-lg font-bold">{deathSaveSuccesses}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Death Save Failures</div>
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
                  Class Features
                </h2>
                <div className="space-y-2 p-2 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Features By Class Level</div>
                    {progressionFeatureNames.length === 0 ? (
                      <p>None</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5">
                        {progressionFeatureNames.map((name) => (
                          <li key={`class-feature-${name}`}>{name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Selected / Combined</div>
                    {allClassFeatures.length === 0 ? (
                      <p>None</p>
                    ) : (
                      <ul className="list-disc space-y-1 pl-5">
                        {allClassFeatures.map((name) => (
                          <li key={`all-feature-${name}`}>{name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-3">
              <section className="rounded border-2 border-slate-900">
                <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Spellcasting Summary
                </h2>
                <div className="grid gap-2 p-2 text-sm sm:grid-cols-2">
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spellcasting Ability</div>
                    <div className="font-semibold">{spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "None"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Mode</div>
                    <div className="font-semibold">{selectedClass?.spellcasting?.mode ?? "None"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spellcasting Modifier</div>
                    <div className="font-semibold">{spellcastingModifier !== null ? formatModifier(spellcastingModifier) : "-"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Save DC</div>
                    <div className="font-semibold">{spellSaveDC ?? "-"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Attack Bonus</div>
                    <div className="font-semibold">{spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "-"}</div>
                  </div>
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Slot Summary</div>
                    <div className="font-semibold">{formatSpellSlots(spellSlots)}</div>
                  </div>
                </div>
                <div className="p-2 pt-0">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-600">
                        <th className="py-1 pr-2">Level</th>
                        <th className="py-1 pr-2 text-right">Slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spellSlotRows.map((row) => (
                        <tr key={`slot-row-${row.level}`} className="border-b border-slate-200">
                          <td className="py-1 pr-2">{row.level}</td>
                          <td className="py-1 pr-2 text-right font-semibold">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!hasSpellSlots ? (
                    <p className="pt-2 text-[11px] text-slate-600">No class spell slots at this level.</p>
                  ) : null}
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
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Class Spell Lists</div>
                    <div>{spellListRefs.join(", ") || "None"}</div>
                  </div>
                </div>
              </section>

              <section className="rounded border-2 border-slate-900">
                <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Equipment / Inventory
                </h2>
                <div className="space-y-2 p-2 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-slate-900 p-2">Armor: {armor?.name ?? "None"}</div>
                    <div className="rounded border border-slate-900 p-2">Shield: {shield?.name ?? "None"}</div>
                    <div className="rounded border border-slate-900 p-2 sm:col-span-2">
                      Weapon: {weapon?.name ?? "None"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Attuned Items</div>
                    <div>{attunedItems.join(", ") || "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Other Wealth</div>
                    <div>{payload.characterState.otherWealth || "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Inventory Rows</div>
                    {inventoryRows.length === 0 ? (
                      <p>None</p>
                    ) : (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-600">
                            <th className="py-1 pr-2">Qty</th>
                            <th className="py-1 pr-2">Item</th>
                            <th className="py-1">ID</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryRows.map((row) => (
                            <tr key={`inventory-${row.itemId}`} className="border-b border-slate-200">
                              <td className="py-1 pr-2">{row.quantity}</td>
                              <td className="py-1 pr-2">{row.label}</td>
                              <td className="py-1 text-slate-600">{row.itemId}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
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
                    <div>{armorProficiencies.join(", ") || "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Weapons</div>
                    <div>{weaponProficiencies.join(", ") || "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Tools</div>
                    <div>{toolProficiencies.join(", ") || "None"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Languages</div>
                    <div>{languageProficiencies.join(", ") || "None"}</div>
                  </div>
                </div>
              </section>

              <section className="rounded border-2 border-slate-900">
                <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Conditions / Exhaustion
                </h2>
                <div className="space-y-2 p-2 text-sm">
                  <div className="rounded border border-slate-900 p-2">
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Exhaustion Level</div>
                    <div className="text-lg font-bold">{exhaustionLevel}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Active Conditions</div>
                    <div>{activeConditionLabels.join(", ") || "None"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {conditionRows.map((row) => (
                      <div key={`condition-${row.label}`} className="flex items-center justify-between border-b border-slate-200 py-0.5">
                        <span>{row.label}</span>
                        <span>{row.active ? "●" : "○"}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Applied Modifiers</div>
                    <div>{activeModifierLabels.join(" | ") || "None"}</div>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div className="grid gap-3 border-t-2 border-slate-900 pt-4 lg:grid-cols-2">
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
                    <div className="text-[11px] uppercase tracking-wide text-slate-600">Description</div>
                    <div>{selectedSpecies.description}</div>
                  </div>
                ) : null}
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Derived Trait Entries</div>
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

            <section className="rounded border-2 border-slate-900 lg:col-span-2">
              <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                Narrative
              </h2>
              <div className="grid gap-2 p-2 text-sm md:grid-cols-2">
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Appearance</div>
                  <div className="whitespace-pre-wrap">{payload.characterState.appearance || "None"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Physical Description</div>
                  <div className="whitespace-pre-wrap">{payload.characterState.physicalDescription || "None"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Backstory</div>
                  <div className="whitespace-pre-wrap">{payload.characterState.backstory || "None"}</div>
                </div>
                <div className="rounded border border-slate-900 p-2">
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Notes</div>
                  <div className="whitespace-pre-wrap">{payload.characterState.notes || "None"}</div>
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
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Companion</div>
                      <div>Name: {payload.characterState.companion?.name || "-"}</div>
                      <div>Type: {payload.characterState.companion?.type || "-"}</div>
                      <div>Summary: {payload.characterState.companion?.summary || "-"}</div>
                      <div>Notes: {payload.characterState.companion?.notes || "-"}</div>
                    </div>
                  ) : null}
                  {hasFamiliar ? (
                    <div className="rounded border border-slate-900 p-2">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Familiar</div>
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
                <div className="font-semibold">Export Ready: {validation.isValidForExport ? "YES" : "NO"}</div>
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
