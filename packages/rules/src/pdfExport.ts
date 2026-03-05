import type { ValidationIssue, ValidationReport } from "./validate";

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

export function buildPdfExportFromTemplate(
  templatePdfBytes: Uint8Array,
  validation: ValidationReport
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

  // Return an exact byte copy of the template to keep output deterministic.
  return { ok: true, pdfBytes: new Uint8Array(templatePdfBytes) };
}

