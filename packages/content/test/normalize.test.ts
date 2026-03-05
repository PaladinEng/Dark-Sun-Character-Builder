import { describe, expect, it } from "vitest";
import {
  BackgroundSchema,
  ClassSchema,
  EquipmentSchema,
  FeatureSchema,
  SpellListSchema,
  SpellSchema,
  SeedPackSchema,
  SpeciesSchema,
  normalizeSeedPack
} from "../src";
import type { SeedPack } from "../src";

describe("normalizeSeedPack", () => {
  it("maps authoring-friendly equipment and ids into normalized entities", () => {
    const seed: SeedPack = {
      species: [{ slug: "human", name: "Human" }],
      backgrounds: [{ slug: "acolyte", name: "Acolyte" }],
      classes: [{ slug: "fighter", name: "Fighter", hitDie: 10 }],
      features: [{ slug: "darkvision", name: "Darkvision" }],
      equipment: [
        {
          slug: "chain-shirt",
          name: "Chain Shirt",
          type: "armor",
          armorCategory: "medium",
          armorClassBase: 13,
          dexCap: 2
        },
        {
          slug: "rapier",
          name: "Rapier",
          type: "weapon",
          damageDice: "1d8",
          properties: ["finesse"]
        },
        {
          slug: "shield",
          name: "Shield",
          type: "shield"
        }
      ]
    };

    const normalized = normalizeSeedPack(seed, "srd52");

    expect(normalized.species[0].id).toBe("srd52:species:human");
    expect(normalized.backgrounds[0].id).toBe("srd52:background:acolyte");
    expect(normalized.classes[0].id).toBe("srd52:class:fighter");
    expect(normalized.features[0].id).toBe("srd52:feature:darkvision");

    const armor = normalized.equipment.find((entry) => entry.id.endsWith(":chain-shirt"));
    const weapon = normalized.equipment.find((entry) => entry.id.endsWith(":rapier"));
    const shield = normalized.equipment.find((entry) => entry.id.endsWith(":shield"));

    expect(armor?.type).toBe("armor_medium");
    expect(weapon?.type).toBe("weapon");
    expect(weapon?.damageDice).toBe("1d8");
    expect(shield?.type).toBe("shield");
    expect(shield?.hasShieldBonus).toBe(true);
  });

  it("throws a clear error when armorCategory is missing for armor", () => {
    const badSeed = {
      equipment: [{ slug: "bad-armor", name: "Bad Armor", type: "armor" }]
    } as unknown as SeedPack;

    expect(() => normalizeSeedPack(badSeed, "srd52")).toThrow(
      "Normalization error for equipment 'bad-armor': missing required value (field: armorCategory)"
    );
  });

  it("throws a clear error when damageDice is missing for weapon", () => {
    const badSeed = {
      equipment: [{ slug: "bad-weapon", name: "Bad Weapon", type: "weapon" }]
    } as unknown as SeedPack;

    expect(() => normalizeSeedPack(badSeed, "srd52")).toThrow(
      "Normalization error for equipment 'bad-weapon': missing required value (field: damageDice)"
    );
  });

  it("produces normalized entities that validate against pack schemas", () => {
    const parsedSeed = SeedPackSchema.parse({
      species: [{ slug: "human", name: "Human" }],
      backgrounds: [{ slug: "sage", name: "Sage" }],
      classes: [{ slug: "wizard", name: "Wizard", hitDie: 6 }],
      features: [{ slug: "spellcasting", name: "Spellcasting" }],
      equipment: [
        {
          slug: "padded-armor",
          name: "Padded Armor",
          type: "armor",
          armorCategory: "light",
          armorClassBase: 11
        },
        {
          slug: "shortbow",
          name: "Shortbow",
          type: "weapon",
          damageDice: "1d6",
          properties: ["ammunition", "range 80/320"]
        },
        { slug: "shield", name: "Shield", type: "shield" }
      ]
    });

    const normalized = normalizeSeedPack(parsedSeed, "srd52");

    for (const species of normalized.species) {
      expect(SpeciesSchema.safeParse(species).success).toBe(true);
    }
    for (const background of normalized.backgrounds) {
      expect(BackgroundSchema.safeParse(background).success).toBe(true);
    }
    for (const klass of normalized.classes) {
      expect(ClassSchema.safeParse(klass).success).toBe(true);
    }
    for (const feature of normalized.features) {
      expect(FeatureSchema.safeParse(feature).success).toBe(true);
    }
    for (const equipment of normalized.equipment) {
      expect(EquipmentSchema.safeParse(equipment).success).toBe(true);
    }
    for (const spell of normalized.spells) {
      expect(SpellSchema.safeParse(spell).success).toBe(true);
    }
    for (const spellList of normalized.spellLists) {
      expect(SpellListSchema.safeParse(spellList).success).toBe(true);
    }
  });
});
