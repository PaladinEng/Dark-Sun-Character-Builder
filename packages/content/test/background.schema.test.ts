import { describe, expect, it } from "vitest";

import { BackgroundSchema } from "../src/entities";

describe("BackgroundSchema", () => {
  it("preserves grantsFeat when provided", () => {
    const parsed = BackgroundSchema.parse({
      id: "srd52:background:acolyte",
      name: "Acolyte",
      grantsFeat: "srd52:feat:alert",
      effects: [],
    });

    expect(parsed.grantsFeat).toBe("srd52:feat:alert");
  });

  it("accepts originFeatChoice when provided", () => {
    const parsed = BackgroundSchema.parse({
      id: "srd52:background:custom",
      name: "Custom",
      originFeatChoice: {
        featIds: ["srd52:feat:alert"],
      },
      effects: [],
    });

    expect(parsed.originFeatChoice?.featIds).toEqual(["srd52:feat:alert"]);
  });

  it("rejects backgrounds with both grantsFeat and originFeatChoice", () => {
    const parsed = BackgroundSchema.safeParse({
      id: "srd52:background:invalid",
      name: "Invalid",
      grantsFeat: "srd52:feat:alert",
      originFeatChoice: {
        featIds: ["srd52:feat:alert"],
      },
    });

    expect(parsed.success).toBe(false);
  });
});
