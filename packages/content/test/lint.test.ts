import { describe, expect, it } from "vitest";

import { lintPacks, type Pack } from "../src";

function makePack(input: Partial<Pack> & { id: string }): Pack {
  return {
    manifest: {
      id: input.id,
      name: input.id,
      version: "0.0.1",
      license: "MIT",
      source: "test"
    },
    entities: {
      species: [],
      backgrounds: [],
      classes: [],
      features: [],
      feats: [],
      equipment: [],
      spells: [],
      spellLists: []
    },
    ...input
  } as Pack;
}

describe("lintPacks", () => {
  it("reports duplicate ids inside a single pack", () => {
    const report = lintPacks([
      makePack({
        id: "dup",
        entities: {
          species: [],
          backgrounds: [
            { id: "dup:bg:acolyte", name: "Acolyte" },
            { id: "dup:bg:acolyte", name: "Acolyte 2" }
          ],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(report.errors.some((issue) => issue.code === "DUPLICATE_ENTITY_ID")).toBe(true);
  });

  it("reports dangling replacement targets", () => {
    const report = lintPacks([
      makePack({
        id: "replace",
        entities: {
          species: [{ id: "replace:species:new", name: "New", replaces: "replace:species:missing" }],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(report.errors.some((issue) => issue.code === "DANGLING_REPLACEMENT_TARGET")).toBe(true);
  });

  it("reports dangling background feat references", () => {
    const report = lintPacks([
      makePack({
        id: "refs",
        entities: {
          species: [],
          backgrounds: [
            {
              id: "refs:bg:acolyte",
              name: "Acolyte",
              grantsOriginFeatId: "refs:feat:missing"
            }
          ],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(report.errors.some((issue) => issue.code === "DANGLING_REFERENCE")).toBe(true);
  });

  it("reports dangling class spell list references", () => {
    const report = lintPacks([
      makePack({
        id: "spell-refs",
        entities: {
          species: [],
          backgrounds: [],
          classes: [
            {
              id: "spell-refs:class:wizard",
              name: "Wizard",
              spellListRefs: ["spell-refs:spelllist:missing"]
            }
          ],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(report.errors.some((issue) => issue.code === "DANGLING_REFERENCE")).toBe(true);
  });

  it("reports dangling spell list spell references", () => {
    const report = lintPacks([
      makePack({
        id: "spell-list",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: [
            {
              id: "spell-list:spelllist:wizard",
              name: "Wizard List",
              spellIds: ["spell-list:spell:missing"]
            }
          ]
        }
      })
    ]);

    expect(report.errors.some((issue) => issue.code === "DANGLING_REFERENCE")).toBe(true);
  });
});
