import { describe, expect, it } from "vitest";
import { applyResizeDelta, fitScale, screenDeltaToViewportPx } from "./preview-resize";

describe("screenDeltaToViewportPx", () => {
  it("divides screen delta by preview scale", () => {
    expect(screenDeltaToViewportPx(100, 0.5)).toBe(200);
    expect(screenDeltaToViewportPx(44, 0.22)).toBeCloseTo(200, 5);
  });

  it("falls back to scale 1 when scale is zero/tiny", () => {
    expect(screenDeltaToViewportPx(50, 0)).toBe(50);
    expect(screenDeltaToViewportPx(50, 0.00001)).toBe(50);
  });
});

describe("applyResizeDelta", () => {
  it("grows width from right edge with fixed scale", () => {
    const r = applyResizeDelta({
      startW: 480,
      startH: 844,
      dxScreen: 50,
      dyScreen: 0,
      scale: 0.5,
      edge: "right",
      shift: true,
      keepAspect: false,
    });
    expect(r.width).toBe(580);
    expect(r.height).toBe(844);
  });

  it("snaps width when shift is off", () => {
    const r = applyResizeDelta({
      startW: 750,
      startH: 844,
      dxScreen: 20,
      dyScreen: 0,
      scale: 1,
      edge: "right",
      shift: false,
      keepAspect: false,
    });
    // 770 → nearest breakpoint chip 768
    expect(r.width).toBe(768);
  });

  it("keeps aspect on corner drag without shift", () => {
    const r = applyResizeDelta({
      startW: 400,
      startH: 800,
      dxScreen: 100,
      dyScreen: 0,
      scale: 1,
      edge: "corner",
      shift: false,
      keepAspect: true,
    });
    expect(r.width).toBe(500);
    expect(r.height).toBe(1000);
  });
});

describe("fitScale", () => {
  it("fits the longer axis into the box", () => {
    const r = fitScale(480, 844, 240, 422);
    expect(r.scale).toBeCloseTo(0.5, 5);
    expect(r.frameW).toBeCloseTo(240, 5);
    expect(r.frameH).toBeCloseTo(422, 5);
  });
});
