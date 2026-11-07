import { describe, expect, it } from "vitest";
import { fitStreamScale } from "./stream-fit";

describe("fitStreamScale", () => {
  it("scales 1920x1080 down to fit a smaller container", () => {
    const r = fitStreamScale(1200, 700, 1920, 1080);
    // Width-limited: min(1200/1920, 700/1080) = 1200/1920
    expect(r.scale).toBeCloseTo(1200 / 1920, 5);
    expect(r.width).toBe(1200);
    expect(r.height).toBeLessThanOrEqual(700);
    expect(r.width / r.height).toBeCloseTo(1920 / 1080, 3);
  });

  it("scales 1280x800 to fit", () => {
    const r = fitStreamScale(1000, 600, 1280, 800);
    expect(r.scale).toBeCloseTo(Math.min(1000 / 1280, 600 / 800), 5);
    expect(r.height).toBeLessThanOrEqual(600);
  });

  it("allows upscaling a phone viewport up to 1.5x", () => {
    const r = fitStreamScale(900, 1600, 390, 844);
    // raw would be > 2; clamp to 1.5
    expect(r.scale).toBe(1.5);
    expect(r.width).toBe(Math.round(390 * 1.5));
    expect(r.height).toBe(Math.round(844 * 1.5));
  });

  it("does not upscale beyond need when container is only slightly larger", () => {
    const r = fitStreamScale(400, 900, 390, 844);
    expect(r.scale).toBeCloseTo(400 / 390, 5);
    expect(r.scale).toBeLessThanOrEqual(1.5);
  });

  it("reserves symmetrical bezel inset so the frame is not clipped", () => {
    const plain = fitStreamScale(400, 900, 390, 844);
    const withBezel = fitStreamScale(400, 900, 390, 844, { inset: 9 });
    expect(withBezel.width).toBeLessThan(plain.width);
    expect(withBezel.width + 18).toBeLessThanOrEqual(400);
  });
});
