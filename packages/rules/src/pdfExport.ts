import type { SkillAndToolDisplayRow } from "./skills";
import type { ValidationIssue, ValidationReport } from "./validate";
import type { Ability, AbilityRecord, AttunedItem, SpellSlots } from "./types";

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

export type PdfSpellListEntry = {
  level?: number | null;
  name?: string | null;
  school?: string | null;
  castingTime?: string | null;
  range?: string | null;
  duration?: string | null;
  components?: string | null;
  notes?: string | null;
  reference?: string | null;
};

export type PdfAttunedItem = string | AttunedItem;

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
  attunedItems?: readonly PdfAttunedItem[];
  inventoryItems?: readonly string[];
  inventorySummary?: readonly string[];
  cantripSpellNames?: readonly string[];
  knownSpellNames?: readonly string[];
  preparedSpellNames?: readonly string[];
  spellListEntries?: readonly PdfSpellListEntry[];
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
const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN = 24;
const SECTION_HEADER_HEIGHT = 14;
const SECTION_INNER_PADDING = 8;
const CELL_PADDING_X = 3;
const AVERAGE_GLYPH_WIDTH_FACTOR = 0.52;

type TextAlign = "left" | "center" | "right";

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

function formatAttunedItemLine(item: PdfAttunedItem): string | null {
  if (typeof item === "string") {
    const normalized = item.trim();
    return normalized.length > 0 ? normalized : null;
  }

  const name = item.name?.trim() ?? "";
  const itemId = item.itemId?.trim() ?? "";
  const notes = item.notes?.trim() ?? "";
  const base =
    name.length > 0 && itemId.length > 0 ? `${name} (${itemId})` : name || itemId;
  if (!base) {
    return notes || null;
  }
  return notes.length > 0 ? `${base}: ${notes}` : base;
}

function normalizeAttunedItemLines(items: readonly PdfAttunedItem[] | undefined): string[] {
  if (!items || items.length === 0) {
    return ["None"];
  }
  const lines = items
    .map((item) => formatAttunedItemLine(item))
    .filter((line): line is string => typeof line === "string" && line.length > 0);
  return lines.length > 0 ? lines : ["None"];
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

function estimateTextWidth(text: string, size: number): number {
  return text.length * size * AVERAGE_GLYPH_WIDTH_FACTOR;
}

function truncateTextToWidth(value: string, maxWidth: number, size: number, maxLength = 200): string {
  const clippedByLength = truncateText(value, maxLength);
  if (maxWidth <= 0) {
    return "";
  }
  if (estimateTextWidth(clippedByLength, size) <= maxWidth) {
    return clippedByLength;
  }

  const minChars = 4;
  const estimatedChars = Math.max(minChars, Math.floor(maxWidth / Math.max(1, size * AVERAGE_GLYPH_WIDTH_FACTOR)));
  let end = Math.min(clippedByLength.length, estimatedChars);
  while (end >= minChars) {
    const candidate = `${clippedByLength.slice(0, Math.max(1, end - 3)).trimEnd()}...`;
    if (estimateTextWidth(candidate, size) <= maxWidth) {
      return candidate;
    }
    end -= 1;
  }

  return "...";
}

function drawTextInCell(
  commands: string[],
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  bold: boolean,
  align: TextAlign = "left",
  maxLength = 120
): void {
  const maxTextWidth = Math.max(1, width - CELL_PADDING_X * 2);
  const clipped = truncateTextToWidth(text, maxTextWidth, size, maxLength);
  const textWidth = estimateTextWidth(clipped, size);
  let drawX = x + CELL_PADDING_X;

  if (align === "center") {
    drawX = x + (width - textWidth) / 2;
  } else if (align === "right") {
    drawX = x + width - CELL_PADDING_X - textWidth;
  }

  const clampedX = Math.max(x + CELL_PADDING_X, drawX);
  drawText(commands, clipped, clampedX, y, size, bold);
}

function ensurePageSpace(currentY: number, bottomY: number, requiredHeight: number): boolean {
  return currentY - requiredHeight >= bottomY;
}

function paginateByPageSpace<T>(rows: readonly T[], topY: number, bottomY: number, rowHeight: number): T[][] {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let cursorY = topY;

  for (const row of rows) {
    if (currentPage.length > 0 && !ensurePageSpace(cursorY, bottomY, rowHeight)) {
      pages.push(currentPage);
      currentPage = [];
      cursorY = topY;
    }
    currentPage.push(row);
    cursorY -= rowHeight;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}

function drawSection(
  commands: string[],
  x: number,
  y: number,
  width: number,
  height: number,
  title: string
): void {
  commands.push(`${x} ${y} ${width} ${height} re S`);
  commands.push("0.94 g");
  commands.push(`${x} ${y + height - SECTION_HEADER_HEIGHT} ${width} ${SECTION_HEADER_HEIGHT} re f`);
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
  size = 8,
  maxLength = 56,
  maxWidth?: number
): void {
  for (let index = 0; index < Math.min(maxLines, lines.length); index += 1) {
    const truncated = truncateText(lines[index], maxLength);
    const finalText =
      typeof maxWidth === "number" ? truncateTextToWidth(truncated, maxWidth, size, maxLength) : truncated;
    drawText(commands, finalText, x, topY - index * lineHeight, size, false);
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
  const fieldTextWidth = Math.max(1, width - CELL_PADDING_X * 2);
  drawText(
    commands,
    truncateTextToWidth(label.toUpperCase(), fieldTextWidth, 6, 40),
    x + CELL_PADDING_X,
    y + height - 8,
    6,
    true
  );
  drawText(
    commands,
    truncateTextToWidth(value, fieldTextWidth, valueSize, maxLength),
    x + CELL_PADDING_X,
    y + 5,
    valueSize,
    true
  );
}

function normalizeDisplayValues(values: readonly string[] | undefined): string[] {
  if (!values || values.length === 0) {
    return [];
  }
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function wrapText(value: string, maxCharsPerLine: number): string[] {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    return [];
  }
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) {
      lines.push(current);
      current = "";
    }
  };

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      flush();
      let cursor = 0;
      while (cursor < word.length) {
        lines.push(word.slice(cursor, cursor + maxCharsPerLine));
        cursor += maxCharsPerLine;
      }
      continue;
    }
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      flush();
      current = word;
    }
  }
  flush();
  return lines;
}

