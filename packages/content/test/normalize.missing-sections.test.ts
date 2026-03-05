import { describe, expect, it } from "vitest";

import { normalizeSeedPack } from "../src/normalize";

describe("normalizeSeedPack", () => {
  it("returns empty arrays for omitted sections", () => {
    const normalized = normalizeSeedPack({}, "srd52");

    expect(normalized.species).toEqual([]);
    expect(normalized.backgrounds).toEqual([]);
    expect(normalized.classes).toEqual([]);
    expect(normalized.features).toEqual([]);
    expect(normalized.feats).toEqual([]);
    expect(normalized.equipment).toEqual([]);
    expect(normalized.spells).toEqual([]);
    expect(normalized.spellLists).toEqual([]);
  });
});
