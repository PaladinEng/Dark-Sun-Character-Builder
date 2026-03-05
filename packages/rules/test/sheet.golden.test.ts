import { writeFileSync } from "node:fs";

import { describe, it } from "vitest";

import { computeDerivedState } from "../src";
import {
  assertFixtureExists,
  collectDiffs,
  compactDiffReport,
  fixtureExpectedPath,
  listFixtureIds,
  normalizeForComparison,
  readFixtureExpected,
  readFixtureInput,
} from "./sheet-fixtures";

const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === "1";

describe("sheet.golden", () => {
  const fixtureIds = listFixtureIds();

  it("has at least one fixture", () => {
    if (fixtureIds.length === 0) {
      throw new Error("No sheet fixtures found.");
    }
  });

  for (const id of fixtureIds) {
    it(`${id} matches expected derived output`, () => {
      const { state, content } = readFixtureInput(id);
      const actual = normalizeForComparison(computeDerivedState(state, content));
      const expectedPath = fixtureExpectedPath(id);

      if (UPDATE_GOLDEN) {
        writeFileSync(expectedPath, `${JSON.stringify(actual, null, 2)}\n`, "utf8");
        return;
      }

      assertFixtureExists(expectedPath);
      const expected = normalizeForComparison(readFixtureExpected(id));
      const diffs = collectDiffs(expected, actual);
      if (diffs.length > 0) {
        throw new Error(
          `Fixture '${id}' mismatch:\n\n${compactDiffReport(diffs)}`
        );
      }
    });
  }
});