function toLabeledLines(
  label: string,
  value: string | null | undefined,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return [`${label}: -`];
  }
  const labelPrefix = `${label}: `;
  const remainingOnFirstLine = Math.max(8, maxCharsPerLine - labelPrefix.length);
  const wrapped = wrapText(normalizedValue, remainingOnFirstLine);
  if (wrapped.length === 0) {
    return [`${label}: -`];
  }
  const lines = [`${labelPrefix}${wrapped[0]}`];
  for (let index = 1; index < wrapped.length && lines.length < maxLines; index += 1) {
    lines.push(`  ${wrapped[index]}`);
  }
  return lines;
}

function toListLine(label: string, values: readonly string[] | undefined): string {
  const normalized = normalizeDisplayValues(values);
  return `${label}: ${normalized.length > 0 ? normalized.join(", ") : "-"}`;
}

function formatSpellcastingAbility(value: Ability | null | undefined): string {
  if (!value) {
    return "-";
  }
  return ABILITY_LABELS[value] ?? value.toUpperCase();
}

function formatNumeric(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.floor(value)}` : "-";
}

function normalizeSpellTableRows(
  rows: readonly PdfSpellListEntry[] | undefined
): Array<{
  level: string;
  name: string;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  notes: string;
  reference: string;
}> {
  if (!rows || rows.length === 0) {
    return [];
  }

  const toCell = (value: string | null | undefined): string => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : "-";
  };

  return rows.map((row) => {
    const level =
      typeof row.level === "number" && Number.isFinite(row.level)
        ? row.level === 0
          ? "C"
          : `${Math.max(0, Math.floor(row.level))}`
        : "-";
    return {
      level,
      name: toCell(row.name),
      school: toCell(row.school),
      castingTime: toCell(row.castingTime),
      range: toCell(row.range),
      duration: toCell(row.duration),
      components: toCell(row.components),
      notes: toCell(row.notes),
      reference: toCell(row.reference),
    };
  });
}

function buildPdfDocument(pageStreams: readonly string[]): Uint8Array {
  const normalizedStreams = pageStreams.map((stream) => `${stream.trimEnd()}\n`);
  const pageCount = normalizedStreams.length;
  const pageObjectStart = 3;
  const pageObjectEnd = pageObjectStart + pageCount - 1;
  const fontObjectStart = pageObjectEnd + 1;
  const contentObjectStart = fontObjectStart + 2;
  const fontRegularObjectId = fontObjectStart;
  const fontBoldObjectId = fontObjectStart + 1;

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${normalizedStreams
      .map((_stream, index) => `${pageObjectStart + index} 0 R`)
      .join(" ")}] /Count ${pageCount} >>`
  );

  normalizedStreams.forEach((_stream, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularObjectId} 0 R /F2 ${fontBoldObjectId} 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`
    );
  });

  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  normalizedStreams.forEach((stream) => {
    objects.push(`<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream`);
  });

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

function createNarrativeContinuationPageStream(lines: readonly string[], pageNumber: number): string {
  const commands: string[] = [];
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const sectionY = PDF_MARGIN;
  const sectionHeight = PDF_PAGE_HEIGHT - PDF_MARGIN * 2 - 20;
  const lineHeight = 10;
  const lineTopY = sectionY + sectionHeight - 22;

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - PAGE 2 (CONTINUED)", PDF_MARGIN, 778, 11, true);
  drawText(commands, `Continuation ${pageNumber}`, PDF_MARGIN, 764, 8, false);
  drawSection(
    commands,
    PDF_MARGIN,
    sectionY,
    contentWidth,
    sectionHeight,
    "Narrative / Companion / Familiar (continued)"
  );
  drawList(
    commands,
    lines,
    PDF_MARGIN + SECTION_INNER_PADDING,
    lineTopY,
    lines.length,
    lineHeight,
    8,
    140,
    contentWidth - SECTION_INNER_PADDING * 2
  );

  return commands.join("\n");
}

function createSupplementalPageStreams(snapshot: PdfExportCharacterSnapshot): string[] {
  const commands: string[] = [];
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const sectionGap = 8;
  const columnWidth = (contentWidth - sectionGap) / 2;
  const leftX = PDF_MARGIN;
  const rightX = PDF_MARGIN + columnWidth + sectionGap;

  const topY = 506;
  const topHeight = 246;
  const middleY = 314;
  const middleHeight = 184;
  const bottomY = 24;
  const bottomHeight = 282;

  const spellSlots = snapshot.spellSlots ?? ([0, 0, 0, 0, 0, 0, 0, 0, 0] as const);
  const spellSlotRows = Array.from({ length: 9 }, (_, index) => {
    const level = index + 1;
    const total = spellSlots[index] ?? 0;
    return {
      level,
      total: total > 0 ? `${total}` : "-",
      used: total > 0 ? "-" : "-",
    };
  });
  const hasAnySpellSlots = spellSlotRows.some((row) => row.total !== "-");

  const cantripCount = snapshot.cantripSpellNames?.length ?? 0;
  const preparedCount = snapshot.preparedSpellNames?.length ?? 0;
  const knownCount = snapshot.knownSpellNames?.length ?? 0;
  const cantripLine = `Cantrips: ${cantripCount}`;
  const preparedLine = `Prepared: ${preparedCount}`;
  const knownLine = `Known: ${knownCount}`;

  const inventoryLines = normalizeLines(snapshot.inventoryItems ?? snapshot.inventorySummary, "Other Gear: None");
  const attunedLines = normalizeAttunedItemLines(snapshot.attunedItems);
  const attunedCount = attunedLines[0] === "None" ? 0 : attunedLines.length;

  const companionSummary = [
    snapshot.companionName?.trim(),
    snapshot.companionType?.trim() ? `(${snapshot.companionType.trim()})` : "",
    snapshot.companionSummary?.trim(),
    snapshot.companionNotes?.trim(),
  ]
    .filter((part) => Boolean(part))
    .join(" ");
  const familiarSummary = [
    snapshot.familiarName?.trim(),
    snapshot.familiarType?.trim() ? `(${snapshot.familiarType.trim()})` : "",
    snapshot.familiarSummary?.trim(),
    snapshot.familiarNotes?.trim(),
  ]
    .filter((part) => Boolean(part))
    .join(" ");

  const narrativeLines = [
    ...toLabeledLines("Alignment", snapshot.alignment, 95, 1),
    ...toLabeledLines("Appearance", snapshot.appearance, 95, 3),
    ...toLabeledLines("Physical", snapshot.physicalDescription, 95, 3),
    ...toLabeledLines("Backstory", snapshot.backstory, 95, 6),
    ...toLabeledLines("Notes", snapshot.notes, 95, 4),
    ...toLabeledLines("Companion", companionSummary, 95, 3),
    ...toLabeledLines("Familiar", familiarSummary, 95, 3),
  ];
  const warningLines =
    snapshot.warningMessages && snapshot.warningMessages.length > 0
      ? ["Warnings:", ...snapshot.warningMessages.map((message) => `! ${message}`)]
      : [];
  const narrativeAndWarningLines = [...narrativeLines, ...warningLines];
  const narrativeLineHeight = 10;
  const narrativeTopLineY = bottomY + bottomHeight - 22;
  const narrativeBottomLineY = bottomY + 12;
  const narrativePages = paginateByPageSpace(
    narrativeAndWarningLines,
    narrativeTopLineY,
    narrativeBottomLineY,
    narrativeLineHeight
  );
  const firstPageNarrativeLines = narrativePages[0] ?? [];

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - PAGE 2", PDF_MARGIN, 778, 11, true);

  drawSection(commands, leftX, topY, columnWidth, topHeight, "Spellcasting");
  const spellcastingFieldsX = leftX + SECTION_INNER_PADDING;
  const spellcastingFieldsWidth = columnWidth - 16;
  const spellcastingFieldGap = 6;
  const spellcastingFieldWidth = (spellcastingFieldsWidth - spellcastingFieldGap) / 2;
  const spellcastingFieldHeight = 30;
  const spellcastingTopFieldY = topY + topHeight - 54;
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Ability",
    formatSpellcastingAbility(snapshot.spellcastingAbility),
    18,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX + spellcastingFieldWidth + spellcastingFieldGap,
    spellcastingTopFieldY,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Modifier",
    typeof snapshot.spellcastingModifier === "number" ? formatModifier(snapshot.spellcastingModifier) : "-",
    12,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY - spellcastingFieldHeight - 6,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Save DC",
    formatNumeric(snapshot.spellSaveDC),
    12,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX + spellcastingFieldWidth + spellcastingFieldGap,
    spellcastingTopFieldY - spellcastingFieldHeight - 6,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Attack Bonus",
    typeof snapshot.spellAttackBonus === "number" ? formatModifier(snapshot.spellAttackBonus) : "-",
    12,
    11
  );
  drawText(commands, cantripLine, spellcastingFieldsX, spellcastingTopFieldY - 44, 7, false);
  drawText(commands, preparedLine, spellcastingFieldsX + 80, spellcastingTopFieldY - 44, 7, false);
  drawText(commands, knownLine, spellcastingFieldsX + 160, spellcastingTopFieldY - 44, 7, false);

  const slotsTableX = spellcastingFieldsX;
  const slotsTableY = topY + 16;
  const slotsTableWidth = spellcastingFieldsWidth;
  const slotsRowHeight = 11;
  const slotsTableRows = 10;
  const slotsTableHeight = slotsRowHeight * slotsTableRows;
  const slotsLevelColumnWidth = 58;
  const slotsTotalColumnWidth = 58;
  const slotsUsedColumnWidth = slotsTableWidth - slotsLevelColumnWidth - slotsTotalColumnWidth;

  commands.push(`${slotsTableX} ${slotsTableY} ${slotsTableWidth} ${slotsTableHeight} re S`);
  for (let index = 1; index < slotsTableRows; index += 1) {
    const y = slotsTableY + slotsTableHeight - index * slotsRowHeight;
    commands.push(`${slotsTableX} ${y} m ${slotsTableX + slotsTableWidth} ${y} l S`);
  }
  commands.push(
    `${slotsTableX + slotsLevelColumnWidth} ${slotsTableY} m ${slotsTableX + slotsLevelColumnWidth} ${slotsTableY + slotsTableHeight} l S`
  );
  commands.push(
    `${slotsTableX + slotsLevelColumnWidth + slotsTotalColumnWidth} ${slotsTableY} m ${slotsTableX + slotsLevelColumnWidth + slotsTotalColumnWidth} ${slotsTableY + slotsTableHeight} l S`
  );

  drawTextInCell(commands, "LEVEL", slotsTableX, slotsTableY + slotsTableHeight - 9, slotsLevelColumnWidth, 6, true, "center");
  drawTextInCell(
    commands,
    "TOTAL",
    slotsTableX + slotsLevelColumnWidth,
    slotsTableY + slotsTableHeight - 9,
    slotsTotalColumnWidth,
    6,
    true,
    "center"
  );
  drawTextInCell(
    commands,
    "USED",
    slotsTableX + slotsLevelColumnWidth + slotsTotalColumnWidth,
    slotsTableY + slotsTableHeight - 9,
    slotsUsedColumnWidth,
    6,
    true,
    "center"
  );
  spellSlotRows.forEach((row, index) => {
    const rowTextY = slotsTableY + slotsTableHeight - slotsRowHeight * (index + 2) + 3;
    drawTextInCell(commands, `${row.level}`, slotsTableX, rowTextY, slotsLevelColumnWidth, 7, false, "center", 3);
    drawTextInCell(
      commands,
      row.total,
      slotsTableX + slotsLevelColumnWidth,
      rowTextY,
      slotsTotalColumnWidth,
      7,
      false,
      "center",
      3
    );
    drawTextInCell(
      commands,
      row.used,
      slotsTableX + slotsLevelColumnWidth + slotsTotalColumnWidth,
      rowTextY,
      slotsUsedColumnWidth,
      7,
      false,
      "center",
      3
    );
  });
  drawText(
    commands,
    hasAnySpellSlots ? "Expended slot tracking is not currently modeled." : "No class spell slots at this level.",
    slotsTableX,
    slotsTableY - 10,
    7,
    false
  );

  drawSection(commands, rightX, topY, columnWidth, topHeight, "Equipment / Inventory");
  const equippedLines = [
    `Armor: ${snapshot.equippedArmorName?.trim() || "-"}`,
    `Shield: ${snapshot.equippedShieldName?.trim() || "-"}`,
    `Weapon: ${snapshot.equippedWeaponName?.trim() || "-"}`,
    "Inventory:",
    ...inventoryLines.map((line) => `- ${line}`),
  ];
  drawList(
    commands,
    equippedLines,
    rightX + SECTION_INNER_PADDING,
    topY + topHeight - 22,
    22,
    10,
    8,
    90,
    columnWidth - SECTION_INNER_PADDING * 2
  );

  drawSection(commands, leftX, middleY, columnWidth, middleHeight, "Training & Proficiencies");
  const proficiencyLines = [
    toListLine("Armor", snapshot.armorProficiencies),
    toListLine("Weapons", snapshot.weaponProficiencies),
    toListLine("Tools", snapshot.toolProficiencies),
    toListLine("Languages", snapshot.languages),
  ];
  drawList(
    commands,
    proficiencyLines,
    leftX + SECTION_INNER_PADDING,
    middleY + middleHeight - 24,
    12,
    12,
    8,
    96,
    columnWidth - SECTION_INNER_PADDING * 2
  );

  drawSection(commands, rightX, middleY, columnWidth, middleHeight, "Currency & Attunement");
  const coinFieldY = middleY + middleHeight - 54;
  const coinFieldGap = 4;
  const coinFieldWidth = (columnWidth - 16 - coinFieldGap * 4) / 5;
  const coinFields: Array<[string, string]> = [
    ["CP", formatNumeric(snapshot.cp)],
    ["SP", formatNumeric(snapshot.sp)],
    ["EP", formatNumeric(snapshot.ep)],
    ["GP", formatNumeric(snapshot.gp)],
    ["PP", formatNumeric(snapshot.pp)],
  ];
  coinFields.forEach(([label, value], index) => {
    drawField(
      commands,
      rightX + 8 + index * (coinFieldWidth + coinFieldGap),
      coinFieldY,
      coinFieldWidth,
      30,
      label,
      value,
      8,
      10
    );
  });
  drawText(
    commands,
    truncateTextToWidth(`Other Wealth: ${snapshot.otherWealth?.trim() || "-"}`, columnWidth - 16, 8, 120),
    rightX + SECTION_INNER_PADDING,
    coinFieldY - 12,
    8,
    false
  );
  drawText(commands, `Attuned Items (${attunedCount}):`, rightX + SECTION_INNER_PADDING, middleY + 62, 8, true);
  drawList(
    commands,
    attunedLines.map((line) => `- ${line}`),
    rightX + SECTION_INNER_PADDING,
    middleY + 50,
    4,
    10,
    8,
    96,
    columnWidth - SECTION_INNER_PADDING * 2
  );

  drawSection(commands, PDF_MARGIN, bottomY, contentWidth, bottomHeight, "Narrative / Companion / Familiar");
  drawList(
    commands,
    firstPageNarrativeLines,
    PDF_MARGIN + SECTION_INNER_PADDING,
    narrativeTopLineY,
    firstPageNarrativeLines.length,
    narrativeLineHeight,
    8,
    140,
    contentWidth - SECTION_INNER_PADDING * 2
  );

  const streams = [commands.join("\n")];
  for (let pageIndex = 1; pageIndex < narrativePages.length; pageIndex += 1) {
    streams.push(createNarrativeContinuationPageStream(narrativePages[pageIndex], pageIndex + 1));
  }
  return streams;
}

function createSpellListPageStreams(snapshot: PdfExportCharacterSnapshot): string[] {
  const rows = normalizeSpellTableRows(snapshot.spellListEntries);
  if (rows.length === 0) {
    return [];
  }

  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const tableX = PDF_MARGIN;
  const tableTopY = 746;
  const tableBottomY = 34;
  const tableRowHeight = 13;
  const pagedRows = paginateByPageSpace(rows, tableTopY - tableRowHeight, tableBottomY, tableRowHeight);
  const pageCount = pagedRows.length;

  const columns = [
    { key: "level", label: "LVL", width: 32, maxLength: 3, align: "center" as const },
    { key: "name", label: "NAME", width: 120, maxLength: 24, align: "left" as const },
    { key: "school", label: "SCHOOL", width: 58, maxLength: 11, align: "left" as const },
    { key: "castingTime", label: "CASTING", width: 68, maxLength: 14, align: "left" as const },
    { key: "range", label: "RANGE", width: 56, maxLength: 11, align: "left" as const },
    { key: "duration", label: "DURATION", width: 72, maxLength: 14, align: "left" as const },
    { key: "components", label: "COMP", width: 58, maxLength: 11, align: "left" as const },
    { key: "notes", label: "NOTES", width: 70, maxLength: 15, align: "left" as const },
    { key: "reference", label: "REF", width: 30, maxLength: 8, align: "center" as const },
  ] as const;

  const streams: string[] = [];
  let rowCursor = 0;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageRows = pagedRows[pageIndex];
    const startIndex = rowCursor + 1;
    const endIndex = rowCursor + pageRows.length;
    rowCursor += pageRows.length;
    const commands: string[] = [];
    const tableRows = pageRows.length + 1;
    const tableHeight = tableRows * tableRowHeight;
    const tableY = tableTopY - tableHeight;

    commands.push("0.2 w");
    drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - SPELL LIST", PDF_MARGIN, 778, 11, true);
    drawText(
      commands,
      truncateTextToWidth(
        `Character: ${snapshot.characterName?.trim() || "Unnamed Character"} | ${snapshot.className?.trim() || "Class Unset"} | Level ${Math.max(1, Math.floor(snapshot.level || 1))}`,
        contentWidth,
        8,
        160
      ),
      PDF_MARGIN,
      764,
      8,
      false
    );
    drawText(
      commands,
      `Page ${pageIndex + 1} of ${pageCount} | Spells ${startIndex}-${endIndex} of ${rows.length}`,
      PDF_MARGIN,
      752,
      8,
      false
    );

    commands.push(`${tableX} ${tableY} ${contentWidth} ${tableHeight} re S`);
    for (let rowIndex = 1; rowIndex < tableRows; rowIndex += 1) {
      const y = tableY + tableHeight - rowIndex * tableRowHeight;
      commands.push(`${tableX} ${y} m ${tableX + contentWidth} ${y} l S`);
    }

    let columnCursor = tableX;
    for (let columnIndex = 0; columnIndex < columns.length - 1; columnIndex += 1) {
      columnCursor += columns[columnIndex].width;
      commands.push(`${columnCursor} ${tableY} m ${columnCursor} ${tableY + tableHeight} l S`);
    }

    columnCursor = tableX;
    for (const column of columns) {
      drawTextInCell(
        commands,
        column.label,
        columnCursor,
        tableY + tableHeight - 9,
        column.width,
        6,
        true,
        column.align,
        20
      );
      columnCursor += column.width;
    }

    pageRows.forEach((row, rowIndex) => {
      const rowTextY = tableY + tableHeight - tableRowHeight * (rowIndex + 2) + 3;
      let x = tableX;
      for (const column of columns) {
        drawTextInCell(commands, row[column.key], x, rowTextY, column.width, 7, false, column.align, column.maxLength);
        x += column.width;
      }
    });

    streams.push(commands.join("\n"));
  }

  return streams;
}

function createPdfFromCharacterSheet(snapshot: PdfExportCharacterSnapshot): Uint8Array {
  const commands: string[] = [];
  const pageWidth = PDF_PAGE_WIDTH;
  const margin = PDF_MARGIN;
  const contentWidth = pageWidth - margin * 2;
  const sectionGap = 8;
  const leftWidth = 188;
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
  const classFeatureLines = (() => {
    const merged = normalizeDisplayValues([
      ...(snapshot.classFeatureNames ?? []),
      ...(snapshot.selectedFeatureNames ?? []),
    ]);
    return merged.length > 0 ? merged : ["None"];
  })();
  const speciesTraitLines = normalizeLines(snapshot.speciesTraitNames, "None");
  const featLines = normalizeLines(snapshot.featNames, "None");
  const conditionLines = normalizeLines(snapshot.activeConditionNames, "None");
  const saveProficiencySet = new Set(snapshot.saveProficiencies ?? []);
  const cantripRows = (snapshot.cantripSpellNames ?? []).slice(0, 2).map((name) => ({
    name: `Cantrip: ${name}`,
    bonus:
      typeof snapshot.spellAttackBonus === "number"
        ? formatModifier(snapshot.spellAttackBonus)
        : typeof snapshot.spellSaveDC === "number"
          ? `DC ${snapshot.spellSaveDC}`
          : "-",
    damage: "See spell",
    notes: "Cantrip",
  }));
  const attackRows = [
    {
      name: snapshot.attackName?.trim() || "-",
      bonus: attackBonusOrDc,
      damage: snapshot.attackDamage?.trim() || "-",
      notes: attackNotes,
    },
    ...cantripRows,
  ];
  while (attackRows.length < 6) {
    attackRows.push({ name: "-", bonus: "-", damage: "-", notes: "-" });
  }

  const identityY = 706;
  const identityHeight = 62;
  const combatY = 640;
  const combatHeight = 58;
  const survivabilityY = 572;
  const survivabilityHeight = 60;
  const bodyTop = survivabilityY - sectionGap;
  const bodyBottom = 24;

  const abilityY = 186;
  const abilityHeight = bodyTop - abilityY;
  const trainingY = bodyBottom;
  const trainingHeight = abilityY - bodyBottom - sectionGap;

  const conditionsY = 514;
  const conditionsHeight = bodyTop - conditionsY;
  const attacksY = 362;
  const attacksHeight = conditionsY - attacksY - sectionGap;
  const featuresY = bodyBottom;
  const featuresHeight = attacksY - bodyBottom - sectionGap;

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET", margin, 778, 11, true);

  drawSection(commands, margin, identityY, contentWidth, identityHeight, "Identity Header");
  const identityInnerX = margin + SECTION_INNER_PADDING;
  const identityFieldHeight = 20;
  const identityTopRowY = identityY + 22;
  const identityBottomRowY = identityY + 1;
  const idTop = [
    { label: "Character Name", value: characterName, width: 222 },
    { label: "Class / Subclass", value: classAndSubclass, width: 168 },
    { label: "Level", value: `${level}`, width: 46 },
    { label: "XP", value: xpValue === null ? "-" : `${xpValue}`, width: 94 },
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
    { label: "Background", value: backgroundLabel, width: 198 },
    { label: "Species", value: speciesLabel, width: 140 },
    { label: "Heroic Inspiration", value: heroicInspirationLabel, width: 198 },
  ] as const;
  idCursor = identityInnerX;
  for (const field of idBottom) {
    drawField(commands, idCursor, identityBottomRowY, field.width, identityFieldHeight, field.label, field.value);
    idCursor += field.width + 6;
  }

  drawSection(commands, margin, combatY, contentWidth, combatHeight, "Combat");
  const combatStats = [
    ["Armor Class", `${snapshot.armorClass}`],
    ["Shield", shieldContribution],
    ["Speed", `${snapshot.speed} ft`],
    ["Initiative", initiative],
    ["Prof Bonus", proficiencyBonusLabel],
  ] as const;
  const combatBoxGap = 6;
  const combatBoxWidth = (contentWidth - 16 - combatBoxGap * 4) / 5;
  const combatBoxHeight = 34;
  combatStats.forEach(([label, value], index) => {
    const x = margin + 8 + index * (combatBoxWidth + combatBoxGap);
    const y = combatY + 8;
    commands.push(`${x} ${y} ${combatBoxWidth} ${combatBoxHeight} re S`);
    drawTextInCell(commands, label, x, y + 23, combatBoxWidth, 6, true, "center", 24);
    drawTextInCell(commands, value, x, y + 8, combatBoxWidth, 11, true, "center", 16);
  });

  drawSection(commands, margin, survivabilityY, contentWidth, survivabilityHeight, "Survivability");
  const survivabilityFields = [
    ["Current HP", `${currentHP}`],
    ["Max HP", `${snapshot.maxHP}`],
    ["Temp HP", `${tempHP}`],
    ["Hit Dice", `${hitDiceSpent}/${hitDiceTotal ?? "-"}`],
    ["Death Saves", `${deathSaveSuccesses}/${deathSaveFailures}`],
  ] as const;
  const survivabilityGap = 6;
  const survivabilityFieldWidth = (contentWidth - 16 - survivabilityGap * 4) / 5;
  survivabilityFields.forEach(([label, value], index) => {
    drawField(
      commands,
      margin + 8 + index * (survivabilityFieldWidth + survivabilityGap),
      survivabilityY + 8,
      survivabilityFieldWidth,
      34,
      label,
      value,
      18,
      10
    );
  });

  drawSection(commands, leftX, abilityY, leftWidth, abilityHeight, "Abilities");
  const abilityInnerX = leftX + SECTION_INNER_PADDING;
  const abilityInnerWidth = leftWidth - SECTION_INNER_PADDING * 2;
  const abilityColumnGap = 6;
  const abilityColumnWidth = (abilityInnerWidth - abilityColumnGap) / 2;
  const abilityRowGap = 6;
  const abilityBoxHeight = (abilityHeight - 26 - abilityRowGap * 2) / 3;
  const firstAbilityY = abilityY + abilityHeight - 20 - abilityBoxHeight;
  const abilityPairs: Array<[Ability, Ability]> = [
    ["str", "int"],
    ["dex", "wis"],
    ["con", "cha"],
  ];
  abilityPairs.forEach(([leftAbility, rightAbility], rowIndex) => {
    const rowY = firstAbilityY - rowIndex * (abilityBoxHeight + abilityRowGap);
    [leftAbility, rightAbility].forEach((ability, columnIndex) => {
      const boxX = abilityInnerX + columnIndex * (abilityColumnWidth + abilityColumnGap);
      commands.push(`${boxX} ${rowY} ${abilityColumnWidth} ${abilityBoxHeight} re S`);
      drawText(commands, ABILITY_LABELS[ability], boxX + 4, rowY + abilityBoxHeight - 12, 8, true);

      const scoreFieldY = rowY + abilityBoxHeight - 48;
      const scoreFieldWidth = abilityColumnWidth - 8;
      drawField(
        commands,
        boxX + 4,
        scoreFieldY,
        scoreFieldWidth,
        34,
        "Score",
        `${snapshot.abilities[ability] ?? 0}`,
        4,
        10
      );

      const saveValue = snapshot.savingThrows?.[ability] ?? snapshot.abilityMods[ability] ?? 0;
      const saveText = `${saveProficiencySet.has(ability) ? "P " : ""}${formatModifier(saveValue)}`;
      const bottomFieldGap = 4;
      const bottomFieldWidth = (abilityColumnWidth - 8 - bottomFieldGap) / 2;
      drawField(
        commands,
        boxX + 4,
        rowY + 8,
        bottomFieldWidth,
        30,
        "Mod",
        formatModifier(snapshot.abilityMods[ability] ?? 0),
        8,
        9
      );
      drawField(
        commands,
        boxX + 4 + bottomFieldWidth + bottomFieldGap,
        rowY + 8,
        bottomFieldWidth,
        30,
        "Save",
        saveText,
        12,
        9
      );
    });
  });

  drawSection(commands, leftX, trainingY, leftWidth, trainingHeight, "Proficiencies");
  const trainingLines = [
    toListLine("Armor", snapshot.armorProficiencies),
    toListLine("Weapons", snapshot.weaponProficiencies),
    toListLine("Tools", snapshot.toolProficiencies),
    toListLine("Languages", snapshot.languages),
  ];
  drawList(
    commands,
    trainingLines,
    leftX + SECTION_INNER_PADDING,
    trainingY + trainingHeight - 22,
    10,
    12,
    8,
    96,
    leftWidth - SECTION_INNER_PADDING * 2
  );

  drawSection(commands, rightX, attacksY, rightWidth, attacksHeight, "Weapons / Attacks");
  const tableX = rightX + 8;
  const tableY = attacksY + 16;
  const tableWidth = rightWidth - 16;
  const tableRowHeight = 17;
  const tableRows = 7;
  const tableHeight = tableRows * tableRowHeight;
  const attackColumns: readonly number[] = [
    Math.floor(tableWidth * 0.3),
    Math.floor(tableWidth * 0.15),
    Math.floor(tableWidth * 0.28),
    tableWidth - Math.floor(tableWidth * 0.3) - Math.floor(tableWidth * 0.15) - Math.floor(tableWidth * 0.28),
  ];
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
  drawTextInCell(commands, "NAME", tableX, tableY + tableHeight - 13, attackColumns[0], 6, true, "center", 20);
  drawTextInCell(
    commands,
    "ATK BONUS / DC",
    tableX + attackColumns[0],
    tableY + tableHeight - 13,
    attackColumns[1],
    6,
    true,
    "center",
    20
  );
  drawTextInCell(
    commands,
    "DAMAGE / TYPE",
    tableX + attackColumns[0] + attackColumns[1],
    tableY + tableHeight - 13,
    attackColumns[2],
    6,
    true,
    "center",
    32
  );
  drawTextInCell(
    commands,
    "NOTES",
    tableX + attackColumns[0] + attackColumns[1] + attackColumns[2],
    tableY + tableHeight - 13,
    attackColumns[3],
    6,
    true,
    "center",
    20
  );
  attackRows.forEach((row, index) => {
    const rowTopY = tableY + tableHeight - tableRowHeight * (index + 1);
    const rowTextY = rowTopY - 13;
    drawTextInCell(commands, row.name, tableX, rowTextY, attackColumns[0], 8, false, "left", 30);
    drawTextInCell(commands, row.bonus, tableX + attackColumns[0], rowTextY, attackColumns[1], 8, false, "center", 14);
    drawTextInCell(
      commands,
      row.damage,
      tableX + attackColumns[0] + attackColumns[1],
      rowTextY,
      attackColumns[2],
      8,
      false,
      "left",
      24
    );
    drawTextInCell(
      commands,
      row.notes,
      tableX + attackColumns[0] + attackColumns[1] + attackColumns[2],
      rowTextY,
      attackColumns[3],
      8,
      false,
      "left",
      26
    );
  });

  drawSection(commands, rightX, conditionsY, rightWidth, conditionsHeight, "Conditions / Exhaustion");
  drawField(commands, rightX + rightWidth - 92, conditionsY + 9, 84, 30, "Exhaustion", `${exhaustionLevel}`, 12, 11);
  drawList(
    commands,
    conditionLines.map((line) => `- ${line}`),
    rightX + 8,
    conditionsY + conditionsHeight - 20,
    3,
    10,
    8,
    52,
    rightWidth - 108
  );

  drawSection(commands, rightX, featuresY, rightWidth, featuresHeight, "Features Summary");
  const featuresInnerX = rightX + SECTION_INNER_PADDING;
  const featuresInnerY = featuresY + SECTION_INNER_PADDING;
  const featuresInnerWidth = rightWidth - SECTION_INNER_PADDING * 2;
  const featuresInnerHeight = featuresHeight - SECTION_HEADER_HEIGHT - 12;
  const classPanelHeight = Math.floor(featuresInnerHeight * 0.58);
  const lowerPanelsY = featuresInnerY;
  const lowerPanelHeight = featuresInnerHeight - classPanelHeight - 6;
  const classPanelY = lowerPanelsY + lowerPanelHeight + 6;
  const lowerPanelGap = 6;
  const lowerPanelWidth = (featuresInnerWidth - lowerPanelGap) / 2;
  const speciesPanelX = featuresInnerX;
  const featPanelX = speciesPanelX + lowerPanelWidth + lowerPanelGap;

  commands.push(`${featuresInnerX} ${classPanelY} ${featuresInnerWidth} ${classPanelHeight} re S`);
  commands.push(`${speciesPanelX} ${lowerPanelsY} ${lowerPanelWidth} ${lowerPanelHeight} re S`);
  commands.push(`${featPanelX} ${lowerPanelsY} ${lowerPanelWidth} ${lowerPanelHeight} re S`);

  drawText(commands, "CLASS FEATURES", featuresInnerX + 4, classPanelY + classPanelHeight - 10, 7, true);
  drawList(
    commands,
    classFeatureLines.map((line) => `- ${line}`),
    featuresInnerX + 4,
    classPanelY + classPanelHeight - 22,
    Math.max(1, Math.floor((classPanelHeight - 20) / 9)),
    9,
    8,
    84,
    featuresInnerWidth - 8
  );

  drawText(commands, "SPECIES TRAITS", speciesPanelX + 4, lowerPanelsY + lowerPanelHeight - 10, 7, true);
  drawList(
    commands,
    speciesTraitLines.map((line) => `- ${line}`),
    speciesPanelX + 4,
    lowerPanelsY + lowerPanelHeight - 22,
    Math.max(1, Math.floor((lowerPanelHeight - 20) / 9)),
    9,
    8,
    56,
    lowerPanelWidth - 8
  );

  drawText(commands, "FEATS", featPanelX + 4, lowerPanelsY + lowerPanelHeight - 10, 7, true);
  drawList(
    commands,
    featLines.map((line) => `- ${line}`),
    featPanelX + 4,
    lowerPanelsY + lowerPanelHeight - 22,
    Math.max(1, Math.floor((lowerPanelHeight - 20) / 9)),
    9,
    8,
    56,
    lowerPanelWidth - 8
  );

  const pageOneStream = commands.join("\n");
  const supplementalStreams = createSupplementalPageStreams(snapshot);
  const spellListStreams = createSpellListPageStreams(snapshot);
  return buildPdfDocument([pageOneStream, ...supplementalStreams, ...spellListStreams]);
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
