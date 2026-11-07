import { describe, expect, it } from "vitest";
import { DEFAULT_EMULATION_PREFS } from "./session-emulation";
import {
  applyUserPreset,
  nameTaken,
  resolveResetPrefs,
  type UserRecordingPreset,
} from "./user-recording-presets";

const devicePreset = (over: Partial<UserRecordingPreset> = {}): UserRecordingPreset => ({
  id: "d1",
  kind: "device",
  name: "Phone",
  payload: { width: 480, height: 844, orientation: "portrait" },
  isDefault: false,
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("applyUserPreset", () => {
  it("resolves a device preset to custom width/height/orientation", () => {
    const next = applyUserPreset(DEFAULT_EMULATION_PREFS, devicePreset());
    expect(next.devicePreset).toBe("custom");
    expect(next.width).toBe(480);
    expect(next.height).toBe(844);
    expect(next.orientation).toBe("portrait");
  });

  it("resolves a setup preset to custom device + custom network fields", () => {
    const next = applyUserPreset(DEFAULT_EMULATION_PREFS, {
      id: "s1",
      kind: "setup",
      name: "Field",
      payload: {
        device: { width: 375, height: 812, orientation: "portrait" },
        network: { downloadKbps: 500, uploadKbps: 500, latencyMs: 400 },
      },
      isDefault: true,
      createdAt: "",
      updatedAt: "",
    });
    expect(next.devicePreset).toBe("custom");
    expect(next.width).toBe(375);
    expect(next.networkPreset).toBe("custom");
    expect(next.latencyMs).toBe(400);
  });
});

describe("resolveResetPrefs", () => {
  it("uses the default setup when present", () => {
    const prefs = resolveResetPrefs([
      devicePreset({ isDefault: true }),
      {
        id: "s1",
        kind: "setup",
        name: "Mine",
        payload: {
          device: { width: 390, height: 844, orientation: "portrait" },
          network: { downloadKbps: 1600, uploadKbps: 750, latencyMs: 150 },
        },
        isDefault: true,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(prefs.width).toBe(390);
    expect(prefs.networkPreset).toBe("custom");
  });

  it("falls back to system default when none set", () => {
    expect(resolveResetPrefs([])).toMatchObject({
      devicePreset: DEFAULT_EMULATION_PREFS.devicePreset,
      width: DEFAULT_EMULATION_PREFS.width,
    });
  });
});

describe("nameTaken", () => {
  it("is case-insensitive", () => {
    expect(nameTaken([devicePreset({ name: "Phone" })], "device", "phone")).toBe(true);
    expect(nameTaken([devicePreset({ name: "Phone" })], "network", "Phone")).toBe(false);
  });
});
