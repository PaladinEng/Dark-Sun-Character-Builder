import { getSkillAndToolDisplayRows, type SkillAndToolDisplayRow } from "./skills";
import type { ValidationIssue, ValidationReport } from "./validate";
import type { Ability, AbilityRecord, SpellSlots } from "./types";

const PDF_EXPORT_BLOCKED_MESSAGE = "PDF export blocked: resolve validation errors first.";

export type PdfExportError = {
  code: "PDF_EXPORT_BLOCKED" | "PDF_TEMPLATE_EMPTY";
  message: string;
  issues?: ValidationIssue[];
};

export type PdfExportResult =
  | {
      ok: true;
      pdfBytes: Uint8Array;
    }
  | {
      ok: false;
      error: PdfExportError;
    };

export type PdfExportCharacterSnapshot = {
  level: number;
  characterName?: string | null;
  className?: string | null;
  subclass?: string | null;
  speciesName?: string | null;
  backgroundName?: string | null;
  xp?: number | null;
  heroicInspiration?: boolean;
  abilities: AbilityRecord;
  abilityMods: AbilityRecord;
  savingThrows?: AbilityRecord;
  saveProficiencies?: readonly Ability[];
  skills?: Record<string, number>;
  skillDefinitions?: ReadonlyArray<{ id: string; name: string; ability: Ability }>;
  skillAndToolRows?: readonly SkillAndToolDisplayRow[];
  proficiencyBonus: number;
  armorClass: number;
  shieldAC?: number | null;
  currentHP?: number | null;
  maxHP: number;
  tempHP?: number | null;
  hitDiceTotal?: number | null;
  hitDiceSpent?: number | null;
  deathSaveSuccesses?: number | null;
  deathSaveFailures?: number | null;
  exhaustionLevel?: number | null;
  speed: number;
  passivePerception?: number;
  attackName?: string | null;
  attackToHit?: number | null;
  attackDamage?: string | null;
  attackNotes?: string | null;
  classFeatureNames?: readonly string[];
  speciesTraitNames?: readonly string[];
  selectedFeatureNames?: readonly string[];
  featNames?: readonly string[];
  activeConditionNames?: readonly string[];
  spellcastingAbility?: Ability | null;
  spellcastingModifier?: number | null;
  spellSaveDC?: number | null;
  spellAttackBonus?: number | null;
  spellSlots?: SpellSlots | null;
  armorProficiencies?: readonly string[];
  weaponProficiencies?: readonly string[];
  toolProficiencies?: readonly string[];
  languages?: readonly string[];
  cp?: number | null;
  sp?: number | null;
  ep?: number | null;
  gp?: number | null;
  pp?: number | null;
  otherWealth?: string | null;
  attunedItems?: readonly string[];
  inventorySummary?: readonly string[];
  appearance?: string | null;
  physicalDescription?: string | null;
  backstory?: string | null;
  alignment?: string | null;
  notes?: string | null;
  companionName?: string | null;
  companionType?: string | null;
  companionSummary?: string | null;
  companionNotes?: string | null;
  familiarName?: string | null;
  familiarType?: string | null;
  familiarSummary?: string | null;
  familiarNotes?: string | null;
  equippedArmorName?: string | null;
  equippedShieldName?: string | null;
  equippedWeaponName?: string | null;
  warningMessages?: readonly string[];
};

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

const ABILITY_ORDER: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];
const ABILITY_LABELS: Record<Ability, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};
function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function normalizeLines(value: readonly string[] | undefined, fallback: string): string[] {
  if (!value || value.length === 0) {
    return [fallback];
  }
  const normalized = value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : [fallback];
}

