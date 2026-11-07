import { describe, expect, it } from "vitest";
import {
  RATIO_CHIPS,
  applyLockedDimension,
  gcd,
  orientedRatio,
  ratioLabel,
  sizeFromRatio,
} from "./viewport-ratio";
import { clampScreenSize, resolutionNameForSize, sizeFromResolution, sizeDisplayLabel } from "./viewport-resolution";
import { RESOLUTION_PRESETS } from "./viewport-resolution";

describe("gcd / ratioLabel", () => {
  it("computes gcd", () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(16, 10)).toBe(2);
  });

  it("snaps known ratios within 1%", () => {
    expect(ratioLabel(1920, 1080)).toBe("16:9");
    expect(ratioLabel(1280, 800)).toBe("16:10");
    expect(ratioLabel(1080, 1920)).toBe("9:16");
  });

  it("falls back to about N:1", () => {
    expect(ratioLabel(1370, 800)).toMatch(/^about /);
  });
});

describe("sizeFromRatio", () => {
  it("keeps width and computes height for 16:9 landscape", () => {
    const r = sizeFromRatio(1280, RATIO_CHIPS[0], "landscape");
    expect(r).toEqual({ width: 1280, height: 720, limited: false });
  });

  it("flips in portrait (16:9 → 9:16)", () => {
    const orient = orientedRatio(RATIO_CHIPS[0], "portrait");
    expect(orient.label).toBe("9:16");
    const r = sizeFromRatio(390, RATIO_CHIPS[0], "portrait");
    expect(r.width).toBe(390);
    expect(r.height).toBe(Math.round((390 * 16) / 9));
  });

  it("clamps when height would exceed max and sets limited", () => {
    const r = sizeFromRatio(3840, RATIO_CHIPS.find((c) => c.id === "9-19.5")!, "portrait");
    expect(r.height).toBeLessThanOrEqual(2160);
    expect(r.width).toBeGreaterThanOrEqual(320);
  });
});

describe("applyLockedDimension", () => {
  it("updates height when width changes", () => {
    const r = applyLockedDimension({ width: 1280, height: 720 }, { width: 1920 });
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });
});

describe("resolution presets", () => {
  it("applies landscape and portrait", () => {
    const p = RESOLUTION_PRESETS.find((x) => x.id === "1080p")!;
    expect(sizeFromResolution(p, "landscape")).toEqual({ width: 1920, height: 1080 });
    expect(sizeFromResolution(p, "portrait")).toEqual({ width: 1080, height: 1920 });
  });

  it("names matching sizes", () => {
    expect(resolutionNameForSize(1920, 1080)).toBe("1080p Full HD");
    expect(resolutionNameForSize(1080, 1920)).toBe("1080p Full HD");
    expect(sizeDisplayLabel(1280, 800)).toBe("16:10");
  });

  it("clamps My screen / This window", () => {
    expect(clampScreenSize(5000, 100)).toEqual({ width: 3840, height: 480 });
    expect(clampScreenSize(100, 5000)).toEqual({ width: 320, height: 2160 });
  });
});
