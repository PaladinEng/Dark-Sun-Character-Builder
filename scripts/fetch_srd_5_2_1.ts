import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const SRD_URL =
  "https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf";
const DEST_PATH = path.resolve("vendor/srd/SRD_CC_v5.2.1.pdf");

function hasForceFlag(): boolean {
  return process.argv.includes("--force");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function main(): Promise<void> {
  const force = hasForceFlag();
  const alreadyExists = await exists(DEST_PATH);

  if (alreadyExists && !force) {
    const buffer = await readFile(DEST_PATH);
    console.log(`Using existing file: ${DEST_PATH}`);
    console.log(`SHA-256: ${sha256(buffer)}`);
    return;
  }

  await mkdir(path.dirname(DEST_PATH), { recursive: true });

  const response = await fetch(SRD_URL);
  if (!response.ok) {
    throw new Error(`Failed to download SRD PDF: ${response.status} ${response.statusText}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(DEST_PATH, data);
  console.log(`Saved: ${DEST_PATH}`);
  console.log(`SHA-256: ${sha256(data)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
