import { describe, expect, it } from "vitest";
import { isNearWhiteBrightness } from "./preview-image";

describe("isNearWhiteBrightness", () => {
  it("flags near-white frames (mean >= 245 and std <= 12)", () => {
    expect(isNearWhiteBrightness({ mean: 250, std: 4, samples: 100 })).toBe(true);
    expect(isNearWhiteBrightness({ mean: 245, std: 12, samples: 100 })).toBe(true);
  });

  it("allows contentful frames", () => {
    expect(isNearWhiteBrightness({ mean: 244, std: 4, samples: 100 })).toBe(false);
    expect(isNearWhiteBrightness({ mean: 250, std: 13, samples: 100 })).toBe(false);
    expect(isNearWhiteBrightness({ mean: 70, std: 60, samples: 100 })).toBe(false);
  });

  it("ignores empty samples", () => {
    expect(isNearWhiteBrightness({ mean: 255, std: 0, samples: 0 })).toBe(false);
  });
});
