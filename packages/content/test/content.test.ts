import { describe, expect, it } from "vitest";

import {
  BackgroundSchema,
  FeatSchema,
  getAttributionBlocks,
  mergePacks,
  type Pack
} from "../src/index.js";

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

describe("content", () => {
  it("supports replacement semantics", () => {
    const srd = makePack({
      id: "srd52",
      entities: {
        species: [{ id: "srd52:species:human", name: "Human" }],
        backgrounds: [],
        classes: [],
        features: [],
        feats: [],
        equipment: [],
        spells: [],
        spellLists: []
      }
    });
    const darksun = makePack({
      id: "darksun",
      entities: {
        species: [
          {
            id: "darksun:species:wasteland-human",
            name: "Wasteland Human",
            replaces: "srd52:species:human"
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
    });

    const merged = mergePacks([srd, darksun]);
    expect(merged.content.speciesById["srd52:species:human"]).toBeUndefined();
    expect(
      merged.content.speciesById["darksun:species:wasteland-human"]?.name
    ).toBe("Wasteland Human");
    expect(merged.report.species.replaced).toBe(1);
  });

  it("returns attribution blocks with SRD text", () => {
    const merged = mergePacks([
      makePack({
        id: "srd52",
        manifest: {
          id: "srd52",
          name: "SRD 5.2 Baseline",
          version: "0.0.1",
          license: "CC-BY-4.0",
          source: "https://www.dndbeyond.com/srd",
          attributionText: "SRD 5.2.1 attribution sample"
        } as any
      })
    ]);
    const blocks = getAttributionBlocks(merged.content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].attributionText).toContain("SRD 5.2.1");
  });

  it("validates background ability options shape", () => {
    const ok = BackgroundSchema.safeParse({
      id: "b",
      name: "Background",
      abilityOptions: {
        abilities: ["wis", "int", "cha"],
        mode: "2+1_or_1+1+1"
      }
    });
    expect(ok.success).toBe(true);

    const bad = BackgroundSchema.safeParse({
      id: "b",
      name: "Background",
      abilityOptions: {
        abilities: ["wis", "int"],
        mode: "invalid"
      }
    });
    expect(bad.success).toBe(false);
  });

  it("validates feat categories", () => {
    const valid = FeatSchema.safeParse({
      id: "feat",
      name: "Feat",
      category: "general"
    });
    expect(valid.success).toBe(true);
  });
});
