#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

import { makeKnownValidExportPayload } from "./smoke-fixture.mjs";
import { startWebDevServer } from "./smoke-server.mjs";

const DEFAULT_MIN_PDF_BYTES = 512;
const ARTIFACT_DIR = join(process.cwd(), "codex", "harness");
const PDF_ARTIFACT_PATH = join(ARTIFACT_DIR, "pdf-sanity-export.pdf");
const META_ARTIFACT_PATH = join(ARTIFACT_DIR, "pdf-sanity.json");

async function loadTemplatePdfBytesIfPresent() {
  const candidates = [
    join(process.cwd(), "assets", "sheets", "template.pdf"),
    join(process.cwd(), "apps", "web", "assets", "sheets", "template.pdf"),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return { path: candidate, bytes: await readFile(candidate) };
    } catch {
      // try next
    }
  }

  return null;
}

async function main() {
  const repoRoot = process.cwd();
  const port = Number.parseInt(process.env.PDF_SANITY_PORT ?? "4012", 10);
  const minPdfBytes = Number.parseInt(
    process.env.PDF_SANITY_MIN_PDF_BYTES ?? `${DEFAULT_MIN_PDF_BYTES}`,
    10
  );
  const templateInfo = await loadTemplatePdfBytesIfPresent();
  const server = await startWebDevServer({ repoRoot, port, readyPath: "/" });

  try {
    const payload = makeKnownValidExportPayload();
    const response = await fetch(`${server.baseUrl}/api/export/pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
      const body = await response.text();
      throw new Error(`PDF sanity export returned ${response.status}. Body: ${body}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/pdf")) {
      throw new Error(`PDF sanity export content-type mismatch: ${contentType}`);
    }

    const pdfBytes = new Uint8Array(await response.arrayBuffer());
    if (pdfBytes.byteLength < minPdfBytes) {
      throw new Error(
        `PDF sanity export too small (${pdfBytes.byteLength} bytes, expected >= ${minPdfBytes}).`
      );
    }

    await mkdir(ARTIFACT_DIR, { recursive: true });
    await writeFile(PDF_ARTIFACT_PATH, pdfBytes);

    const templateByteLength = templateInfo?.bytes.byteLength ?? null;
    const identicalToTemplate =
      Boolean(templateInfo) && Buffer.from(pdfBytes).equals(templateInfo.bytes);

    const metadata = {
      generatedAt: new Date().toISOString(),
      byteLength: pdfBytes.byteLength,
      templatePath: templateInfo?.path ?? null,
      templateByteLength,
      identicalToTemplate,
    };
    await writeFile(META_ARTIFACT_PATH, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

    if (identicalToTemplate) {
      throw new Error(
        `PDF sanity failed: exported PDF is byte-identical to template (${templateByteLength} bytes).`
      );
    }

    console.log(`[pdf:sanity] PASS (${pdfBytes.byteLength} bytes)`);
    console.log(`[pdf:sanity] saved ${PDF_ARTIFACT_PATH}`);
    console.log(`[pdf:sanity] metadata ${META_ARTIFACT_PATH}`);
  } finally {
    await server.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
