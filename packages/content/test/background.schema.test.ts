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
});
