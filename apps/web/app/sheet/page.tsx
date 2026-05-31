import type { ReactNode } from "react";

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
    languageLiteracy:
      input.languageLiteracy && typeof input.languageLiteracy === "object" && !Array.isArray(input.languageLiteracy)
        ? (input.languageLiteracy as Record<string, boolean>)
        : undefined,
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

// Reusable section shell so the scrollable sheet reads as one document with
// the same headed panels used across the print pages.
function SheetSection({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border-2 border-slate-900 ${className}`}>
      <h2 className="border-b border-slate-900 bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border border-slate-900 p-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-600">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
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
  const weaponIds =
    payload.characterState.equippedWeaponIds && payload.characterState.equippedWeaponIds.length > 0
      ? payload.characterState.equippedWeaponIds
      : payload.characterState.equippedWeaponId
        ? [payload.characterState.equippedWeaponId]
        : [];
  const weapons = weaponIds
    .map((id) => merged.content.equipmentById[id])
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

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

  // Group skills under their governing ability to mirror the print sheet's
  // left column (Athletics under STR, Stealth under DEX, etc.).
  const skillsByAbility: Record<Ability, typeof skillRows> = {
    str: [],
    dex: [],
    con: [],
    int: [],
    wis: [],
    cha: [],
  };
  for (const row of skillRows) {
    const ability = skillAbilityById.get(row.id);
    if (ability) {
      skillsByAbility[ability].push(row);
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
  // Merge custom spells into the appropriate lists
  for (const cs of payload.characterState.customSpells ?? []) {
    let label = cs.name;
    if (cs.ritual) label += " (R)";
    if (cs.concentration) label += " (C)";
    if (cs.field === "known") knownSpellNames.push(label);
    else if (cs.field === "prepared") preparedSpellNames.push(label);
    else if (cs.field === "cantrip") cantripNames.push(label);
  }
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

  const speciesTraitEntries = dedupeStrings(derived.traits);

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
    playerName?: unknown;
    player?: unknown;
    campaignName?: unknown;
    campaign?: unknown;
    currentHP?: unknown;
    currentHp?: unknown;
    currentHitPoints?: unknown;
  };
  const rawCharacterName = normalizeOptionalString(payload.characterState.characterName);
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
  for (const attack of derived.attacks) {
    attackRows.push({
      name: attack.name,
      bonus: formatModifier(attack.toHit),
      damage: attack.damage,
      notes:
        attack.mastery && attack.mastery.length > 0
          ? `Mastery: ${attack.mastery.map((mastery) => formatMasteryLabel(mastery)).join(", ")}`
          : "",
    });
  }
  for (const equippedWeapon of weapons) {
    if (derived.attacks.some((attack) => attack.name === equippedWeapon.name)) {
      continue;
    }
    attackRows.push({
      name: equippedWeapon.name,
      bonus: "-",
      damage: equippedWeapon.damageDice ?? "-",
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
  const hasSpellcasting =
    spellcastingAbility !== null ||
    hasSpellSlots ||
    cantripNames.length > 0 ||
    knownSpellNames.length > 0 ||
    preparedSpellNames.length > 0;
  const armorProficiencies = dedupeStrings(derived.armorProficiencies);
  const weaponProficiencies = dedupeStrings(derived.weaponProficiencies);
  const toolProficiencies = dedupeStrings(derived.toolProficiencies);
  const languageProficiencies = dedupeStrings(derived.languages).map((lang) =>
    derived.languageLiteracy[lang] ? `${lang} (literate)` : lang
  );
  const activeConditionSet = new Set(activeConditionLabels.map((condition) => condition.toLowerCase()));
  const conditionRows = STANDARD_CONDITION_LABELS.map((label) => ({
    label,
    active: activeConditionSet.has(label.toLowerCase()),
  }));
  const allClassFeatures = dedupeStrings([
    ...progressionFeatureNames,
    ...selectedFeatureNames,
  ]);

  const hasCompanion = hasCompanionData(payload.characterState.companion);
  const hasFamiliar = hasCompanionData(payload.characterState.familiar);
  const showCompanionSection = hasCompanion || hasFamiliar;

  return (
    <main className="min-h-screen bg-slate-300 px-3 py-6 text-slate-950">
      <article className="mx-auto max-w-6xl space-y-4 overflow-hidden rounded border-2 border-slate-900 bg-white p-4 shadow-2xl">
        <header className="border-b-2 border-slate-900 pb-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold tracking-wide">Character Sheet (HTML)</h1>
              <p className="text-xs text-slate-600">
                Scrollable view mirroring the print sheet&apos;s page structure.
              </p>
            </div>
            <div className="text-xs text-slate-600">
              Packs: {payload.enabledPackIds.join(", ") || "(none)"}
            </div>
          </div>
        </header>

        {/* Identity */}
        <SheetSection title="Identity">
          <div className="grid gap-2 p-2 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded border border-slate-900 p-2 sm:col-span-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Character Name</div>
                <div className="text-2xl font-bold leading-tight">{characterName}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Background</div>
                <div className="font-semibold">{selectedBackground?.name ?? "Unset"}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Class</div>
                <div className="font-semibold">{selectedClass?.name ?? "Unset"}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Species</div>
                <div className="font-semibold">{selectedSpecies?.name ?? "Unset"}</div>
              </div>
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Subclass</div>
                <div className="font-semibold">
                  {selectedSubclass?.name ?? payload.characterState.subclass ?? "-"}
                </div>
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

            <div className="grid grid-cols-3 gap-2 text-sm">
              <StatCell label="Level" value={level} />
              <StatCell label="XP" value={xp} />
              <StatCell label="Alignment" value={payload.characterState.alignment || "-"} />
            </div>
          </div>
        </SheetSection>

        {/* Combat (single source of truth — no duplicate combat strip) */}
        <SheetSection title="Combat">
          <div className="grid grid-cols-2 gap-2 p-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
            <StatCell label="Armor Class" value={derived.armorClass} />
            <StatCell label="Shield AC" value={shieldAC} />
            <StatCell label="Initiative" value={formatModifier(derived.abilityMods.dex)} />
            <StatCell label="Speed" value={`${derived.speed} ft`} />
            <StatCell label="Proficiency" value={formatModifier(derived.proficiencyBonus)} />
            <StatCell label="Passive Perception" value={derived.passivePerception} />
            <StatCell
              label="Heroic Inspiration"
              value={payload.characterState.heroicInspiration ? "Yes" : "No"}
            />
          </div>
        </SheetSection>

        {/* Hit Points (single source of truth — no duplicate HP block) */}
        <SheetSection title="Hit Points & Resources">
          <div className="grid grid-cols-2 gap-2 p-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <StatCell label="Max HP" value={derived.maxHP} />
            <StatCell label="Current HP" value={typeof currentHP === "number" ? currentHP : "___"} />
            <StatCell label="Temp HP" value={tempHP} />
            <StatCell
              label="Hit Dice (Rem / Max)"
              value={`${hitDiceRemaining ?? "-"} / ${hitDiceTotal ?? "-"}`}
            />
            <StatCell label="Death Saves (S / F)" value={`${deathSaveSuccesses} / ${deathSaveFailures}`} />
            <StatCell label="Exhaustion" value={exhaustionLevel} />
          </div>
        </SheetSection>

        {/* Core: abilities/saves/skills + attacks/senses */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SheetSection title="Abilities · Saving Throws · Skills">
            <div className="grid gap-3 p-2 md:grid-cols-2">
              {ABILITIES.map((ability) => (
                <div key={ability} className="rounded border border-slate-900 p-2">
                  <div className="flex items-center gap-2 border-b border-slate-300 pb-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-900 text-base font-bold">
                      {formatModifier(derived.abilityMods[ability])}
                    </div>
                    <div className="font-semibold tracking-wide">{ABILITY_LABELS[ability]}</div>
                    <div className="ml-auto rounded border border-slate-900 px-2 py-0.5 text-sm font-bold">
                      {derived.finalAbilities[ability]}
                    </div>
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs">
                    <div className="flex justify-between">
                      <span>{saveProficiencies.has(ability) ? "● " : "○ "}Saving Throw</span>
                      <span className="font-semibold">
                        {formatModifier(derived.savingThrows[ability])}
                      </span>
                    </div>
                    {skillsByAbility[ability].map((row) => (
                      <div key={`skill-${row.id}`} className="flex justify-between">
                        <span>
                          {skillProficiencySet.has(row.id) ? "● " : "○ "}
                          {row.label}
                        </span>
                        <span className="font-semibold">{formatModifier(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SheetSection>

          <div className="space-y-4">
            <SheetSection title="Weapons / Attacks">
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
            </SheetSection>

            <SheetSection title="Senses">
              <ul className="space-y-1 p-2 text-sm">
                <li>Passive Perception {derived.passivePerception}</li>
                {derived.senses.map((sense, index) => (
                  <li key={`sense-${index}`}>{formatSenseSummary(sense)}</li>
                ))}
                {derived.resistances.length > 0 ? (
                  <li>Resistances: {derived.resistances.join(", ")}</li>
                ) : null}
              </ul>
            </SheetSection>
          </div>
        </div>

        {/* Proficiencies / Currency / Conditions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <SheetSection title="Proficiencies & Languages">
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
                <div>
                  {toolProficiencies.join(", ") ||
                    (proficientToolRows.length > 0
                      ? proficientToolRows.map((row) => row.label).join(", ")
                      : "None")}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Languages</div>
                <div>{languageProficiencies.join(", ") || "None"}</div>
              </div>
            </div>
          </SheetSection>

          <SheetSection title="Currency">
            <div className="grid grid-cols-5 gap-2 p-2 text-center text-sm">
              {[
                ["CP", cpCoins],
                ["SP", spCoins],
                ["EP", epCoins],
                ["GP", gpCoins],
                ["PP", ppCoins],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded border border-slate-900 p-2">
                  <div className="text-[10px] uppercase tracking-wide text-slate-600">{label}</div>
                  <div className="font-semibold">{value}</div>
                </div>
              ))}
              {payload.characterState.otherWealth ? (
                <div className="col-span-5 text-left text-xs text-slate-700">
                  Other wealth: {payload.characterState.otherWealth}
                </div>
              ) : null}
            </div>
          </SheetSection>

          <SheetSection title="Conditions / Exhaustion">
            <div className="space-y-2 p-2 text-sm">
              <div className="rounded border border-slate-900 p-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Exhaustion Level</div>
                <div className="text-lg font-bold">{exhaustionLevel}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {conditionRows.map((row) => (
                  <div
                    key={`condition-${row.label}`}
                    className="flex items-center justify-between border-b border-slate-200 py-0.5"
                  >
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
          </SheetSection>
        </div>

        {/* Features & Equipment */}
        <div className="grid gap-4 lg:grid-cols-2">
          <SheetSection title="Class & Subclass Features">
            <div className="space-y-2 p-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">By Class / Subclass Level</div>
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
          </SheetSection>

          <SheetSection title="Species Traits & Feats">
            <div className="space-y-2 p-2 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">
                  Species: {selectedSpecies?.name ?? "Unset"}
                </div>
                {speciesTraitEntries.length === 0 ? (
                  <p>No derived traits.</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {speciesTraitEntries.map((entry) => (
                      <li key={`species-trait-${entry}`}>{entry}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Feats</div>
                {derived.feats.length === 0 ? (
                  <p>None</p>
                ) : (
                  <ul className="list-disc space-y-1 pl-5">
                    {derived.feats.map((feat) => (
                      <li key={feat.id}>{feat.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SheetSection>

          <SheetSection title="Equipment & Magic Items" className="lg:col-span-2">
            <div className="grid gap-3 p-2 text-sm md:grid-cols-2">
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded border border-slate-900 p-2">Armor: {armor?.name ?? "None"}</div>
                  <div className="rounded border border-slate-900 p-2">Shield: {shield?.name ?? "None"}</div>
                  <div className="rounded border border-slate-900 p-2 sm:col-span-2">
                    Weapons:{" "}
                    {weapons.length > 0 ? weapons.map((entry) => entry.name).join(", ") : "None"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Magic / Attuned Items</div>
                  {attunedItems.length === 0 ? (
                    <p>None</p>
                  ) : (
                    <ol className="list-decimal space-y-1 pl-5">
                      {attunedItems.map((entry, index) => (
                        <li key={`attuned-${index}`}>{entry}</li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-600">Inventory</div>
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
          </SheetSection>
        </div>

        {/* Spellcasting */}
        <SheetSection title="Spellcasting">
          {!hasSpellcasting ? (
            <p className="p-2 text-sm text-slate-600">This character has no spellcasting.</p>
          ) : (
            <div className="space-y-3 p-2">
              <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
                <StatCell
                  label="Ability"
                  value={spellcastingAbility ? ABILITY_LABELS[spellcastingAbility] : "None"}
                />
                <StatCell
                  label="Modifier"
                  value={spellcastingModifier !== null ? formatModifier(spellcastingModifier) : "-"}
                />
                <StatCell label="Spell Save DC" value={spellSaveDC ?? "-"} />
                <StatCell
                  label="Spell Attack"
                  value={spellAttackBonus !== null ? formatModifier(spellAttackBonus) : "-"}
                />
                <StatCell label="Mode" value={selectedClass?.spellcasting?.mode ?? "None"} />
              </div>

              <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-600">Spell Slots</div>
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-600">
                        <th className="py-1 pr-2">Level</th>
                        <th className="py-1 text-right">Slots</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spellSlotRows.map((row) => (
                        <tr key={`slot-row-${row.level}`} className="border-b border-slate-200">
                          <td className="py-1 pr-2">{row.level}</td>
                          <td className="py-1 text-right font-semibold">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!hasSpellSlots ? (
                    <p className="pt-2 text-[11px] text-slate-600">No class spell slots at this level.</p>
                  ) : null}
                </div>

                <div className="space-y-2 text-sm">
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
              </div>
            </div>
          )}
        </SheetSection>

        {/* Character Details */}
        <SheetSection title="Character Details">
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
          {showCompanionSection ? (
            <div className="grid gap-3 border-t border-slate-300 p-2 text-sm md:grid-cols-2">
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
          ) : null}
        </SheetSection>

        {/* Validation */}
        <SheetSection title="Validation">
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
        </SheetSection>

        <footer className="border-t-2 border-slate-900 pt-2 text-xs">
          <Link href="/builder" className="underline">
            Back to Builder
          </Link>
        </footer>
      </article>
    </main>
  );
}
