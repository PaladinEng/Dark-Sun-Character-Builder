import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";
import { getClassFeatureIdsForLevel, type Effect, type Spell } from "@dark-sun/content";
import type { AttunedItem, CharacterState } from "@dark-sun/rules";
import {
  buildPdfExportFromTemplate,
  computeDerivedState,
  getSkillAndToolDisplayRows,
  validateCharacter,
} from "@dark-sun/rules";

import { getMergedContent } from "../../../../src/lib/content";

export const runtime = "nodejs";

type PdfExportRequestPayload = {
  characterState: CharacterState;
  enabledPackIds?: string[];
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

function formatDelimitedLabel(value: string): string {
  return value
    .split(/[_\s-]+/g)
    .filter((part) => part.length > 0)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConditionLabel(conditionId: string): string {
  return formatDelimitedLabel(conditionId);
}

function sortUniqueIds(ids: readonly string[] | undefined): string[] {
  return [...new Set(ids ?? [])].filter((id) => id.trim().length > 0).sort((a, b) => a.localeCompare(b));
}

function normalizeSpellReferencePart(value: string | number | undefined): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${Math.max(1, Math.floor(value))}`;
  }
  return null;
}

function formatSpellReference(spell: Spell): string | null {
  const spellWithReference = spell as Spell & {
    reference?: string | number;
    page?: string | number;
  };
  const reference = normalizeSpellReferencePart(spellWithReference.reference);
  const page = normalizeSpellReferencePart(spellWithReference.page);
  if (reference && page) {
    return `${reference} p.${page}`;
  }
  if (reference) {
    return reference;
  }
  if (page) {
    return `p.${page}`;
  }
  return null;
}

function summarizeSpeciesTraits(
  description: string | undefined,
  effects: readonly Effect[] | undefined
): string[] {
  const lines: string[] = [];
  const normalizedDescription = description?.trim();
  if (normalizedDescription) {
    lines.push(normalizedDescription);
  }
  for (const effect of effects ?? []) {
    if (effect.type === "grant_trait") {
      lines.push(effect.name);
      continue;
    }
    if (effect.type === "grant_sense") {
      const senseLabel = formatDelimitedLabel(effect.sense);
      lines.push(
        typeof effect.range === "number" ? `Sense: ${senseLabel} ${effect.range} ft` : `Sense: ${senseLabel}`
      );
      continue;
    }
    if (effect.type === "grant_resistance") {
      lines.push(`Resistance: ${formatDelimitedLabel(effect.damageType)}`);
    }
  }
  return [...new Set(lines)];
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
    cantripsKnownIds: Array.isArray(input.cantripsKnownIds) ? input.cantripsKnownIds : [],
    selectedFeats: Array.isArray(input.selectedFeats) ? input.selectedFeats : [],
    selectedFeatureIds: Array.isArray(input.selectedFeatureIds) ? input.selectedFeatureIds : [],
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

function parseRequestPayload(value: unknown): PdfExportRequestPayload | null {
  if (!isObjectRecord(value) || !isObjectRecord(value.characterState)) {
    return null;
  }
  return {
    characterState: normalizeCharacterState(value.characterState as unknown as CharacterState),
    enabledPackIds: Array.isArray(value.enabledPackIds)
      ? value.enabledPackIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}

async function loadTemplatePdfBytes(): Promise<Uint8Array> {
  const candidates = [
    join(process.cwd(), "assets", "sheets", "template.pdf"),
    join(process.cwd(), "apps", "web", "assets", "sheets", "template.pdf"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return await readFile(candidate);
    } catch {
      // Try next candidate path.
    }
  }

  throw new Error("Template PDF not found at expected asset paths.");
}

export async function POST(request: Request) {
  const rawPayload = await request.json().catch(() => null);
  const payload = parseRequestPayload(rawPayload);
  if (!payload) {
    return NextResponse.json(
      { error: "Invalid request payload: expected { characterState, enabledPackIds? }." },
      { status: 400 },
    );
  }

  const merged = await getMergedContent(payload.enabledPackIds ?? []);
  const validation = validateCharacter(payload.characterState, merged.content);
  const derived = computeDerivedState(payload.characterState, merged.content);
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
  const coinValues = payload.characterState.coins ?? {};
  const cpCoins = Number.isFinite(coinValues.cp) ? Math.max(0, Math.floor(coinValues.cp ?? 0)) : 0;
  const spCoins = Number.isFinite(coinValues.sp) ? Math.max(0, Math.floor(coinValues.sp ?? 0)) : 0;
  const epCoins = Number.isFinite(coinValues.ep) ? Math.max(0, Math.floor(coinValues.ep ?? 0)) : 0;
  const gpCoins = Number.isFinite(coinValues.gp) ? Math.max(0, Math.floor(coinValues.gp ?? 0)) : 0;
  const ppCoins = Number.isFinite(coinValues.pp) ? Math.max(0, Math.floor(coinValues.pp ?? 0)) : 0;
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
  const inventorySummaryItems = inventoryItems.slice(0, 6);
  const attunedItemLabels = (payload.characterState.attunedItems ?? [])
    .map((item) => item.name?.trim() || item.itemId?.trim() || "")
    .filter((entry) => entry.length > 0);
  const inventorySummary = [
    `Coins: ${cpCoins} cp / ${spCoins} sp / ${epCoins} ep / ${gpCoins} gp / ${ppCoins} pp`,
    `Attuned: ${attunedItemLabels.join(", ") || "None"}`,
    ...(payload.characterState.otherWealth?.trim()
      ? [`Other Wealth: ${payload.characterState.otherWealth.trim()}`]
      : []),
    ...(inventorySummaryItems.length > 0 ? inventorySummaryItems : ["Other Gear: None"]),
  ];
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellcastingModifier = spellcastingAbility ? derived.abilityMods[spellcastingAbility] : null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const normalizedLevel = Math.max(1, Math.floor(payload.characterState.level || 1));
  const characterStateWithOptionalIdentity = payload.characterState as CharacterState & {
    characterName?: unknown;
    name?: unknown;
    currentHP?: unknown;
    currentHp?: unknown;
    currentHitPoints?: unknown;
  };
  const rawCharacterName =
    normalizeOptionalString(characterStateWithOptionalIdentity.characterName) ??
    normalizeOptionalString(characterStateWithOptionalIdentity.name);
  const characterName = rawCharacterName?.trim() ? rawCharacterName.trim() : null;
  const currentHP = normalizeOptionalNonNegativeInt(
    characterStateWithOptionalIdentity.currentHP ??
      characterStateWithOptionalIdentity.currentHp ??
      characterStateWithOptionalIdentity.currentHitPoints
  );
  const classFeatureNames = selectedClass
    ? getClassFeatureIdsForLevel(selectedClass, normalizedLevel).map(
        (featureId) => merged.content.featuresById[featureId]?.name ?? featureId
      )
    : [];
  const selectedFeatureNames = (payload.characterState.selectedFeatureIds ?? [])
    .map((featureId) => merged.content.featuresById[featureId]?.name ?? featureId)
    .filter((name) => name.trim().length > 0);
  const speciesTraitNames = summarizeSpeciesTraits(selectedSpecies?.description, selectedSpecies?.effects);
  const activeConditionNames = (derived.activeConditionIds ?? []).map((conditionId) =>
    formatConditionLabel(conditionId)
  );
  const attackNotes = derived.attack?.mastery?.length
    ? `Mastery: ${derived.attack.mastery
        .map((mastery) => formatDelimitedLabel(mastery))
        .join(", ")}`
    : null;
  const resolveSpellNames = (spellIds: readonly string[] | undefined): string[] =>
    sortUniqueIds(spellIds)
      .map((spellId) => merged.content.spellsById[spellId]?.name ?? spellId)
      .filter((name) => name.trim().length > 0)
      .sort((a, b) => a.localeCompare(b));
  const cantripSpellIds = sortUniqueIds(
    derived.spellcasting?.cantripsKnownIds ?? payload.characterState.cantripsKnownIds
  );
  const knownSpellIds = sortUniqueIds(
    derived.spellcasting?.knownSpellIds ?? payload.characterState.knownSpellIds
  );
  const preparedSpellIds = sortUniqueIds(
    derived.spellcasting?.preparedSpellIds ?? payload.characterState.preparedSpellIds
  );
  const cantripSpellNames = resolveSpellNames(cantripSpellIds);
  const knownSpellNames = resolveSpellNames(knownSpellIds);
  const preparedSpellNames = resolveSpellNames(preparedSpellIds);

  type SpellSelectionKind = "cantrip" | "known" | "prepared";
  const spellSelectionById = new Map<string, Set<SpellSelectionKind>>();
  const registerSpellSelection = (spellIds: readonly string[], kind: SpellSelectionKind): void => {
    for (const spellId of spellIds) {
      const existing = spellSelectionById.get(spellId);
      if (existing) {
        existing.add(kind);
      } else {
        spellSelectionById.set(spellId, new Set([kind]));
      }
    }
  };
  registerSpellSelection(cantripSpellIds, "cantrip");
  registerSpellSelection(knownSpellIds, "known");
  registerSpellSelection(preparedSpellIds, "prepared");

  const spellSelectionOrder: SpellSelectionKind[] = ["cantrip", "known", "prepared"];
  const spellSelectionLabels: Record<SpellSelectionKind, string> = {
    cantrip: "Cantrip",
    known: "Known",
    prepared: "Prepared",
  };
  const spellListEntries = [...spellSelectionById.entries()]
    .map(([spellId, selections]) => {
      const spell = merged.content.spellsById[spellId];
      const orderedSelections = spellSelectionOrder.filter((selection) => selections.has(selection));
      const noteParts: string[] = [orderedSelections.map((selection) => spellSelectionLabels[selection]).join("/")];

      if (!spell) {
        return {
          name: spellId,
          notes: noteParts.join("; "),
        };
      }

      if (spell.ritual) {
        noteParts.push("Ritual");
      }
      if (spell.concentration) {
        noteParts.push("Concentration");
      }
      const spellWithNotes = spell as Spell & { notes?: string };
      const summary = spell.summary?.trim() || spellWithNotes.notes?.trim() || spell.description?.trim();
      if (summary) {
        noteParts.push(summary);
      }

      return {
        level: spell.level,
        name: spell.name,
        school: formatDelimitedLabel(spell.school),
        castingTime: spell.castingTime,
        range: spell.range,
        duration: spell.duration,
        components: spell.components.join(", "),
        notes: noteParts.join("; "),
        reference: formatSpellReference(spell),
      };
    })
    .sort((left, right) => {
      const leftLevel = typeof left.level === "number" && Number.isFinite(left.level) ? left.level : Number.POSITIVE_INFINITY;
      const rightLevel =
        typeof right.level === "number" && Number.isFinite(right.level) ? right.level : Number.POSITIVE_INFINITY;
      if (leftLevel !== rightLevel) {
        return leftLevel - rightLevel;
      }

      const leftName = left.name?.trim() ?? "";
      const rightName = right.name?.trim() ?? "";
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName);
      }
      return (left.notes ?? "").localeCompare(right.notes ?? "");
    });
  const skillAndToolRows = getSkillAndToolDisplayRows({
    skillDefinitions: merged.content.skillDefinitions,
    skills: derived.skills,
    toolProficiencies: derived.toolProficiencies,
  });
  const templatePdfBytes = await loadTemplatePdfBytes();
  const pdfResult = buildPdfExportFromTemplate(templatePdfBytes, validation, {
    level: normalizedLevel,
    characterName,
    className: selectedClass?.name,
    subclass: payload.characterState.subclass ?? null,
    speciesName: selectedSpecies?.name,
    backgroundName: selectedBackground?.name,
    xp: payload.characterState.xp ?? null,
    heroicInspiration: payload.characterState.heroicInspiration === true,
    abilities: derived.finalAbilities,
    abilityMods: derived.abilityMods,
    savingThrows: derived.savingThrows,
    saveProficiencies: derived.saveProficiencies,
    skills: derived.skills,
    skillDefinitions: merged.content.skillDefinitions,
    skillAndToolRows,
    proficiencyBonus: derived.proficiencyBonus,
    armorClass: derived.armorClass,
    shieldAC: payload.characterState.equippedShieldId ? 2 : 0,
    currentHP: currentHP ?? null,
    maxHP: derived.maxHP,
    tempHP: payload.characterState.tempHP ?? 0,
    hitDiceTotal: payload.characterState.hitDiceTotal ?? null,
    hitDiceSpent: payload.characterState.hitDiceSpent ?? 0,
    deathSaveSuccesses: payload.characterState.deathSaveSuccesses ?? 0,
    deathSaveFailures: payload.characterState.deathSaveFailures ?? 0,
    exhaustionLevel: payload.characterState.exhaustionLevel ?? 0,
    speed: derived.speed,
    passivePerception: derived.passivePerception,
    attackName: derived.attack?.name,
    attackToHit: derived.attack?.toHit,
    attackDamage: derived.attack?.damage,
    attackNotes,
    classFeatureNames,
    speciesTraitNames,
    selectedFeatureNames,
    featNames: derived.feats.map((feat) => feat.name),
    activeConditionNames,
    spellcastingAbility,
    spellcastingModifier,
    spellSaveDC,
    spellAttackBonus,
    spellSlots,
    armorProficiencies: payload.characterState.armorProficiencies ?? [],
    weaponProficiencies: payload.characterState.weaponProficiencies ?? [],
    toolProficiencies: derived.toolProficiencies,
    languages: derived.languages,
    cp: cpCoins,
    sp: spCoins,
    ep: epCoins,
    gp: gpCoins,
    pp: ppCoins,
    otherWealth: payload.characterState.otherWealth ?? null,
    attunedItems: attunedItemLabels,
    inventoryItems: inventoryItems.slice(0, 16),
    inventorySummary,
    cantripSpellNames,
    knownSpellNames,
    preparedSpellNames,
    spellListEntries,
    appearance: payload.characterState.appearance ?? null,
    physicalDescription: payload.characterState.physicalDescription ?? null,
    backstory: payload.characterState.backstory ?? null,
    alignment: payload.characterState.alignment ?? null,
    notes: payload.characterState.notes ?? null,
    companionName: payload.characterState.companion?.name ?? null,
    companionType: payload.characterState.companion?.type ?? null,
    companionSummary: payload.characterState.companion?.summary ?? null,
    companionNotes: payload.characterState.companion?.notes ?? null,
    familiarName: payload.characterState.familiar?.name ?? null,
    familiarType: payload.characterState.familiar?.type ?? null,
    familiarSummary: payload.characterState.familiar?.summary ?? null,
    familiarNotes: payload.characterState.familiar?.notes ?? null,
    equippedArmorName: armor?.name,
    equippedShieldName: shield?.name,
    equippedWeaponName: weapon?.name,
    warningMessages: validation.warnings.map((issue) => `[${issue.code}] ${issue.message}`),
  });

  if (!pdfResult.ok) {
    return NextResponse.json(
      {
        code: pdfResult.error.code,
        error: pdfResult.error.message,
        validation,
      },
      { status: 400 },
    );
  }

  return new Response(pdfResult.pdfBytes.slice().buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="character-sheet.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