function drawText(
  commands: string[],
  text: string,
  x: number,
  y: number,
  size = 10,
  bold = false
): void {
  const fontId = bold ? "F2" : "F1";
  commands.push(`BT /${fontId} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
}

function drawSection(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
): void {
  const headerHeight = 14;
  commands.push(`${x} ${y} ${width} ${height} re S`);
  commands.push("0.94 g");
  commands.push(`${x} ${y + height - headerHeight} ${width} ${headerHeight} re f`);
  commands.push("0 g");
  drawText(commands, title.toUpperCase(), x + 4, y + height - 10, 8, true);
}

function drawList(
  commands: string[],
  lines: readonly string[],
  x: number,
  topY: number,
  maxLines: number,
  lineHeight: number,
  size = 8
): void {
  for (let index = 0; index < Math.min(maxLines, lines.length); index += 1) {
    drawText(commands, truncateText(lines[index], 56), x, topY - index * lineHeight, size, false);
  }
}

function drawField(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  maxLength = 34,
  valueSize = 9
): void {
  commands.push(`${x} ${y} ${width} ${height} re S`);
  drawText(commands, label.toUpperCase(), x + 3, y + height - 8, 6, true);
  drawText(commands, truncateText(value, maxLength), x + 3, y + 5, valueSize, true);
}

function createPdfFromCharacterSheet(snapshot: PdfExportCharacterSnapshot): Uint8Array {
  const commands: string[] = [];
  const pageWidth = 612;
  const margin = 24;
  const contentWidth = pageWidth - margin * 2;
  const sectionGap = 8;
  const leftWidth = 192;
  const rightWidth = contentWidth - leftWidth - sectionGap;
  const leftX = margin;
  const rightX = leftX + leftWidth + sectionGap;

  const level = Math.max(1, Math.floor(snapshot.level || 1));
  const characterName = snapshot.characterName?.trim() || "Unnamed Character";
  const classLabel = snapshot.className?.trim() || "Class Unset";
  const subclassLabel = snapshot.subclass?.trim() ? snapshot.subclass.trim() : "None";
  const classAndSubclass = `${classLabel} / ${subclassLabel}`;
  const speciesLabel = snapshot.speciesName?.trim() || "Species Unset";
  const backgroundLabel = snapshot.backgroundName?.trim() || "Background Unset";
  const xpValue =
    typeof snapshot.xp === "number" && Number.isFinite(snapshot.xp)
      ? Math.max(0, Math.floor(snapshot.xp))
      : null;
  const heroicInspirationLabel = snapshot.heroicInspiration ? "Yes" : "No";
  const proficiencyBonusLabel = formatModifier(snapshot.proficiencyBonus);
  const shieldContribution =
    typeof snapshot.shieldAC === "number" && Number.isFinite(snapshot.shieldAC) && snapshot.shieldAC > 0
      ? `+${Math.floor(snapshot.shieldAC)}`
      : "None";
  const initiative = formatModifier(snapshot.abilityMods.dex ?? 0);
  const currentHP =
    typeof snapshot.currentHP === "number" && Number.isFinite(snapshot.currentHP)
      ? Math.max(0, Math.floor(snapshot.currentHP))
      : snapshot.maxHP;
  const tempHP =
    typeof snapshot.tempHP === "number" && Number.isFinite(snapshot.tempHP)
      ? Math.max(0, Math.floor(snapshot.tempHP))
      : 0;
  const hitDiceTotal =
    typeof snapshot.hitDiceTotal === "number" && Number.isFinite(snapshot.hitDiceTotal)
      ? Math.max(0, Math.floor(snapshot.hitDiceTotal))
      : null;
  const hitDiceSpent =
    typeof snapshot.hitDiceSpent === "number" && Number.isFinite(snapshot.hitDiceSpent)
      ? Math.max(0, Math.floor(snapshot.hitDiceSpent))
      : 0;
  const deathSaveSuccesses =
    typeof snapshot.deathSaveSuccesses === "number" && Number.isFinite(snapshot.deathSaveSuccesses)
      ? Math.max(0, Math.min(3, Math.floor(snapshot.deathSaveSuccesses)))
      : 0;
  const deathSaveFailures =
    typeof snapshot.deathSaveFailures === "number" && Number.isFinite(snapshot.deathSaveFailures)
      ? Math.max(0, Math.min(3, Math.floor(snapshot.deathSaveFailures)))
      : 0;
  const exhaustionLevel =
    typeof snapshot.exhaustionLevel === "number" && Number.isFinite(snapshot.exhaustionLevel)
      ? Math.max(0, Math.min(10, Math.floor(snapshot.exhaustionLevel)))
      : 0;
  const attackBonusOrDc =
    typeof snapshot.attackToHit === "number"
      ? formatModifier(snapshot.attackToHit)
      : typeof snapshot.spellSaveDC === "number"
        ? `DC ${snapshot.spellSaveDC}`
        : "-";
  const attackNotes = snapshot.attackNotes?.trim() || "-";
  const classFeatureLines = normalizeLines(snapshot.classFeatureNames, "None");
  const speciesTraitLines = normalizeLines(snapshot.speciesTraitNames, "None");
  const featLines = normalizeLines(snapshot.featNames, "None");
  const otherFeatureLines = normalizeLines(snapshot.selectedFeatureNames, "None");
  const conditionLines = normalizeLines(snapshot.activeConditionNames, "None");
  const saveProficiencySet = new Set(snapshot.saveProficiencies ?? []);
  const skillAndToolRows =
    snapshot.skillAndToolRows ??
    getSkillAndToolDisplayRows({
      skillDefinitions: snapshot.skillDefinitions,
      skills: snapshot.skills,
      toolProficiencies: snapshot.toolProficiencies,
    });
  const featuresSummaryLines = [
    "Class Features:",
    ...classFeatureLines.map((line) => `- ${line}`),
    "Species Traits:",
    ...speciesTraitLines.map((line) => `- ${line}`),
    "Feats:",
    ...featLines.map((line) => `- ${line}`),
    "Other Features:",
    ...otherFeatureLines.map((line) => `- ${line}`),
  ];
  const attackRows = [
    {
      name: snapshot.attackName?.trim() || "-",
      bonus: attackBonusOrDc,
      damage: snapshot.attackDamage?.trim() || "-",
      notes: attackNotes,
    },
    { name: "-", bonus: "-", damage: "-", notes: "-" },
    { name: "-", bonus: "-", damage: "-", notes: "-" },
    { name: "-", bonus: "-", damage: "-", notes: "-" },
  ];

  const identityY = 704;
  const identityHeight = 64;
  const bodyTop = identityY - 8;
  const bodyBottom = 24;
  const bodyHeight = bodyTop - bodyBottom;

  const abilityY = 268;
  const abilityHeight = bodyHeight - 236 - sectionGap;
  const skillsY = bodyBottom;
  const skillsHeight = 236;

  const combatY = 600;
  const combatHeight = 96;
  const survivabilityY = 480;
  const survivabilityHeight = 112;
  const attacksY = 334;
  const attacksHeight = 138;
  const conditionsY = 248;
  const conditionsHeight = 78;
  const featuresY = bodyBottom;
  const featuresHeight = 216;

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET", margin, 778, 11, true);

  drawSection(commands, margin, identityY, contentWidth, identityHeight, "Identity Header");
  const identityInnerX = margin + 8;
  const identityFieldHeight = 18;
  const identityTopRowY = identityY + 24;
  const identityBottomRowY = identityY + 3;
  const idTop = [
    { label: "Character Name", value: characterName, width: 226 },
    { label: "Class / Subclass", value: classAndSubclass, width: 180 },
    { label: "Level", value: `${level}`, width: 48 },
    { label: "XP", value: xpValue === null ? "-" : `${xpValue}`, width: 76 },
  ] as const;
  let idCursor = identityInnerX;
  for (const field of idTop) {
    drawField(
      commands,
      idCursor,
      identityTopRowY,
      field.width,
      identityFieldHeight,
      field.label,
      field.value,
      field.label === "Character Name" ? 32 : 26
    );
    idCursor += field.width + 6;
  }
  const idBottom = [
    { label: "Background", value: backgroundLabel, width: 210 },
    { label: "Species", value: speciesLabel, width: 160 },
    { label: "Heroic Inspiration", value: heroicInspirationLabel, width: 166 },
  ] as const;
  idCursor = identityInnerX;
  for (const field of idBottom) {
    drawField(commands, idCursor, identityBottomRowY, field.width, identityFieldHeight, field.label, field.value);
    idCursor += field.width + 6;
  }

  drawSection(commands, leftX, abilityY, leftWidth, abilityHeight, "Abilities");
  const abilityBoxX = leftX + 8;
  const abilityBoxWidth = leftWidth - 16;
  const abilityBoxHeight = 63;
  const abilityRowGap = 4;
  const firstAbilityY = abilityY + abilityHeight - 20 - abilityBoxHeight;
  const scoreDivider = abilityBoxX + 44;
  const modDivider = scoreDivider + 38;
  const saveDivider = modDivider + 40;
  drawText(commands, "SCORE", scoreDivider + 4, abilityY + abilityHeight - 18, 6, true);
  drawText(commands, "MOD", modDivider + 6, abilityY + abilityHeight - 18, 6, true);
  drawText(commands, "SAVE", saveDivider + 6, abilityY + abilityHeight - 18, 6, true);
  ABILITY_ORDER.forEach((ability, index) => {
    const rowY = firstAbilityY - index * (abilityBoxHeight + abilityRowGap);
    commands.push(`${abilityBoxX} ${rowY} ${abilityBoxWidth} ${abilityBoxHeight} re S`);
    commands.push(`${scoreDivider} ${rowY} m ${scoreDivider} ${rowY + abilityBoxHeight} l S`);
    commands.push(`${modDivider} ${rowY} m ${modDivider} ${rowY + abilityBoxHeight} l S`);
    commands.push(`${saveDivider} ${rowY} m ${saveDivider} ${rowY + abilityBoxHeight} l S`);
    drawText(commands, ABILITY_LABELS[ability], abilityBoxX + 4, rowY + 24, 10, true);
    drawText(commands, `${snapshot.abilities[ability] ?? 0}`, scoreDivider + 8, rowY + 24, 12, true);
    drawText(
      commands,
      formatModifier(snapshot.abilityMods[ability] ?? 0),
      modDivider + 7,
      rowY + 24,
      11,
      true
    );
    const saveValue = snapshot.savingThrows?.[ability] ?? snapshot.abilityMods[ability] ?? 0;
    const saveText = `${saveProficiencySet.has(ability) ? "P " : ""}${formatModifier(saveValue)}`;
    drawText(commands, saveText, saveDivider + 4, rowY + 24, 10, true);
  });

  drawSection(commands, leftX, skillsY, leftWidth, skillsHeight, "Skills & Tools");
  drawList(
    commands,
    skillAndToolRows.map((row) =>
      row.kind === "skill"
        ? `${row.label} ${formatModifier(row.value)}`
        : `Tool: ${row.label}`
    ),
    leftX + 8,
    skillsY + skillsHeight - 22,
    24,
    9,
    8
  );

  drawSection(commands, rightX, combatY, rightWidth, combatHeight, "Combat");
  const combatStats = [
    ["Armor Class", `${snapshot.armorClass}`],
    ["Shield", shieldContribution],
    ["Speed", `${snapshot.speed} ft`],
    ["Initiative", initiative],
    ["Prof Bonus", proficiencyBonusLabel],
  ] as const;
  const combatBoxGap = 6;
  const combatBoxWidth = (rightWidth - 16 - combatBoxGap * 4) / 5;
  const combatBoxHeight = 42;
  combatStats.forEach(([label, value], index) => {
    const x = rightX + 8 + index * (combatBoxWidth + combatBoxGap);
    const y = combatY + 24;
    commands.push(`${x} ${y} ${combatBoxWidth} ${combatBoxHeight} re S`);
    drawText(commands, label, x + 3, y + 27, 6, true);
    drawText(commands, value, x + 3, y + 11, 12, true);
  });

  drawSection(commands, rightX, survivabilityY, rightWidth, survivabilityHeight, "Survivability");
  const survivabilityTopY = survivabilityY + 44;
  const survivabilityTopWidth = (rightWidth - 16 - 12) / 3;
  drawField(
    commands,
    rightX + 8,
    survivabilityTopY,
    survivabilityTopWidth,
    34,
    "Current HP",
    `${currentHP}`,
    16,
    11
  );
  drawField(
    commands,
    rightX + 8 + survivabilityTopWidth + 6,
    survivabilityTopY,
    survivabilityTopWidth,
    34,
    "Max HP",
    `${snapshot.maxHP}`,
    16,
    11
  );
  drawField(
    commands,
    rightX + 8 + (survivabilityTopWidth + 6) * 2,
    survivabilityTopY,
    survivabilityTopWidth,
    34,
    "Temp HP",
    `${tempHP}`,
    16,
    11
  );
  const lowerWidth = (rightWidth - 16 - 6) / 2;
  drawField(
    commands,
    rightX + 8,
    survivabilityY + 7,
    lowerWidth,
    30,
    "Hit Dice (Spent/Total)",
    `${hitDiceSpent}/${hitDiceTotal ?? "-"}`,
    26,
    10
  );
  drawField(
    commands,
    rightX + 8 + lowerWidth + 6,
    survivabilityY + 7,
    lowerWidth,
    30,
    "Death Saves (S/F)",
    `${deathSaveSuccesses}/${deathSaveFailures}`,
    26,
    10
  );

  drawSection(commands, rightX, attacksY, rightWidth, attacksHeight, "Weapons / Attacks");
  const tableX = rightX + 8;
  const tableY = attacksY + 16;
  const tableWidth = rightWidth - 16;
  const tableRowHeight = 19;
  const tableRows = 5;
  const tableHeight = tableRows * tableRowHeight;
  const attackColumns = [118, 70, 96, 64] as const;
  commands.push(`${tableX} ${tableY} ${tableWidth} ${tableHeight} re S`);
  for (let index = 1; index < tableRows; index += 1) {
    const y = tableY + tableHeight - index * tableRowHeight;
    commands.push(`${tableX} ${y} m ${tableX + tableWidth} ${y} l S`);
  }
  let columnCursor = tableX;
  for (let index = 0; index < attackColumns.length - 1; index += 1) {
    columnCursor += attackColumns[index];
    commands.push(`${columnCursor} ${tableY} m ${columnCursor} ${tableY + tableHeight} l S`);
  }
  drawText(commands, "NAME", tableX + 3, tableY + tableHeight - 13, 6, true);
  drawText(commands, "ATK/DC", tableX + attackColumns[0] + 3, tableY + tableHeight - 13, 6, true);
  drawText(
    commands,
    "DAMAGE / TYPE",
    tableX + attackColumns[0] + attackColumns[1] + 3,
    tableY + tableHeight - 13,
    6,
    true
  );
  drawText(
    commands,
    "NOTES",
    tableX + attackColumns[0] + attackColumns[1] + attackColumns[2] + 3,
    tableY + tableHeight - 13,
    6,
    true
  );
  attackRows.forEach((row, index) => {
    const rowTopY = tableY + tableHeight - tableRowHeight * (index + 1);
    const rowTextY = rowTopY - 13;
    drawText(commands, truncateText(row.name, 21), tableX + 3, rowTextY, 8, false);
    drawText(commands, truncateText(row.bonus, 10), tableX + attackColumns[0] + 3, rowTextY, 8, false);
    drawText(
      commands,
      truncateText(row.damage, 17),
      tableX + attackColumns[0] + attackColumns[1] + 3,
      rowTextY,
      8,
      false
    );
    drawText(
      commands,
      truncateText(row.notes, 12),
      tableX + attackColumns[0] + attackColumns[1] + attackColumns[2] + 3,
      rowTextY,
      8,
      false
    );
  });

  drawSection(commands, rightX, conditionsY, rightWidth, conditionsHeight, "Conditions / Exhaustion");
  drawField(commands, rightX + rightWidth - 92, conditionsY + 18, 84, 30, "Exhaustion", `${exhaustionLevel}`, 12, 11);
  drawList(
    commands,
    conditionLines.map((line) => `- ${line}`),
    rightX + 8,
    conditionsY + conditionsHeight - 22,
    4,
    11,
    8
  );

  drawSection(commands, rightX, featuresY, rightWidth, featuresHeight, "Features Summary");
  drawList(commands, featuresSummaryLines, rightX + 8, featuresY + featuresHeight - 22, 19, 10, 8);

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets[index + 1] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "utf8"));
}

export function buildPdfExportFromTemplate(
  templatePdfBytes: Uint8Array,
  validation: ValidationReport,
  snapshot?: PdfExportCharacterSnapshot
): PdfExportResult {
  if (validation.errors.length > 0) {
    const issueSummary = validation.errors
      .map((issue) => `[${issue.code}] ${issue.message}`)
      .join(" ");
    return {
      ok: false,
      error: {
        code: "PDF_EXPORT_BLOCKED",
        message: issueSummary.length > 0
          ? `${PDF_EXPORT_BLOCKED_MESSAGE} ${issueSummary}`
          : PDF_EXPORT_BLOCKED_MESSAGE,
        issues: validation.errors
      }
    };
  }

  if (!(templatePdfBytes instanceof Uint8Array) || templatePdfBytes.byteLength === 0) {
    return {
      ok: false,
      error: {
        code: "PDF_TEMPLATE_EMPTY",
        message: "PDF export failed: template PDF is missing or empty."
      }
    };
  }

  if (!snapshot) {
    return { ok: true, pdfBytes: new Uint8Array(templatePdfBytes) };
  }

  return { ok: true, pdfBytes: createPdfFromCharacterSheet(snapshot) };
}
