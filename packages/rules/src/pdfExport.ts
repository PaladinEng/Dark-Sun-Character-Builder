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
  proficiencyBonus: number;
  armorClass: number;
  shieldAC?: number | null;
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
  featNames?: readonly string[];
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
const SKILL_ORDER = [
  "athletics",
  "acrobatics",
  "sleight_of_hand",
  "stealth",
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
  "animal_handling",
  "insight",
  "medicine",
  "perception",
  "survival",
  "deception",
  "intimidation",
  "performance",
  "persuasion",
] as const;

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatSkillLabel(skillId: string): string {
  return skillId
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLines(value: readonly string[] | undefined, fallback: string): string[] {
  if (!value || value.length === 0) {
    return [fallback];
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
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

function createPdfFromCharacterSheet(snapshot: PdfExportCharacterSnapshot): Uint8Array {
  const commands: string[] = [];
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 24;
  const columnGap = 8;
  const leftWidth = 140;
  const middleWidth = 244;
  const rightWidth = 164;

  const leftX = margin;
  const middleX = leftX + leftWidth + columnGap;
  const rightX = middleX + middleWidth + columnGap;
  const columnTop = 692;
  const columnBottom = 24;

  const headerX = margin;
  const headerY = 734;
  const headerWidth = pageWidth - margin * 2;
  const headerHeight = 34;

  const attackSummary = snapshot.attackName
    ? `${snapshot.attackName} ${formatModifier(snapshot.attackToHit ?? 0)} (${snapshot.attackDamage ?? "-"})`
    : "None";
  const level = Math.max(1, Math.floor(snapshot.level || 1));
  const proficiencyBonus = formatModifier(snapshot.proficiencyBonus);
  const spellSlotsSummary = snapshot.spellSlots
    ? snapshot.spellSlots.map((count, index) => `L${index + 1}:${count}`).join(" ")
    : "None";
  const inventoryLines = normalizeLines(snapshot.inventorySummary, "No additional equipment listed.");
  const featLines = normalizeLines(snapshot.featNames, "No feats selected.");
  const warningLines = normalizeLines(snapshot.warningMessages, "No validation warnings.");
  const toolLines = normalizeLines(snapshot.toolProficiencies, "None");
  const languageLines = normalizeLines(snapshot.languages, "None");
  const saveProficiencySet = new Set(snapshot.saveProficiencies ?? []);

  commands.push("0.2 w");
  commands.push(`${headerX} ${headerY} ${headerWidth} ${headerHeight} re S`);
  drawText(commands, "DARK SUN CHARACTER SHEET", headerX + 10, headerY + 20, 16, true);
  drawText(
    commands,
    `${truncateText(snapshot.className ?? "Class Unset", 20)} | ${truncateText(snapshot.speciesName ?? "Species Unset", 18)} | Lvl ${level}`,
    headerX + 10,
    headerY + 7,
    9,
    false
  );
  drawText(
    commands,
    `Background: ${truncateText(snapshot.backgroundName ?? "Unset", 28)}`,
    headerX + 320,
    headerY + 20,
    9,
    false
  );
  drawText(commands, `Export`, headerX + 320, headerY + 7, 9, true);
  drawText(commands, "Dark Sun Builder", headerX + 356, headerY + 7, 9, false);

  const abilitiesY = columnTop - 320;
  const savingThrowsY = abilitiesY - columnGap - 130;
  const skillsY = savingThrowsY - columnGap - 202;
  const coreStatsY = columnTop - 120;
  const attacksY = coreStatsY - columnGap - 90;
  const summaryY = attacksY - columnGap - 170;
  const equipmentY = summaryY - columnGap - 120;
  const notesY = equipmentY - columnGap - 136;
  const identityY = columnTop - 120;
  const featsY = identityY - columnGap - 180;
  const spellcastingY = featsY - columnGap - 110;
  const validationY = spellcastingY - columnGap - 90;
  const resourcesY = validationY - columnGap - 136;

  drawSection(commands, leftX, abilitiesY, leftWidth, 320, "Abilities");
  drawSection(commands, leftX, savingThrowsY, leftWidth, 130, "Saving Throws");
  drawSection(commands, leftX, skillsY, leftWidth, 202, "Skills");

  drawSection(commands, middleX, coreStatsY, middleWidth, 120, "Core Stats");
  drawSection(commands, middleX, attacksY, middleWidth, 90, "Attack");
  drawSection(commands, middleX, summaryY, middleWidth, 170, "Character Summary");
  drawSection(commands, middleX, equipmentY, middleWidth, 120, "Equipment");
  drawSection(commands, middleX, notesY, middleWidth, 136, "Notes");

  drawSection(commands, rightX, identityY, rightWidth, 120, "Identity");
  drawSection(commands, rightX, featsY, rightWidth, 180, "Feats");
  drawSection(commands, rightX, spellcastingY, rightWidth, 110, "Spellcasting");
  drawSection(commands, rightX, validationY, rightWidth, 90, "Validation");
  drawSection(commands, rightX, resourcesY, rightWidth, 136, "Proficiencies");

  const abilityBoxX = leftX + 8;
  const abilityBoxWidth = leftWidth - 16;
  const abilityBoxHeight = 40;
  const abilityRowGap = 6;
  const firstAbilityY = abilitiesY + 320 - 20 - abilityBoxHeight;
  ABILITY_ORDER.forEach((ability, index) => {
    const rowY = firstAbilityY - index * (abilityBoxHeight + abilityRowGap);
    commands.push(`${abilityBoxX} ${rowY} ${abilityBoxWidth} ${abilityBoxHeight} re S`);
    commands.push(`${abilityBoxX + 56} ${rowY + 8} 26 22 re S`);
    drawText(commands, ABILITY_LABELS[ability], abilityBoxX + 6, rowY + 24, 10, true);
    drawText(
      commands,
      formatModifier(snapshot.abilityMods[ability] ?? 0),
      abilityBoxX + 60,
      rowY + 16,
      11,
      true
    );
    drawText(commands, `${snapshot.abilities[ability] ?? 0}`, abilityBoxX + 92, rowY + 16, 14, true);
  });

  ABILITY_ORDER.forEach((ability, index) => {
    const marker = saveProficiencySet.has(ability) ? "*" : " ";
    const saveLine = `${marker} ${ABILITY_LABELS[ability]} ${formatModifier(
      snapshot.savingThrows?.[ability] ?? snapshot.abilityMods[ability] ?? 0
    )}`;
    drawText(commands, saveLine, leftX + 8, savingThrowsY + 102 - index * 16, 9, false);
  });

  const orderedSkills = [...SKILL_ORDER];
  drawList(
    commands,
    orderedSkills.map(
      (skillId) =>
        `${formatSkillLabel(skillId)} ${formatModifier(snapshot.skills?.[skillId] ?? 0)}`
    ),
    leftX + 8,
    skillsY + 176,
    18,
    9,
    7
  );

  const statRows = [
    ["Armor Class", `${snapshot.armorClass}`],
    ["Max HP", `${snapshot.maxHP}`],
    ["Speed", `${snapshot.speed} ft`],
    ["Proficiency", proficiencyBonus],
    ["Passive Perception", `${snapshot.passivePerception ?? 10}`],
  ] as const;
  const statBoxWidth = 112;
  const statBoxHeight = 28;
  statRows.forEach(([label, value], index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = middleX + 8 + col * (statBoxWidth + 8);
    const y = coreStatsY + 120 - 22 - statBoxHeight - row * (statBoxHeight + 6);
    commands.push(`${x} ${y} ${statBoxWidth} ${statBoxHeight} re S`);
    drawText(commands, label, x + 4, y + 18, 7, false);
    drawText(commands, value, x + 4, y + 6, 11, true);
  });

  drawText(
    commands,
    truncateText(snapshot.attackName ?? "No attack selected", 42),
    middleX + 8,
    attacksY + 58,
    10,
    true
  );
  drawText(commands, `To Hit: ${formatModifier(snapshot.attackToHit ?? 0)}`, middleX + 8, attacksY + 40, 9, false);
  drawText(
    commands,
    `Damage: ${truncateText(snapshot.attackDamage ?? "-", 34)}`,
    middleX + 8,
    attacksY + 24,
    9,
    false
  );

  drawList(
    commands,
    [
      `Attack: ${truncateText(attackSummary, 52)}`,
      `Class: ${truncateText(snapshot.className ?? "-", 44)}`,
      `Species: ${truncateText(snapshot.speciesName ?? "-", 44)}`,
      `Background: ${truncateText(snapshot.backgroundName ?? "-", 42)}`,
      `Primary Ability: ${ABILITY_LABELS[snapshot.spellcastingAbility ?? "int"] ?? "-"}`,
      `Export Level: ${level}`,
    ],
    middleX + 8,
    summaryY + 146,
    10,
    14,
    8
  );

  drawList(
    commands,
    [
      `Armor: ${truncateText(snapshot.equippedArmorName ?? "None", 34)}`,
      `Shield: ${truncateText(snapshot.equippedShieldName ?? "None", 34)}`,
      `Weapon: ${truncateText(snapshot.equippedWeaponName ?? "None", 34)}`,
      ...inventoryLines.map((line) => truncateText(line, 44)),
    ],
    middleX + 8,
    equipmentY + 96,
    7,
    13,
    8
  );

  for (let index = 0; index < 7; index += 1) {
    const y = notesY + 108 - index * 14;
    commands.push(`${middleX + 8} ${y} m ${middleX + middleWidth - 8} ${y} l S`);
  }

  drawList(
    commands,
    [
      `Level ${level}`,
      `Class: ${truncateText(snapshot.className ?? "-", 22)}`,
      `Species: ${truncateText(snapshot.speciesName ?? "-", 20)}`,
      `Background: ${truncateText(snapshot.backgroundName ?? "-", 18)}`,
      `Speed: ${snapshot.speed} ft`,
      `HP: ${snapshot.maxHP}`,
    ],
    rightX + 8,
    identityY + 98,
    8,
    14,
    8
  );

  drawList(commands, featLines, rightX + 8, featsY + 156, 13, 12, 8);

  drawList(
    commands,
    [
      `Ability: ${
        snapshot.spellcastingAbility
          ? ABILITY_LABELS[snapshot.spellcastingAbility]
          : "None"
      }`,
      `Save DC: ${snapshot.spellSaveDC ?? "-"}`,
      `Atk Bonus: ${
        typeof snapshot.spellAttackBonus === "number"
          ? formatModifier(snapshot.spellAttackBonus)
          : "-"
      }`,
      truncateText(`Slots: ${spellSlotsSummary}`, 34),
    ],
    rightX + 8,
    spellcastingY + 84,
    6,
    13,
    8
  );

  drawList(commands, warningLines, rightX + 8, validationY + 64, 4, 12, 8);

  drawList(
    commands,
    [
      `Tools: ${truncateText(toolLines.join(", "), 34)}`,
      `Languages: ${truncateText(languageLines.join(", "), 34)}`,
      `Proficiency Bonus: ${proficiencyBonus}`,
      `Armor Class: ${snapshot.armorClass}`,
      `Max HP: ${snapshot.maxHP}`,
      `Speed: ${snapshot.speed} ft`,
    ],
    rightX + 8,
    resourcesY + 112,
    8,
    13,
    8
  );

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
