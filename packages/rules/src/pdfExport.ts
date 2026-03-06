import type { ValidationIssue, ValidationReport } from "./validate";
import type { AbilityRecord } from "./types";

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
  speciesName?: string | null;
  backgroundName?: string | null;
  abilities: AbilityRecord;
  abilityMods: AbilityRecord;
  proficiencyBonus: number;
  armorClass: number;
  maxHP: number;
  speed: number;
  attackName?: string | null;
  attackToHit?: number | null;
  attackDamage?: string | null;
  featNames?: readonly string[];
};

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function createPdfFromTextLines(lines: string[]): Uint8Array {
  const textLines = lines
    .slice(0, 46)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const streamParts = [
    "BT",
    "/F1 12 Tf",
    "50 760 Td",
    "14 TL",
    ...textLines.flatMap((line) => [`(${escapePdfText(line)}) Tj`, "T*"]),
    "ET",
  ];
  const stream = `${streamParts.join("\n")}\n`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
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

function toSnapshotLines(snapshot: PdfExportCharacterSnapshot): string[] {
  const featSummary = (snapshot.featNames ?? []).join(", ");
  const attackSummary = snapshot.attackName
    ? `${snapshot.attackName} ${formatModifier(snapshot.attackToHit ?? 0)} (${snapshot.attackDamage ?? "-"})`
    : "None";
  const abilityLines = (Object.keys(snapshot.abilities) as Array<keyof AbilityRecord>).map(
    (ability) =>
      `${ability.toUpperCase()}: ${snapshot.abilities[ability]} (${formatModifier(snapshot.abilityMods[ability])})`
  );

  return [
    "Dark Sun Character Builder Sheet Export",
    `Class: ${snapshot.className ?? "-"}`,
    `Species: ${snapshot.speciesName ?? "-"}`,
    `Background: ${snapshot.backgroundName ?? "-"}`,
    `Level: ${snapshot.level}`,
    "",
    ...abilityLines,
    "",
    `Proficiency Bonus: ${formatModifier(snapshot.proficiencyBonus)}`,
    `Armor Class: ${snapshot.armorClass}`,
    `Max HP: ${snapshot.maxHP}`,
    `Speed: ${snapshot.speed}`,
    `Primary Attack: ${attackSummary}`,
    `Feats: ${featSummary || "None"}`,
  ];
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

  return { ok: true, pdfBytes: createPdfFromTextLines(toSnapshotLines(snapshot)) };
}
