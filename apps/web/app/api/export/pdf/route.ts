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

function normalizeCharacterState(input: CharacterState): CharacterState {
  return {
    ...input,
    chosenSkillProficiencies: Array.isArray(input.chosenSkillProficiencies)
      ? input.chosenSkillProficiencies
      : [],
    chosenSaveProficiencies: Array.isArray(input.chosenSaveProficiencies)
      ? input.chosenSaveProficiencies
      : [],
    toolProficiencies: Array.isArray(input.toolProficiencies) ? input.toolProficiencies : [],
    languages: Array.isArray(input.languages) ? input.languages : [],
    knownSpellIds: Array.isArray(input.knownSpellIds) ? input.knownSpellIds : [],
    preparedSpellIds: Array.isArray(input.preparedSpellIds) ? input.preparedSpellIds : [],
    cantripsKnownIds: Array.isArray(input.cantripsKnownIds) ? input.cantripsKnownIds : [],
    selectedFeats: Array.isArray(input.selectedFeats) ? input.selectedFeats : [],
    selectedFeatureIds: Array.isArray(input.selectedFeatureIds) ? input.selectedFeatureIds : [],
    abilityIncreases: Array.isArray(input.abilityIncreases) ? input.abilityIncreases : [],
    advancements: Array.isArray(input.advancements) ? input.advancements : [],
    inventoryItemIds: Array.isArray(input.inventoryItemIds) ? input.inventoryItemIds : [],
    inventoryEntries: Array.isArray(input.inventoryEntries) ? input.inventoryEntries : [],
    coins: input.coins && typeof input.coins === "object" ? input.coins : undefined,
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
  const templatePdfBytes = await loadTemplatePdfBytes();
  const pdfResult = buildPdfExportFromTemplate(templatePdfBytes, validation, {
    level: payload.characterState.level,
    className: selectedClass?.name,
    speciesName: selectedSpecies?.name,
    backgroundName: selectedBackground?.name,
    abilities: derived.finalAbilities,
    abilityMods: derived.abilityMods,
    proficiencyBonus: derived.proficiencyBonus,
    armorClass: derived.armorClass,
    maxHP: derived.maxHP,
    speed: derived.speed,
    attackName: derived.attack?.name,
    attackToHit: derived.attack?.toHit,
    attackDamage: derived.attack?.damage,
    featNames: derived.feats.map((feat) => feat.name),
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
