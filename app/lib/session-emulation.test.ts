import { describe, expect, it } from "vitest";
import {
  applyOrientation,
  DEVICE_CATALOG,
  emulationBodyFromPrefs,
  normalizePrefs,
  orientationFromSize,
  selectDevicePreset,
  setCustomSize,
  setOrientation,
  sizeForDevicePreset,
  snapWidth,
  swapDimensions,
} from "./session-emulation";

describe("orientationFromSize", () => {
  it("portrait when height >= width", () => {
    expect(orientationFromSize(390, 844)).toBe("portrait");
    expect(orientationFromSize(800, 800)).toBe("portrait");
  });
  it("landscape when width > height", () => {
    expect(orientationFromSize(1280, 800)).toBe("landscape");
  });
});

describe("applyOrientation", () => {
  it("swaps landscape size into portrait", () => {
    expect(applyOrientation(1280, 800, "portrait")).toEqual({ width: 800, height: 1280 });
  });
  it("swaps portrait size into landscape", () => {
    expect(applyOrientation(390, 844, "landscape")).toEqual({ width: 844, height: 390 });
  });
  it("leaves matching orientation alone", () => {
    expect(applyOrientation(1280, 800, "landscape")).toEqual({ width: 1280, height: 800 });
  });
});

describe("normalizePrefs", () => {
  it("never keeps Portrait with width > height", () => {
    const n = normalizePrefs({
      devicePreset: "custom",
      orientation: "portrait",
      width: 1280,
      height: 800,
    });
    expect(n.orientation).toBe("portrait");
    expect(n.width).toBeLessThanOrEqual(n.height);
    expect(n).toEqual({ ...n, width: 800, height: 1280 });
  });
});

describe("sizeForDevicePreset / selectDevicePreset", () => {
  it("maps every catalog preset to known width x height", () => {
    for (const d of DEVICE_CATALOG.filter((x) => x.id !== "custom")) {
      const sized = sizeForDevicePreset(d.id, orientationFromSize(d.width, d.height));
      expect(sized.width).toBe(d.width);
      expect(sized.height).toBe(d.height);
    }
  });

  it("iphone-14 portrait matches Playwright-ish 390x844", () => {
    const sized = sizeForDevicePreset("iphone-14", "portrait");
    expect(sized).toMatchObject({ width: 390, height: 844, orientation: "portrait", dpr: 3 });
  });

  it("desktop landscape stays 1280x800", () => {
    const prefs = selectDevicePreset(
      normalizePrefs({ devicePreset: "iphone-14", orientation: "portrait" }),
      "desktop",
    );
    expect(prefs.devicePreset).toBe("desktop");
    expect(prefs.width).toBe(1280);
    expect(prefs.height).toBe(800);
    expect(prefs.orientation).toBe("landscape");
  });
});

describe("setOrientation / swapDimensions / setCustomSize", () => {
  it("setOrientation swaps custom dimensions", () => {
    const base = normalizePrefs({ devicePreset: "custom", width: 1280, height: 800 });
    const next = setOrientation(base, "portrait");
    expect(next.width).toBe(800);
    expect(next.height).toBe(1280);
    expect(next.orientation).toBe("portrait");
  });

  it("swapDimensions flips and updates orientation", () => {
    expect(swapDimensions(390, 844)).toEqual({ width: 844, height: 390, orientation: "landscape" });
  });

  it("setCustomSize clamps and derives orientation", () => {
    const next = setCustomSize(normalizePrefs({}), 100, 9000);
    expect(next.devicePreset).toBe("custom");
    expect(next.width).toBe(320);
    expect(next.height).toBe(2160);
    expect(next.orientation).toBe("portrait");
  });
});

describe("snapWidth", () => {
  it("snaps near a breakpoint chip", () => {
    expect(snapWidth(1275)).toBe(1280);
    expect(snapWidth(770)).toBe(768);
  });
  it("leaves far values alone", () => {
    expect(snapWidth(900)).toBe(900);
  });
});

describe("emulationBodyFromPrefs (payload contract)", () => {
  it("sends width/height only for custom device", () => {
    const body = emulationBodyFromPrefs(
      normalizePrefs({ devicePreset: "desktop", networkPreset: "none", orientation: "landscape" }),
    );
    expect(body).toEqual({
      devicePreset: "desktop",
      networkPreset: "none",
      orientation: "landscape",
    });
    expect(body).not.toHaveProperty("width");
    expect(body).not.toHaveProperty("height");
  });

  it("includes custom size and network fields", () => {
    const body = emulationBodyFromPrefs(
      normalizePrefs({
        devicePreset: "custom",
        width: 1024,
        height: 768,
        networkPreset: "custom",
        latencyMs: 50,
        downloadKbps: 2000,
        uploadKbps: 800,
      }),
    );
    expect(body).toMatchObject({
      devicePreset: "custom",
      networkPreset: "custom",
      width: 1024,
      height: 768,
      latencyMs: 50,
      downloadKbps: 2000,
      uploadKbps: 800,
      orientation: "landscape",
    });
  });

  it("sets offline true for offline network", () => {
    expect(emulationBodyFromPrefs(normalizePrefs({ networkPreset: "offline" })).offline).toBe(true);
  });
});
