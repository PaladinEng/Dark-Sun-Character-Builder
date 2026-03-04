import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MergedContent } from "@dark-sun/content";

import type { Ability, CharacterState, DerivedState } from "../src/types";

export interface CharacterFixtureInput {
  state: CharacterState;
  content: MergedContent;
  spellcastingAbility?: Ability;
  spellSaveBonus?: number;
}

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES_DIR = path.resolve(THIS_DIR, "../../../fixtures/characters");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primitiveSortKey(value: unknown): string {
  if (value === null) return "null";
  return `${typeof value}:${String(value)}`;
}

function isPrimitive(value: unknown): boolean {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function hasStringId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function hasNumericLevel(value: unknown): value is { level: number } {
  return isRecord(value) && typeof value.level === "number";
}

export function normalizeForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeForComparison(entry));

    if (normalized.every(isPrimitive)) {
      return [...normalized].sort((a, b) =>
        primitiveSortKey(a).localeCompare(primitiveSortKey(b))
      );
    }

    if (normalized.every(hasStringId)) {
      return [...normalized].sort((a, b) => a.id.localeCompare(b.id));
    }

    if (normalized.every(hasNumericLevel)) {
      return [...normalized].sort((a, b) => a.level - b.level);
    }

    return normalized;
  }

  if (isRecord(value)) {
    const sorted = Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, normalizeForComparison(value[key])]);

    return Object.fromEntries(sorted);
  }

  return value;
}

export function listFixtureIds(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((name) => name.endsWith(".input.json"))
    .map((name) => name.slice(0, -".input.json".length))
    .sort((a, b) => a.localeCompare(b));
}

function parseJsonFile<T>(filePath: string): T {
  const json = readFileSync(filePath, "utf8");
  return JSON.parse(json) as T;
}

export function fixtureInputPath(id: string): string {
  return path.join(FIXTURES_DIR, `${id}.input.json`);
}

export function fixtureExpectedPath(id: string): string {
  return path.join(FIXTURES_DIR, `${id}.expected.json`);
}

export function readFixtureInput(id: string): CharacterFixtureInput {
  return parseJsonFile<CharacterFixtureInput>(fixtureInputPath(id));
}

export function readFixtureExpected(id: string): DerivedState {
  return parseJsonFile<DerivedState>(fixtureExpectedPath(id));
}

function joinPath(base: string, segment: string): string {
  if (!base) return segment;
  if (segment.startsWith("[")) return `${base}${segment}`;
  return `${base}.${segment}`;
}

export function collectDiffs(
  expected: unknown,
  actual: unknown,
  currentPath = ""
): string[] {
  if (Object.is(expected, actual)) {
    return [];
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: string[] = [];
    const max = Math.max(expected.length, actual.length);
    for (let i = 0; i < max; i += 1) {
      diffs.push(
        ...collectDiffs(expected[i], actual[i], joinPath(currentPath, `[${i}]`))
      );
    }
    return diffs;
  }

  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const diffs: string[] = [];
    for (const key of [...keys].sort((a, b) => a.localeCompare(b))) {
      diffs.push(
        ...collectDiffs(expected[key], actual[key], joinPath(currentPath, key))
      );
    }
    return diffs;
  }

  return [
    `${currentPath || "(root)"}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`
  ];
}

export function assertFixtureExists(pathToFixture: string): void {
  if (!existsSync(pathToFixture)) {
    throw new Error(
      `Missing expected fixture: ${pathToFixture}. Run sheet:golden with --update to create it.`
    );
  }
}

export function compactDiffReport(diffs: string[], limit = 25): string {
  const shown = diffs.slice(0, limit);
  const lines = shown.flatMap((entry) => [entry, ""]);
  if (diffs.length > limit) {
    lines.push(`... ${diffs.length - limit} more differences omitted`);
  }
  return lines.join("\n").trim();
}
