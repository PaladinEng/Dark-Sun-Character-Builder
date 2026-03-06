import { describe, expect, it } from "vitest";

import { lintPacks } from "../src";
import type { Pack } from "../src/load";

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

  it("reports duplicate ids across entity types inside a single pack", () => {
    const report = lintPacks([
      makePack({
        id: "dup-cross-type",
        entities: {
          species: [{ id: "dup-cross-type:shared", name: "Shared Species" }],
          backgrounds: [{ id: "dup-cross-type:shared", name: "Shared Background" }],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DUPLICATE_ENTITY_ID" &&
          issue.entityType === "backgrounds" &&
          issue.entityId === "dup-cross-type:shared"
      )
    ).toBe(true);
  });

  it("reports conflicting replacements inside a single pack", () => {
    const report = lintPacks([
      makePack({
        id: "replace-conflict",
        entities: {
          species: [
            {
              id: "replace-conflict:species:first",
              name: "First Replacer",
              replaces: "replace-conflict:species:base"
            },
            {
              id: "replace-conflict:species:second",
              name: "Second Replacer",
              replaces: "replace-conflict:species:base"
            }
          ],
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "CONFLICTING_REPLACEMENT" &&
          issue.entityType === "species" &&
          issue.entityId === "replace-conflict:species:second"
      )
    ).toBe(true);
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

  it("reports dangling background grantsFeat references with grantsFeat path", () => {
    const report = lintPacks([
      makePack({
        id: "background-grants-feat-ref",
        entities: {
          species: [],
          backgrounds: [
            {
              id: "background-grants-feat-ref:bg:acolyte",
              name: "Acolyte",
              grantsFeat: "background-grants-feat-ref:feat:missing"
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "backgrounds" &&
          issue.path === "grantsFeat"
      )
    ).toBe(true);
  });

  it("reports dangling feat feature prerequisite references", () => {
    const report = lintPacks([
      makePack({
        id: "feat-feature-refs",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [
            {
              id: "feat-feature-refs:feat:spell-blade",
              name: "Spell Blade",
              prerequisites: {
                featureIds: ["feat-feature-refs:feature:missing"]
              }
            }
          ],
          equipment: [],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "feats" &&
          issue.path === "prerequisites.featureIds"
      )
    ).toBe(true);
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
              spellListRefIds: ["spell-refs:spelllist:missing"]
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

  it("reports dangling spell access refs for spellcasting classes", () => {
    const report = lintPacks([
      makePack({
        id: "spellcasting-access-refs",
        entities: {
          species: [],
          backgrounds: [],
          classes: [
            {
              id: "spellcasting-access-refs:class:wizard",
              name: "Wizard",
              spellcasting: {
                ability: "int",
                progression: "full"
              },
              spellListRefIds: ["spellcasting-access-refs:spelllist:missing"]
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "classes" &&
          issue.path === "spellListRefIds"
      )
    ).toBe(true);
  });

  it("reports dangling class feature references", () => {
    const report = lintPacks([
      makePack({
        id: "class-feature-refs",
        entities: {
          species: [],
          backgrounds: [],
          classes: [
            {
              id: "class-feature-refs:class:fighter",
              name: "Fighter",
              classFeaturesByLevel: [
                { level: 1, featureId: "class-feature-refs:feature:missing" }
              ]
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "classes" &&
          issue.path === "classFeaturesByLevel"
      )
    ).toBe(true);
  });

  it("accepts legacy class spellListRefs for dangling reference checks", () => {
    const report = lintPacks([
      makePack({
        id: "legacy-spell-refs",
        entities: {
          species: [],
          backgrounds: [],
          classes: [
            {
              id: "legacy-spell-refs:class:wizard",
              name: "Wizard",
              spellListRefs: ["legacy-spell-refs:spelllist:missing"]
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "classes" &&
          issue.path === "spellListRefIds"
      )
    ).toBe(true);
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

  it("reports dangling starting equipment item references", () => {
    const report = lintPacks([
      makePack({
        id: "starting-equipment-item-ref",
        entities: {
          species: [],
          backgrounds: [
            {
              id: "starting-equipment-item-ref:bg:acolyte",
              name: "Acolyte",
              startingEquipment: {
                itemIds: ["starting-equipment-item-ref:equipment:missing-item"]
              }
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "backgrounds" &&
          issue.path === "startingEquipment.itemIds"
      )
    ).toBe(true);
  });

  it("reports spell schema validation failures for invalid school values", () => {
    const report = lintPacks([
      makePack({
        id: "spell-school",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [
            {
              id: "spell-school:spell:bad-school",
              name: "Bad School",
              level: 1,
              school: "chronomancy",
              ritual: false,
              castingTime: "1 action",
              range: "Self",
              components: ["V"],
              duration: "Instantaneous",
              concentration: false
            } as any
          ],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "SCHEMA_VALIDATION_FAILED" &&
          issue.entityType === "spells" &&
          issue.path === "school"
      )
    ).toBe(true);
  });

  it("reports equipment schema validation failures for invalid mastery values", () => {
    const report = lintPacks([
      makePack({
        id: "weapon-mastery",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [
            {
              id: "weapon-mastery:equipment:bad-weapon",
              name: "Bad Weapon",
              type: "weapon",
              damageDice: "1d6",
              weaponCategory: "simple",
              masteryProperties: ["explode"]
            } as any
          ],
          spells: [],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "SCHEMA_VALIDATION_FAILED" &&
          issue.entityType === "equipment" &&
          issue.path === "masteryProperties.0"
      )
    ).toBe(true);
  });

  it("reports duplicate ids for spells inside a single pack", () => {
    const report = lintPacks([
      makePack({
        id: "spell-dups",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [
            {
              id: "spell-dups:spell:magic-missile",
              name: "Magic Missile",
              level: 1,
              school: "evocation",
              ritual: false,
              castingTime: "1 action",
              range: "120 feet",
              components: ["V", "S"],
              duration: "Instantaneous",
              concentration: false
            },
            {
              id: "spell-dups:spell:magic-missile",
              name: "Magic Missile Copy",
              level: 1,
              school: "evocation",
              ritual: false,
              castingTime: "1 action",
              range: "120 feet",
              components: ["V", "S"],
              duration: "Instantaneous",
              concentration: false
            }
          ],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DUPLICATE_ENTITY_ID" &&
          issue.entityType === "spells" &&
          issue.entityId === "spell-dups:spell:magic-missile"
      )
    ).toBe(true);
  });

  it("reports spell schema validation failures when ritual/concentration flags are missing", () => {
    const report = lintPacks([
      makePack({
        id: "spell-flags",
        entities: {
          species: [],
          backgrounds: [],
          classes: [],
          features: [],
          feats: [],
          equipment: [],
          spells: [
            {
              id: "spell-flags:spell:missing-flags",
              name: "Missing Flags",
              level: 1,
              school: "evocation",
              castingTime: "1 action",
              range: "Self",
              components: ["V"],
              duration: "Instantaneous"
            } as any
          ],
          spellLists: []
        }
      })
    ]);

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "SCHEMA_VALIDATION_FAILED" &&
          issue.entityType === "spells" &&
          issue.path === "ritual"
      )
    ).toBe(true);
  });

  it("reports dangling tool proficiency references in effects", () => {
    const report = lintPacks([
      makePack({
        id: "tool-ref",
        entities: {
          species: [],
          backgrounds: [
            {
              id: "tool-ref:background:bad-tool",
              name: "Bad Tool",
              effects: [{ type: "grant_tool_proficiency", tool: "Bad Tool Name" }]
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "backgrounds" &&
          issue.path === "effects[0].tool"
      )
    ).toBe(true);
  });

  it("reports dangling language references in effects", () => {
    const report = lintPacks([
      makePack({
        id: "language-ref",
        entities: {
          species: [
            {
              id: "language-ref:species:bad-language",
              name: "Bad Language",
              effects: [{ type: "grant_language", language: "Bad Language Name" }]
            }
          ],
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

    expect(
      report.errors.some(
        (issue) =>
          issue.code === "DANGLING_REFERENCE" &&
          issue.entityType === "species" &&
          issue.path === "effects[0].language"
      )
    ).toBe(true);
  });
});
