import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";
import type { CharacterState } from "@dark-sun/rules";
import { buildPdfExportFromTemplate, computeDerivedState, validateCharacter } from "@dark-sun/rules";

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
    attunedItems: normalizeStringArray(input.attunedItems),
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
    inventoryCounts.set(itemId, Math.max(1, inventoryCounts.get(itemId) ?? 1));
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
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 6);
  const inventorySummary = [
    `Coins: ${cpCoins} cp / ${spCoins} sp / ${epCoins} ep / ${gpCoins} gp / ${ppCoins} pp`,
    ...(payload.characterState.otherWealth?.trim()
      ? [`Other Wealth: ${payload.characterState.otherWealth.trim()}`]
      : []),
    ...(inventoryItems.length > 0 ? inventoryItems : ["Other Gear: None"]),
  ];
  const spellcastingAbility = derived.spellcastingAbility ?? derived.spellcasting?.ability ?? null;
  const spellcastingModifier = spellcastingAbility ? derived.abilityMods[spellcastingAbility] : null;
  const spellSaveDC = derived.spellSaveDC ?? derived.spellcasting?.saveDC ?? null;
  const spellAttackBonus = derived.spellAttackBonus ?? derived.spellcasting?.attackBonus ?? null;
  const spellSlots = derived.spellSlots ?? derived.spellcasting?.slots ?? null;
  const templatePdfBytes = await loadTemplatePdfBytes();
  const pdfResult = buildPdfExportFromTemplate(templatePdfBytes, validation, {
    level: payload.characterState.level,
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
    skillDefinitions: [...merged.content.skillDefinitions]
      .map((skill, index) => ({ skill, index }))
      .sort((left, right) => {
        const leftOrder =
          typeof left.skill.sortOrder === "number" ? left.skill.sortOrder : Number.POSITIVE_INFINITY;
        const rightOrder =
          typeof right.skill.sortOrder === "number" ? right.skill.sortOrder : Number.POSITIVE_INFINITY;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.index - right.index;
      })
      .map(({ skill }) => ({
        id: skill.id,
        name: skill.name,
        ability: skill.ability
      })),
    proficiencyBonus: derived.proficiencyBonus,
    armorClass: derived.armorClass,
    shieldAC: payload.characterState.equippedShieldId ? 2 : 0,
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
    featNames: derived.feats.map((feat) => feat.name),
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
    attunedItems: payload.characterState.attunedItems ?? [],
    inventorySummary,
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
