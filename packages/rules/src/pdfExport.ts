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
  attacks?: ReadonlyArray<{
    name: string;
    toHit?: number | null;
    damage?: string | null;
    notes?: string | null;
  }>;
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
  spellSlotsExpended?: readonly (number | null)[] | null;
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
const SECTION_LIST_TOP_OFFSET = SECTION_HEADER_HEIGHT + SECTION_INNER_PADDING;
const SECTION_LIST_BOTTOM_PADDING = SECTION_INNER_PADDING + 4;
const CELL_PADDING_X = 3;
const AVERAGE_GLYPH_WIDTH_FACTOR = 0.52;
const TEXT_WIDTH_SAFETY_FACTOR = 1.08;
const FIELD_LABEL_SIZE = 6;
const FIELD_LABEL_BASELINE_OFFSET = 8;
const FIELD_VALUE_DEFAULT_BASELINE_OFFSET = 5;
const FIELD_VALUE_MIN_BASELINE_OFFSET = 2;
const FIELD_TEXT_ASCENT_FACTOR = 0.82;
const FIELD_LABEL_VALUE_GAP = 2;
const DETAIL_SECTION_CHROME_HEIGHT = SECTION_HEADER_HEIGHT + SECTION_INNER_PADDING * 2 + 4;
const DETAIL_SECTION_SAFETY_BUFFER = 8;
const DETAIL_PAGE_BREAK_THRESHOLD = 12;
const WIDE_GLYPH_PATTERN = /[MW@#%&]/g;
const NARROW_GLYPH_PATTERN = /[.,'`!|:;ilIjt]/g;

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
  const baseWidth = text.length * size * AVERAGE_GLYPH_WIDTH_FACTOR;
  const wideGlyphCount = text.match(WIDE_GLYPH_PATTERN)?.length ?? 0;
  const narrowGlyphCount = text.match(NARROW_GLYPH_PATTERN)?.length ?? 0;
  const adjustedWidth = baseWidth + wideGlyphCount * size * 0.18 - narrowGlyphCount * size * 0.08;
  return Math.max(size * 0.5, adjustedWidth) * TEXT_WIDTH_SAFETY_FACTOR;
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

  const minDrawX = x + CELL_PADDING_X;
  const maxDrawX = x + width - CELL_PADDING_X - textWidth;
  const clampedX = Math.min(Math.max(minDrawX, drawX), Math.max(minDrawX, maxDrawX));
  drawText(commands, clipped, clampedX, y, size, bold);
}

function ensurePageSpace(currentY: number, bottomY: number, requiredHeight: number): boolean {
  return currentY - requiredHeight >= bottomY;
}

function hasActivePageContent(cursorY: number, topY: number): boolean {
  return cursorY < topY - DETAIL_PAGE_BREAK_THRESHOLD;
}

function sectionListTopY(sectionY: number, sectionHeight: number): number {
  return sectionY + sectionHeight - SECTION_LIST_TOP_OFFSET;
}

function sectionListMinY(sectionY: number): number {
  return sectionY + SECTION_LIST_BOTTOM_PADDING;
}

function maxListLinesForSection(sectionHeight: number, lineHeight: number): number {
  const top = sectionHeight - SECTION_LIST_TOP_OFFSET;
  const bottom = SECTION_LIST_BOTTOM_PADDING;
  return Math.max(1, Math.floor((top - bottom) / lineHeight) + 1);
}

function maxSectionLinesForPageSpace(availableHeight: number, lineHeight: number): number {
  return Math.max(
    1,
    Math.floor((availableHeight - DETAIL_SECTION_CHROME_HEIGHT - DETAIL_SECTION_SAFETY_BUFFER) / lineHeight)
  );
}

function detailSectionHeight(lineCount: number, lineHeight: number): number {
  return DETAIL_SECTION_CHROME_HEIGHT + lineCount * lineHeight;
}

function rowTopY(tableY: number, tableHeight: number, rowHeight: number, rowIndexFromTop: number): number {
  return tableY + tableHeight - rowHeight * rowIndexFromTop;
}

function rowBaselineY(rowTop: number, rowHeight: number, textSize: number): number {
  const bottomPadding = Math.max(1.5, (rowHeight - textSize) / 2 + 1);
  return Math.round((rowTop - rowHeight + bottomPadding) * 100) / 100;
}

function fieldValueBaselineY(y: number, height: number, valueSize: number): number {
  const labelBaseline = y + height - FIELD_LABEL_BASELINE_OFFSET;
  const maxValueTop = labelBaseline - FIELD_LABEL_VALUE_GAP;
  const maxValueBaseline = maxValueTop - valueSize * FIELD_TEXT_ASCENT_FACTOR;
  return Math.max(
    y + FIELD_VALUE_MIN_BASELINE_OFFSET,
    Math.min(y + FIELD_VALUE_DEFAULT_BASELINE_OFFSET, maxValueBaseline)
  );
}

function paginateByPageSpace<T>(rows: readonly T[], topY: number, bottomY: number, rowHeight: number): T[][] {
  if (rows.length === 0) {
    return [];
  }

  if (rowHeight <= 0 || topY <= bottomY) {
    return [rows.slice()];
  }

  const pages: T[][] = [];
  let currentPage: T[] = [];
  let cursorY = topY;

  for (const row of rows) {
    if (!ensurePageSpace(cursorY, bottomY, rowHeight) && currentPage.length > 0) {
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
  maxWidth?: number,
  minY = Number.NEGATIVE_INFINITY
): void {
  for (let index = 0; index < Math.min(maxLines, lines.length); index += 1) {
    const lineY = topY - index * lineHeight;
    if (lineY < minY) {
      break;
    }
    const truncated = truncateText(lines[index], maxLength);
    const finalText =
      typeof maxWidth === "number" ? truncateTextToWidth(truncated, maxWidth, size, maxLength) : truncated;
    drawText(commands, finalText, x, lineY, size, false);
  }
}

function drawListInSection(
  commands: string[],
  lines: readonly string[],
  sectionX: number,
  sectionY: number,
  sectionWidth: number,
  sectionHeight: number,
  lineHeight: number,
  size = 8,
  maxLength = 56,
  maxLines = lines.length
): void {
  drawList(
    commands,
    lines,
    sectionX + SECTION_INNER_PADDING,
    sectionListTopY(sectionY, sectionHeight),
    maxLines,
    lineHeight,
    size,
    maxLength,
    sectionWidth - SECTION_INNER_PADDING * 2,
    sectionListMinY(sectionY)
  );
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
  const labelY = y + height - FIELD_LABEL_BASELINE_OFFSET;
  const valueY = fieldValueBaselineY(y, height, valueSize);
  drawText(
    commands,
    truncateTextToWidth(label.toUpperCase(), fieldTextWidth, FIELD_LABEL_SIZE, 40),
    x + CELL_PADDING_X,
    labelY,
    FIELD_LABEL_SIZE,
    true
  );
  drawText(
    commands,
    truncateTextToWidth(value, fieldTextWidth, valueSize, maxLength),
    x + CELL_PADDING_X,
    valueY,
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

function toWrappedListLines(
  label: string,
  values: readonly string[] | undefined,
  maxCharsPerLine: number,
  maxLines: number
): string[] {
  const normalized = normalizeDisplayValues(values);
  if (normalized.length === 0) {
    return [`${label}: -`];
  }

  const labelPrefix = `${label}: `;
  const wrapped = wrapText(normalized.join(", "), Math.max(8, maxCharsPerLine - labelPrefix.length));
  if (wrapped.length === 0) {
    return [`${label}: -`];
  }

  const lines = [`${labelPrefix}${wrapped[0]}`];
  for (let index = 1; index < wrapped.length && lines.length < maxLines; index += 1) {
    lines.push(`  ${wrapped[index]}`);
  }
  return lines;
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

function formatCoinTotalInGp(snapshot: PdfExportCharacterSnapshot): string | null {
  const cp = typeof snapshot.cp === "number" ? Math.max(0, snapshot.cp) : 0;
  const sp = typeof snapshot.sp === "number" ? Math.max(0, snapshot.sp) : 0;
  const ep = typeof snapshot.ep === "number" ? Math.max(0, snapshot.ep) : 0;
  const gp = typeof snapshot.gp === "number" ? Math.max(0, snapshot.gp) : 0;
  const pp = typeof snapshot.pp === "number" ? Math.max(0, snapshot.pp) : 0;

  if (cp + sp + ep + gp + pp <= 0) {
    return null;
  }

  const total = cp / 100 + sp / 10 + ep / 2 + gp + pp * 10;
  const rounded = Math.round(total * 100) / 100;
  const asString =
    Math.abs(rounded - Math.floor(rounded)) < 0.00001 ? `${Math.floor(rounded)}` : `${rounded.toFixed(2)}`;
  return `${asString} gp total`;
}

type NormalizedSpellTableRow = {
  level: string;
  name: string;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  notes: string;
  reference: string;
};

function normalizeSpellTableRows(rows: readonly PdfSpellListEntry[] | undefined): NormalizedSpellTableRow[] {
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

type SupplementalSpellRow = {
  level: string;
  name: string;
  castingTime: string;
  range: string;
  flags: string;
  notes: string;
};

function toSpellLevelLabel(level: number | null | undefined): string {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return "-";
  }
  return level === 0 ? "C" : `${Math.max(0, Math.floor(level))}`;
}

function normalizeSupplementalSpellRows(
  entries: readonly PdfSpellListEntry[] | undefined
): SupplementalSpellRow[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  const toCell = (value: string | null | undefined): string => {
    const normalized = value?.trim();
    return normalized && normalized.length > 0 ? normalized : "-";
  };

  return entries.map((entry) => {
    const notes = toCell(entry.notes);
    const components = toCell(entry.components);
    const hasConcentration = /concentration/i.test(notes);
    const hasRitual = /ritual/i.test(notes);
    const hasMaterial = /(^|[^A-Za-z])M([^A-Za-z]|$)/i.test(components);
    return {
      level: toSpellLevelLabel(entry.level),
      name: toCell(entry.name),
      castingTime: toCell(entry.castingTime),
      range: toCell(entry.range),
      flags: `${hasConcentration ? "Y" : "-"} / ${hasRitual ? "Y" : "-"} / ${hasMaterial ? "Y" : "-"}`,
      notes,
    };
  });
}

function maxLinesForSection(sectionHeight: number, lineHeight: number): number {
  return maxListLinesForSection(sectionHeight, lineHeight);
}

function splitLinesForSection(
  lines: readonly string[],
  sectionHeight: number,
  lineHeight: number
): { visible: string[]; overflow: string[] } {
  const maxLines = maxLinesForSection(sectionHeight, lineHeight);
  return {
    visible: lines.slice(0, maxLines),
    overflow: lines.slice(maxLines),
  };
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

function createNarrativeContinuationPageStream(
  lines: readonly string[],
  pageNumber: number,
  title = "Narrative / Companion / Familiar (continued)"
): string {
  const commands: string[] = [];
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const sectionY = PDF_MARGIN;
  const sectionHeight = PDF_PAGE_HEIGHT - PDF_MARGIN * 2 - 20;
  const lineHeight = 10;

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - SUPPLEMENTAL", PDF_MARGIN, 778, 11, true);
  drawText(commands, `Continuation ${pageNumber}`, PDF_MARGIN, 764, 8, false);
  drawSection(
    commands,
    PDF_MARGIN,
    sectionY,
    contentWidth,
    sectionHeight,
    title
  );
  drawListInSection(
    commands,
    lines,
    PDF_MARGIN,
    sectionY,
    contentWidth,
    sectionHeight,
    lineHeight,
    8,
    140
  );

  return commands.join("\n");
}

function createSupplementalPageStreams(snapshot: PdfExportCharacterSnapshot): string[] {
  const commands: string[] = [];
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const sectionGap = 8;
  const rightColumnWidth = 168;
  const leftColumnWidth = contentWidth - rightColumnWidth - sectionGap;
  const leftX = PDF_MARGIN;
  const rightX = leftX + leftColumnWidth + sectionGap;
  const topY = 630;
  const topHeight = 122;
  const spellTableY = 24;
  const spellTableHeight = topY - spellTableY - sectionGap;
  const appearanceY = 674;
  const appearanceHeight = 78;
  const backstoryY = 498;
  const backstoryHeight = 168;
  const languageY = 430;
  const languageHeight = 60;
  const equipmentY = 124;
  const equipmentHeight = 298;
  const coinsY = 24;
  const coinsHeight = 92;

  const spellSlots = snapshot.spellSlots ?? ([0, 0, 0, 0, 0, 0, 0, 0, 0] as const);
  const spellSlotsExpended = snapshot.spellSlotsExpended ?? [];
  const spellSlotRows = Array.from({ length: 9 }, (_, index) => {
    const level = index + 1;
    const total = spellSlots[index] ?? 0;
    const expendedRaw = spellSlotsExpended[index];
    const expended =
      typeof expendedRaw === "number" && Number.isFinite(expendedRaw)
        ? Math.max(0, Math.floor(expendedRaw))
        : null;
    return {
      level,
      total: total > 0 ? `${total}` : "-",
      used: expended === null ? "-" : `${expended}`,
    };
  });
  const hasAnySpellSlots = spellSlotRows.some((row) => row.total !== "-");
  const hasTrackedExpendedSlots = spellSlotRows.some((row) => row.used !== "-");
  const spellRowsFromEntries = normalizeSupplementalSpellRows(snapshot.spellListEntries);
  const spellRows = (() => {
    if (spellRowsFromEntries.length > 0) {
      return spellRowsFromEntries;
    }

    const fallback: SupplementalSpellRow[] = [];
    const seen = new Set<string>();
    const register = (level: string, names: readonly string[] | undefined, notes: string): void => {
      for (const name of normalizeDisplayValues(names)) {
        const key = `${level}|${name.toLowerCase()}|${notes}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        fallback.push({
          level,
          name,
          castingTime: "-",
          range: "-",
          flags: "- / - / -",
          notes,
        });
      }
    };
    register("C", snapshot.cantripSpellNames, "Cantrip");
    register("-", snapshot.preparedSpellNames, "Prepared");
    register("-", snapshot.knownSpellNames, "Known");
    return fallback;
  })();

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

  const appearanceLines = [
    ...toLabeledLines("Appearance", snapshot.appearance, 34, 3),
    ...toLabeledLines("Physical", snapshot.physicalDescription, 34, 3),
  ];
  const backstoryLines = [
    ...toLabeledLines("Alignment", snapshot.alignment, 34, 1),
    ...toLabeledLines("Backstory", snapshot.backstory, 34, 7),
    ...toLabeledLines("Notes", snapshot.notes, 34, 3),
  ];
  const languageAndProficiencyLines = [
    ...toWrappedListLines("Languages", snapshot.languages, 34, 2),
    ...toWrappedListLines("Armor", snapshot.armorProficiencies, 34, 2),
    ...toWrappedListLines("Weapons", snapshot.weaponProficiencies, 34, 2),
    ...toWrappedListLines("Tools", snapshot.toolProficiencies, 34, 2),
  ];
  const equipmentLines = [
    `Equipped Armor: ${snapshot.equippedArmorName?.trim() || "-"}`,
    `Equipped Shield: ${snapshot.equippedShieldName?.trim() || "-"}`,
    `Equipped Weapon: ${snapshot.equippedWeaponName?.trim() || "-"}`,
    "Inventory:",
    ...inventoryLines.map((line) => `- ${line}`),
    `Attuned Items (${attunedCount}/3):`,
    ...attunedLines.map((line) => `- ${line}`),
  ];
  const appearanceSplit = splitLinesForSection(appearanceLines, appearanceHeight, 9);
  const backstorySplit = splitLinesForSection(backstoryLines, backstoryHeight, 9);
  const languageSplit = splitLinesForSection(languageAndProficiencyLines, languageHeight, 9);
  const equipmentSplit = splitLinesForSection(equipmentLines, equipmentHeight, 9);

  commands.push("0.2 w");
  drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - PAGE 2", PDF_MARGIN, 778, 11, true);

  const spellSummaryWidth = 122;
  const spellSlotsWidth = leftColumnWidth - spellSummaryWidth - sectionGap;
  drawSection(commands, leftX, topY, spellSummaryWidth, topHeight, "Spellcasting");
  const spellcastingFieldsX = leftX + SECTION_INNER_PADDING;
  const spellcastingFieldsWidth = spellSummaryWidth - SECTION_INNER_PADDING * 2;
  const spellcastingFieldGap = 4;
  const spellcastingFieldWidth = spellcastingFieldsWidth;
  const spellcastingFieldHeight = Math.floor(
    (topHeight - SECTION_HEADER_HEIGHT - 12 - spellcastingFieldGap * 3) / 4
  );
  const spellcastingTopFieldY = topY + topHeight - SECTION_HEADER_HEIGHT - 8 - spellcastingFieldHeight;
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Ability",
    formatSpellcastingAbility(snapshot.spellcastingAbility),
    16,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY - spellcastingFieldHeight - spellcastingFieldGap,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Modifier",
    typeof snapshot.spellcastingModifier === "number" ? formatModifier(snapshot.spellcastingModifier) : "-",
    16,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY - (spellcastingFieldHeight + spellcastingFieldGap) * 2,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Save DC",
    formatNumeric(snapshot.spellSaveDC),
    16,
    11
  );
  drawField(
    commands,
    spellcastingFieldsX,
    spellcastingTopFieldY - (spellcastingFieldHeight + spellcastingFieldGap) * 3,
    spellcastingFieldWidth,
    spellcastingFieldHeight,
    "Attack Bonus",
    typeof snapshot.spellAttackBonus === "number" ? formatModifier(snapshot.spellAttackBonus) : "-",
    16,
    11
  );
  const spellCountLine = `Cantrips ${snapshot.cantripSpellNames?.length ?? 0} | Prepared ${
    snapshot.preparedSpellNames?.length ?? 0
  } | Known ${snapshot.knownSpellNames?.length ?? 0}`;
  drawText(commands, truncateTextToWidth(spellCountLine, spellSummaryWidth - 16, 7, 72), spellcastingFieldsX, topY + 4, 7, false);

  const spellSlotsX = leftX + spellSummaryWidth + sectionGap;
  drawSection(commands, spellSlotsX, topY, spellSlotsWidth, topHeight, "Spell Slots");
  const slotsTableX = spellSlotsX + SECTION_INNER_PADDING;
  const slotsTableY = topY + 16;
  const slotsTableWidth = spellSlotsWidth - SECTION_INNER_PADDING * 2;
  const slotsRowHeight = 9;
  const slotsTableRows = 10;
  const slotsTableHeight = slotsRowHeight * slotsTableRows;
  const slotsLevelColumnWidth = Math.floor(slotsTableWidth * 0.46);
  const slotsTotalColumnWidth = Math.floor(slotsTableWidth * 0.24);
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

  const slotsHeaderRowTopY = rowTopY(slotsTableY, slotsTableHeight, slotsRowHeight, 1);
  drawTextInCell(
    commands,
    "LEVEL",
    slotsTableX,
    rowBaselineY(slotsHeaderRowTopY, slotsRowHeight, 6),
    slotsLevelColumnWidth,
    6,
    true,
    "center"
  );
  drawTextInCell(
    commands,
    "TOTAL",
    slotsTableX + slotsLevelColumnWidth,
    rowBaselineY(slotsHeaderRowTopY, slotsRowHeight, 6),
    slotsTotalColumnWidth,
    6,
    true,
    "center"
  );
  drawTextInCell(
    commands,
    "EXPENDED",
    slotsTableX + slotsLevelColumnWidth + slotsTotalColumnWidth,
    rowBaselineY(slotsHeaderRowTopY, slotsRowHeight, 6),
    slotsUsedColumnWidth,
    6,
    true,
    "center"
  );
  spellSlotRows.forEach((row, index) => {
    const rowTop = rowTopY(slotsTableY, slotsTableHeight, slotsRowHeight, index + 2);
    const rowTextY = rowBaselineY(rowTop, slotsRowHeight, 7);
    drawTextInCell(commands, `Level ${row.level}`, slotsTableX, rowTextY, slotsLevelColumnWidth, 7, false, "left", 8);
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
    hasAnySpellSlots
      ? hasTrackedExpendedSlots
        ? "Expended slots shown from character state."
        : "Expended slot tracking is not currently modeled."
      : "No class spell slots at this level.",
    slotsTableX,
    slotsTableY - 8,
    7,
    false
  );

  drawSection(commands, leftX, spellTableY, leftColumnWidth, spellTableHeight, "Cantrips & Prepared Spells");
  const spellGridX = leftX + SECTION_INNER_PADDING;
  const spellGridY = spellTableY + 8;
  const spellGridWidth = leftColumnWidth - SECTION_INNER_PADDING * 2;
  const spellGridRowHeight = 16;
  const spellBodyRows = 34;
  const spellGridRows = spellBodyRows + 1;
  const spellGridHeight = spellGridRows * spellGridRowHeight;
  const spellColumns = [
    { key: "level", label: "LVL", width: 24, align: "center" as const, maxLength: 3 },
    { key: "name", label: "NAME", width: 110, align: "left" as const, maxLength: 24 },
    { key: "castingTime", label: "CAST", width: 38, align: "left" as const, maxLength: 8 },
    { key: "range", label: "RANGE", width: 42, align: "left" as const, maxLength: 10 },
    { key: "flags", label: "C/R/M", width: 58, align: "center" as const, maxLength: 13 },
    {
      key: "notes",
      label: "NOTES",
      width: spellGridWidth - 24 - 110 - 38 - 42 - 58,
      align: "left" as const,
      maxLength: 26,
    },
  ] as const;
  commands.push(`${spellGridX} ${spellGridY} ${spellGridWidth} ${spellGridHeight} re S`);
  for (let rowIndex = 1; rowIndex < spellGridRows; rowIndex += 1) {
    const y = spellGridY + spellGridHeight - rowIndex * spellGridRowHeight;
    commands.push(`${spellGridX} ${y} m ${spellGridX + spellGridWidth} ${y} l S`);
  }
  let spellColumnCursor = spellGridX;
  for (let columnIndex = 0; columnIndex < spellColumns.length - 1; columnIndex += 1) {
    spellColumnCursor += spellColumns[columnIndex].width;
    commands.push(`${spellColumnCursor} ${spellGridY} m ${spellColumnCursor} ${spellGridY + spellGridHeight} l S`);
  }
  const spellHeaderRowTopY = rowTopY(spellGridY, spellGridHeight, spellGridRowHeight, 1);
  const spellHeaderTextY = rowBaselineY(spellHeaderRowTopY, spellGridRowHeight, 6);
  spellColumnCursor = spellGridX;
  for (const column of spellColumns) {
    drawTextInCell(
      commands,
      column.label,
      spellColumnCursor,
      spellHeaderTextY,
      column.width,
      6,
      true,
      column.align,
      24
    );
    spellColumnCursor += column.width;
  }
  const visibleSpellRows = spellRows.slice(0, spellBodyRows);
  for (let rowIndex = 0; rowIndex < spellBodyRows; rowIndex += 1) {
    const row = visibleSpellRows[rowIndex];
    const rowTop = rowTopY(spellGridY, spellGridHeight, spellGridRowHeight, rowIndex + 2);
    const rowTextY = rowBaselineY(rowTop, spellGridRowHeight, 7);
    let x = spellGridX;
    for (const column of spellColumns) {
      drawTextInCell(
        commands,
        row ? row[column.key] : "",
        x,
        rowTextY,
        column.width,
        7,
        false,
        column.align,
        column.maxLength
      );
      x += column.width;
    }
  }
  if (spellRows.length > spellBodyRows) {
    drawText(
      commands,
      `+${spellRows.length - spellBodyRows} additional spells (see spell list pages).`,
      spellGridX,
      spellTableY + 2,
      7,
      false
    );
  } else if (spellRows.length === 0) {
    drawText(commands, "No spells prepared or known.", spellGridX, spellTableY + 2, 7, false);
  }

  drawSection(commands, rightX, appearanceY, rightColumnWidth, appearanceHeight, "Appearance");
  drawListInSection(
    commands,
    appearanceSplit.visible,
    rightX,
    appearanceY,
    rightColumnWidth,
    appearanceHeight,
    9,
    8,
    120
  );

  drawSection(commands, rightX, backstoryY, rightColumnWidth, backstoryHeight, "Backstory & Personality");
  drawListInSection(
    commands,
    backstorySplit.visible,
    rightX,
    backstoryY,
    rightColumnWidth,
    backstoryHeight,
    9,
    8,
    120
  );

  drawSection(commands, rightX, languageY, rightColumnWidth, languageHeight, "Languages & Proficiencies");
  drawListInSection(
    commands,
    languageSplit.visible,
    rightX,
    languageY,
    rightColumnWidth,
    languageHeight,
    9,
    8,
    120
  );

  drawSection(commands, rightX, equipmentY, rightColumnWidth, equipmentHeight, "Equipment");
  drawListInSection(
    commands,
    equipmentSplit.visible,
    rightX,
    equipmentY,
    rightColumnWidth,
    equipmentHeight,
    9,
    8,
    120
  );

  drawSection(commands, rightX, coinsY, rightColumnWidth, coinsHeight, "Coins");
  const coinFieldY = coinsY + 34;
  const coinFieldGap = 4;
  const coinFieldWidth = (rightColumnWidth - 16 - coinFieldGap * 4) / 5;
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
    truncateTextToWidth(`Other Wealth: ${snapshot.otherWealth?.trim() || "-"}`, rightColumnWidth - 16, 8, 120),
    rightX + SECTION_INNER_PADDING,
    coinsY + 14,
    8,
    false
  );
  const coinTotalInGp = formatCoinTotalInGp(snapshot);
  if (coinTotalInGp) {
    drawText(commands, truncateTextToWidth(`Coin Value: ${coinTotalInGp}`, rightColumnWidth - 16, 7, 64), rightX + SECTION_INNER_PADDING, coinsY + 4, 7, false);
  }

  const streams = [commands.join("\n")];
  const continuationLines: string[] = [];
  const pushContinuationSection = (title: string, lines: readonly string[]) => {
    if (lines.length === 0) {
      return;
    }
    continuationLines.push(`${title}:`);
    continuationLines.push(...lines.map((line) => `  ${line}`));
    continuationLines.push("");
  };
  pushContinuationSection("Appearance (continued)", appearanceSplit.overflow);
  pushContinuationSection("Backstory & Personality (continued)", backstorySplit.overflow);
  pushContinuationSection("Languages & Proficiencies (continued)", languageSplit.overflow);
  pushContinuationSection("Equipment (continued)", equipmentSplit.overflow);
  if (companionSummary.trim().length > 0 || familiarSummary.trim().length > 0) {
    continuationLines.push("Companion / Familiar:");
    continuationLines.push(...toLabeledLines("Companion", companionSummary, 95, 8));
    continuationLines.push(...toLabeledLines("Familiar", familiarSummary, 95, 8));
    continuationLines.push("");
  }
  if (snapshot.warningMessages && snapshot.warningMessages.length > 0) {
    continuationLines.push("Warnings:");
    continuationLines.push(...snapshot.warningMessages.map((message) => `! ${message}`));
    continuationLines.push("");
  }
  const normalizedContinuationLines = continuationLines.filter(
    (line, index, lines) => !(line === "" && (index === 0 || lines[index - 1] === ""))
  );
  if (normalizedContinuationLines.length > 0) {
    const continuationPages = paginateByPageSpace(normalizedContinuationLines, 746, 36, 10);
    for (let pageIndex = 0; pageIndex < continuationPages.length; pageIndex += 1) {
      streams.push(
        createNarrativeContinuationPageStream(
          continuationPages[pageIndex],
          pageIndex + 1,
          "Narrative / Equipment / Proficiency (continued)"
        )
      );
    }
  }

  return streams;
}

type DetailSection = {
  title: string;
  lines: string[];
};

function createDetailsPageStreams(snapshot: PdfExportCharacterSnapshot): string[] {
  const lineHeight = 10;
  const sectionGap = 8;
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
  const usableTopY = 746;
  const usableBottomY = 24;

  const spellcastingSummaryLines = [
    `Spellcasting Ability: ${formatSpellcastingAbility(snapshot.spellcastingAbility)}`,
    `Spellcasting Modifier: ${
      typeof snapshot.spellcastingModifier === "number" ? formatModifier(snapshot.spellcastingModifier) : "-"
    }`,
    `Spell Save DC: ${formatNumeric(snapshot.spellSaveDC)}`,
    `Spell Attack Bonus: ${
      typeof snapshot.spellAttackBonus === "number" ? formatModifier(snapshot.spellAttackBonus) : "-"
    }`,
  ];

  const spellSlots = snapshot.spellSlots ?? ([0, 0, 0, 0, 0, 0, 0, 0, 0] as const);
  const spellSlotsExpended = snapshot.spellSlotsExpended ?? [];
  const spellSlotLines = Array.from({ length: 9 }, (_, index) => {
    const level = index + 1;
    const total = typeof spellSlots[index] === "number" ? Math.max(0, Math.floor(spellSlots[index])) : 0;
    const spentRaw = spellSlotsExpended[index];
    const spent =
      typeof spentRaw === "number" && Number.isFinite(spentRaw) ? Math.max(0, Math.floor(spentRaw)) : null;
    const spentLabel = spent === null ? "-" : `${spent}`;
    const remainingLabel =
      spent === null
        ? "-"
        : `${Math.max(0, total - spent)}`;
    return `Level ${level}: total ${total > 0 ? total : "-"} | expended ${spentLabel} | remaining ${remainingLabel}`;
  });

  const cantrips = normalizeDisplayValues(snapshot.cantripSpellNames);
  const prepared = normalizeDisplayValues(snapshot.preparedSpellNames);
  const known = normalizeDisplayValues(snapshot.knownSpellNames);
  const spellSelectionLines = [
    ...toWrappedListLines(`Cantrips (${cantrips.length})`, cantrips, 102, 12),
    ...toWrappedListLines(`Prepared (${prepared.length})`, prepared, 102, 14),
    ...toWrappedListLines(`Known (${known.length})`, known, 102, 14),
  ];

  const inventoryLines = normalizeLines(snapshot.inventoryItems ?? snapshot.inventorySummary, "Other Gear: None");
  const attunedLines = normalizeAttunedItemLines(snapshot.attunedItems);
  const coinSummary = [
    `CP ${formatNumeric(snapshot.cp)} | SP ${formatNumeric(snapshot.sp)} | EP ${formatNumeric(snapshot.ep)} | GP ${formatNumeric(snapshot.gp)} | PP ${formatNumeric(snapshot.pp)}`,
    `Coin Value: ${formatCoinTotalInGp(snapshot) ?? "-"}`,
    `Other Wealth: ${snapshot.otherWealth?.trim() || "-"}`,
  ];
  const equipmentLines = [
    `Armor Worn: ${snapshot.equippedArmorName?.trim() || "-"}`,
    `Shield: ${snapshot.equippedShieldName?.trim() || "-"}`,
    `Weapon: ${snapshot.equippedWeaponName?.trim() || "-"}`,
    "Inventory:",
    ...inventoryLines.map((line) => `- ${line}`),
    "Attuned Items:",
    ...attunedLines.map((line) => `- ${line}`),
    ...coinSummary,
  ];

  const proficiencyLines = [
    ...toWrappedListLines("Armor", snapshot.armorProficiencies, 100, 8),
    ...toWrappedListLines("Weapons", snapshot.weaponProficiencies, 100, 8),
    ...toWrappedListLines("Tools", snapshot.toolProficiencies, 100, 8),
    ...toWrappedListLines("Languages", snapshot.languages, 100, 8),
  ];

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
    ...toLabeledLines("Alignment", snapshot.alignment, 102, 2),
    ...toLabeledLines("Appearance", snapshot.appearance, 102, 6),
    ...toLabeledLines("Physical Description", snapshot.physicalDescription, 102, 6),
    ...toLabeledLines("Backstory", snapshot.backstory, 102, 12),
    ...toLabeledLines("Notes", snapshot.notes, 102, 8),
    ...toLabeledLines("Companion", companionSummary, 102, 5),
    ...toLabeledLines("Familiar", familiarSummary, 102, 5),
  ];
  const warningLines =
    snapshot.warningMessages && snapshot.warningMessages.length > 0
      ? ["Warnings:", ...snapshot.warningMessages.map((message) => `! ${message}`)]
      : [];

  const sections: DetailSection[] = [
    { title: "Spellcasting Summary", lines: spellcastingSummaryLines },
    { title: "Spell Slot Tracking", lines: spellSlotLines },
    { title: "Cantrips / Prepared / Known Spells", lines: spellSelectionLines },
    { title: "Equipment / Attunement / Currency", lines: equipmentLines },
    { title: "Armor, Weapon, Tool, and Language Proficiencies", lines: proficiencyLines },
    { title: "Narrative / Companion / Familiar", lines: [...narrativeLines, ...warningLines] },
  ];

  const streams: string[] = [];
  let commands: string[] = [];
  let cursorY = usableTopY;
  let pageNumber = 1;

  const startPage = () => {
    commands = [];
    commands.push("0.2 w");
    drawText(commands, "DARK SUN BUILDER CHARACTER SHEET - EXTENDED DETAILS", PDF_MARGIN, 778, 11, true);
    drawText(commands, `Page ${pageNumber}`, PDF_MARGIN, 764, 8, false);
    cursorY = usableTopY;
  };

  const closePage = () => {
    streams.push(commands.join("\n"));
  };

  startPage();

  for (const section of sections) {
    const sourceLines = section.lines.length > 0 ? section.lines : ["-"];
    let start = 0;
    let sectionChunk = 1;

    while (start < sourceLines.length) {
      const availableHeight = cursorY - usableBottomY;
      const maxLines = maxSectionLinesForPageSpace(availableHeight, lineHeight);

      if (maxLines < 2 && hasActivePageContent(cursorY, usableTopY)) {
        closePage();
        pageNumber += 1;
        startPage();
        continue;
      }

      const remaining = sourceLines.length - start;
      const lineCount = Math.min(remaining, maxLines);
      const sectionHeight = detailSectionHeight(lineCount, lineHeight);

      if (!ensurePageSpace(cursorY, usableBottomY, sectionHeight) && hasActivePageContent(cursorY, usableTopY)) {
        closePage();
        pageNumber += 1;
        startPage();
        continue;
      }

      const sectionY = cursorY - sectionHeight;
      drawSection(
        commands,
        PDF_MARGIN,
        sectionY,
        contentWidth,
        sectionHeight,
        sectionChunk > 1 ? `${section.title} (continued)` : section.title
      );
      const sectionLines = sourceLines.slice(start, start + lineCount);
      drawListInSection(
        commands,
        sectionLines,
        PDF_MARGIN,
        sectionY,
        contentWidth,
        sectionHeight,
        lineHeight,
        8,
        160
      );

      start += lineCount;
      sectionChunk += 1;
      cursorY = sectionY - sectionGap;

      if (start < sourceLines.length) {
        closePage();
        pageNumber += 1;
        startPage();
      }
    }
  }

  closePage();
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
  const tableBottomY = 24;
  const sectionRowHeight = 12;
  const headerHeight = sectionRowHeight * 2;
  const spellEntryHeight = sectionRowHeight * 2;
  const pagedRows = paginateByPageSpace(rows, tableTopY - headerHeight, tableBottomY, spellEntryHeight);

  type SpellTableColumn = {
    key: keyof NormalizedSpellTableRow;
    label: string;
    width: number;
    maxLength: number;
    align: TextAlign;
  };

  const topColumns: readonly SpellTableColumn[] = [
    { key: "level", label: "LVL", width: 30, maxLength: 4, align: "center" },
    { key: "name", label: "NAME", width: 176, maxLength: 40, align: "left" },
    { key: "school", label: "SCHOOL", width: 74, maxLength: 18, align: "left" },
    { key: "castingTime", label: "CASTING TIME", width: 100, maxLength: 24, align: "left" },
    {
      key: "range",
      label: "RANGE",
      width: contentWidth - 30 - 176 - 74 - 100,
      maxLength: 32,
      align: "left",
    },
  ];
  const bottomColumns: readonly SpellTableColumn[] = [
    { key: "duration", label: "DURATION", width: 116, maxLength: 24, align: "left" },
    { key: "components", label: "COMPONENTS", width: 100, maxLength: 22, align: "left" },
    { key: "notes", label: "NOTES", width: 268, maxLength: 76, align: "left" },
    {
      key: "reference",
      label: "PAGE / REF",
      width: contentWidth - 116 - 100 - 268,
      maxLength: 24,
      align: "left",
    },
  ];

  const drawHorizontalLine = (commands: string[], y: number): void => {
    commands.push(`${tableX} ${y} m ${tableX + contentWidth} ${y} l S`);
  };
  const drawVerticalLinesForRow = (
    commands: string[],
    columns: readonly SpellTableColumn[],
    rowTopY: number,
    rowHeight: number
  ): void => {
    let x = tableX;
    for (let index = 0; index < columns.length - 1; index += 1) {
      x += columns[index].width;
      commands.push(`${x} ${rowTopY - rowHeight} m ${x} ${rowTopY} l S`);
    }
  };
  const drawRowValues = (
    commands: string[],
    columns: readonly SpellTableColumn[],
    rowTopY: number,
    rowHeight: number,
    values: NormalizedSpellTableRow | null,
    size: number,
    bold: boolean
  ): void => {
    const textY = rowBaselineY(rowTopY, rowHeight, size);
    let x = tableX;
    for (const column of columns) {
      drawTextInCell(
        commands,
        values ? values[column.key] : column.label,
        x,
        textY,
        column.width,
        size,
        bold,
        column.align,
        values ? column.maxLength : 32
      );
      x += column.width;
    }
  };

  const pageCount = pagedRows.length;
  const streams: string[] = [];
  let rowCursor = 0;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageRows = pagedRows[pageIndex];
    const startIndex = rowCursor + 1;
    const endIndex = rowCursor + pageRows.length;
    rowCursor += pageRows.length;
    const commands: string[] = [];
    const tableHeight = headerHeight + pageRows.length * spellEntryHeight;
    const tableY = tableTopY - tableHeight;

    commands.push("0.2 w");
    drawText(
      commands,
      pageIndex === 0
        ? "DARK SUN BUILDER CHARACTER SHEET - SPELL LIST"
        : "DARK SUN BUILDER CHARACTER SHEET - SPELL LIST (CONTINUED)",
      PDF_MARGIN,
      778,
      11,
      true
    );
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
    drawHorizontalLine(commands, tableTopY - sectionRowHeight);
    drawHorizontalLine(commands, tableTopY - headerHeight);
    drawVerticalLinesForRow(commands, topColumns, tableTopY, sectionRowHeight);
    drawVerticalLinesForRow(commands, bottomColumns, tableTopY - sectionRowHeight, sectionRowHeight);
    drawRowValues(commands, topColumns, tableTopY, sectionRowHeight, null, 6, true);
    drawRowValues(
      commands,
      bottomColumns,
      tableTopY - sectionRowHeight,
      sectionRowHeight,
      null,
      6,
      true
    );

    pageRows.forEach((row, rowIndex) => {
      const rowTopY = tableTopY - headerHeight - rowIndex * spellEntryHeight;
      const rowSplitY = rowTopY - sectionRowHeight;
      const rowBottomY = rowTopY - spellEntryHeight;

      drawHorizontalLine(commands, rowSplitY);
      drawHorizontalLine(commands, rowBottomY);
      drawVerticalLinesForRow(commands, topColumns, rowTopY, sectionRowHeight);
      drawVerticalLinesForRow(commands, bottomColumns, rowSplitY, sectionRowHeight);
      drawRowValues(commands, topColumns, rowTopY, sectionRowHeight, row, 7, false);
      drawRowValues(commands, bottomColumns, rowSplitY, sectionRowHeight, row, 7, false);
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
  const weaponRows =
    snapshot.attacks && snapshot.attacks.length > 0
      ? snapshot.attacks.map((attack) => ({
          name: attack.name?.trim() || "-",
          bonus:
            typeof attack.toHit === "number"
              ? formatModifier(attack.toHit)
              : typeof snapshot.spellSaveDC === "number"
                ? `DC ${snapshot.spellSaveDC}`
                : "-",
          damage: attack.damage?.trim() || "-",
          notes: attack.notes?.trim() || "-",
        }))
      : [
          {
            name: snapshot.attackName?.trim() || "-",
            bonus: attackBonusOrDc,
            damage: snapshot.attackDamage?.trim() || "-",
            notes: attackNotes,
          },
        ];
  const attackRows = [...weaponRows, ...cantripRows];
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
  drawListInSection(commands, trainingLines, leftX, trainingY, leftWidth, trainingHeight, 12, 8, 96, 10);

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
  const attackHeaderRowTopY = rowTopY(tableY, tableHeight, tableRowHeight, 1);
  const attackHeaderTextY = rowBaselineY(attackHeaderRowTopY, tableRowHeight, 6);
  drawTextInCell(commands, "NAME", tableX, attackHeaderTextY, attackColumns[0], 6, true, "center", 20);
  drawTextInCell(
    commands,
    "ATK BONUS / DC",
    tableX + attackColumns[0],
    attackHeaderTextY,
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
    attackHeaderTextY,
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
    attackHeaderTextY,
    attackColumns[3],
    6,
    true,
    "center",
    20
  );
  attackRows.forEach((row, index) => {
    const rowTop = rowTopY(tableY, tableHeight, tableRowHeight, index + 2);
    const rowTextY = rowBaselineY(rowTop, tableRowHeight, 8);
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
    rightWidth - 108,
    conditionsY + 10
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
    featuresInnerWidth - 8,
    classPanelY + 8
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
    lowerPanelWidth - 8,
    lowerPanelsY + 8
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
    lowerPanelWidth - 8,
    lowerPanelsY + 8
  );

  const pageOneStream = commands.join("\n");
  const supplementalStreams = createSupplementalPageStreams(snapshot);
  const detailStreams = createDetailsPageStreams(snapshot);
  const spellListStreams = createSpellListPageStreams(snapshot);
  return buildPdfDocument([pageOneStream, ...supplementalStreams, ...detailStreams, ...spellListStreams]);
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
