import { describe, expect, it } from "vitest";
import { BackgroundSchema, FeatSchema } from "../src";

describe("BackgroundSchema abilityOptions", () => {
  it("accepts valid abilityOptions metadata", () => {
    const parsed = BackgroundSchema.safeParse({
      id: "srd52:background:acolyte",
      name: "Acolyte",
      abilityOptions: {
        abilities: ["int", "wis", "cha"],
        mode: "2+1_or_1+1+1"
      }
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid abilityOptions mode", () => {
    const parsed = BackgroundSchema.safeParse({
      id: "srd52:background:acolyte",
      name: "Acolyte",
      abilityOptions: {
        abilities: ["int", "wis", "cha"],
        mode: "invalid"
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects fewer than 3 abilities in abilityOptions", () => {
    const parsed = BackgroundSchema.safeParse({
      id: "srd52:background:acolyte",
      name: "Acolyte",
      abilityOptions: {
        abilities: ["wis", "cha"],
        mode: "2+1_or_1+1+1"
      }
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts background grantsFeat metadata", () => {
    const parsed = BackgroundSchema.safeParse({
      id: "srd52:background:acolyte",
      name: "Acolyte",
      grantsFeat: "srd52:feat:alert"
    });

    expect(parsed.success).toBe(true);
  });
});

describe("FeatSchema", () => {
  it("accepts valid feat JSON", () => {
    const parsed = FeatSchema.safeParse({
      id: "srd52:feat:alert",
      name: "Alert",
      effects: []
    });

    expect(parsed.success).toBe(true);
  });
});
