import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPackFromDir, mergePacks } from "@dark-sun/content";
import { describe, expect, it } from "vitest";

import { generateRulesCoverageReport } from "../src/coverage";

const here = path.dirname(fileURLToPath(import.meta.url));
const srdPackDir = path.resolve(here, "../../../apps/web/content/packs/srd52");

describe("rules coverage report", () => {
  it("returns a coverage report object", async () => {
    const pack = await loadPackFromDir(srdPackDir);
    const merged = mergePacks([pack]).content;
    const report = generateRulesCoverageReport(merged);

    expect(report).toBeDefined();
    expect(Array.isArray(report.supportedEffectTypes)).toBe(true);
    expect(Array.isArray(report.usedEffectTypes)).toBe(true);
    expect(Array.isArray(report.warnings)).toBe(true);
  });

  it("supportedEffectTypes includes all implemented handlers", async () => {
    const pack = await loadPackFromDir(srdPackDir);
    const merged = mergePacks([pack]).content;
    const report = generateRulesCoverageReport(merged);

    expect(report.supportedEffectTypes).toEqual(
      expect.arrayContaining([
        "grant_skill_proficiency",
        "grant_save_proficiency",
        "add_bonus",
        "set_speed",
        "grant_tool_proficiency"
      ])
    );
  });

  it("missingEffectHandlers is empty for SRD seed pack", async () => {
    const pack = await loadPackFromDir(srdPackDir);
    const merged = mergePacks([pack]).content;
    const report = generateRulesCoverageReport(merged);

    expect(report.missingEffectHandlers).toEqual([]);
  });
});
