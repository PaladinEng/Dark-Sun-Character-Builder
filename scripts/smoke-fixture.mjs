export function makeKnownValidExportPayload() {
  return {
    characterState: {
      level: 1,
      baseAbilities: {
        str: 15,
        dex: 14,
        con: 13,
        int: 12,
        wis: 10,
        cha: 8,
      },
      selectedSpeciesId: "srd52:species:human",
      selectedBackgroundId: "srd52:background:acolyte",
      selectedClassId: "srd52:class:fighter",
      chosenClassSkills: ["athletics", "perception"],
      chosenSkillProficiencies: [],
      chosenSaveProficiencies: [],
      toolProficiencies: [],
      languages: [],
      selectedFeatureIds: [],
      selectedFeats: [],
      featSelections: { level: {} },
      advancements: [],
      abilityIncreases: [],
      equippedArmorId: "srd52:equipment:chain-shirt",
      equippedWeaponId: "srd52:equipment:longsword",
    },
    enabledPackIds: ["srd52"],
  };
}

export function makeKnownInvalidExportPayload() {
  const valid = makeKnownValidExportPayload();
  return {
    ...valid,
    characterState: {
      ...valid.characterState,
      chosenClassSkills: [],
    },
  };
}

function toBase64Url(utf8Text) {
  return Buffer.from(utf8Text, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

export function encodePrintPayloadFromExportRequest(exportPayload) {
  const printPayload = {
    characterState: exportPayload.characterState,
    enabledPackIds: exportPayload.enabledPackIds ?? [],
    generatedAt: "smoke-fixture",
  };
  return toBase64Url(JSON.stringify(printPayload));
}
