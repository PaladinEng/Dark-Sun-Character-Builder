#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

import {
  makeKnownInvalidExportPayload,
  makeKnownValidExportPayload,
} from "./smoke-fixture.mjs";
import { startWebDevServer } from "./smoke-server.mjs";

const DEFAULT_MIN_PDF_BYTES = 512;

async function loadTemplatePdfBytesIfPresent() {
  const candidates = [
    join(process.cwd(), "assets", "sheets", "template.pdf"),
    join(process.cwd(), "apps", "web", "assets", "sheets", "template.pdf"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return await readFile(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

async function main() {
  const repoRoot = process.cwd();
  const port = Number.parseInt(process.env.API_SMOKE_PORT ?? "4011", 10);
  const minPdfBytes = Number.parseInt(
    process.env.API_SMOKE_MIN_PDF_BYTES ?? `${DEFAULT_MIN_PDF_BYTES}`,
    10
  );
  const server = await startWebDevServer({ repoRoot, port, readyPath: "/" });
  const templatePdfBytes = await loadTemplatePdfBytesIfPresent();

  try {
    const debugRulesResponse = await fetch(`${server.baseUrl}/api/debug/rules`, {
      method: "GET",
      cache: "no-store",
    });
    if (debugRulesResponse.status !== 200) {
      throw new Error(`/api/debug/rules returned ${debugRulesResponse.status}, expected 200.`);
    }
    console.log("[api:smoke] GET /api/debug/rules -> 200");

    const validPayload = makeKnownValidExportPayload();
    const validPdfResponse = await fetch(`${server.baseUrl}/api/export/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPayload),
    });
    if (validPdfResponse.status !== 200) {
      const body = await validPdfResponse.text();
      throw new Error(`Valid PDF export returned ${validPdfResponse.status}. Body: ${body}`);
    }
    const contentType = validPdfResponse.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new Error(`Valid PDF export content-type mismatch: ${contentType}`);
    }
    const pdfBytes = new Uint8Array(await validPdfResponse.arrayBuffer());
    if (pdfBytes.byteLength < minPdfBytes) {
      throw new Error(
        `Valid PDF export body too small (${pdfBytes.byteLength} bytes, expected >= ${minPdfBytes}).`
      );
    }
    if (templatePdfBytes && Buffer.from(pdfBytes).equals(templatePdfBytes)) {
      throw new Error(
        "Valid PDF export is byte-identical to template.pdf (appears to be a passthrough export)."
      );
    }
    console.log(
      `[api:smoke] POST /api/export/pdf (valid) -> 200 application/pdf (${pdfBytes.byteLength} bytes)`
    );

    const invalidPayload = makeKnownInvalidExportPayload();
    const invalidPdfResponse = await fetch(`${server.baseUrl}/api/export/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });
    if (invalidPdfResponse.status !== 400) {
      const body = await invalidPdfResponse.text();
      throw new Error(`Invalid PDF export returned ${invalidPdfResponse.status}. Body: ${body}`);
    }
    const invalidJson = await invalidPdfResponse.json().catch(() => null);
    const hasBlockingSignal =
      typeof invalidJson === "object" &&
      invalidJson !== null &&
      ("error" in invalidJson || "code" in invalidJson || "validation" in invalidJson);
    if (!hasBlockingSignal) {
      throw new Error("Invalid PDF export did not return expected blocking error payload.");
    }
    console.log("[api:smoke] POST /api/export/pdf (invalid) -> 400 with blocking payload");

    console.log("[api:smoke] PASS");
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
