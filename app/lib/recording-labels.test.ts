import { describe, expect, it } from "vitest";
import { deviceDisplayName, networkChipLabel, pluralize, recordingCountsLine } from "./recording-labels";

describe("pluralize", () => {
  it("uses singular for 1", () => {
    expect(pluralize(1, "screen")).toBe("1 screen");
    expect(pluralize(0, "screen")).toBe("0 screens");
    expect(pluralize(2, "action")).toBe("2 actions");
  });
});

describe("deviceDisplayName", () => {
  it("uses catalog labels, not title-cased ids", () => {
    expect(deviceDisplayName("desktop-hd")).toBe("Desktop HD");
    expect(deviceDisplayName("iphone-14")).toBe("iPhone 14");
    expect(deviceDisplayName("custom")).toBe("Custom");
  });
});

describe("networkChipLabel", () => {
  it("formats custom network with rates", () => {
    expect(
      networkChipLabel({
        devicePreset: "custom",
        networkPreset: "custom",
        downloadKbps: 1500,
        uploadKbps: 750,
        latencyMs: 100,
      }),
    ).toBe("Custom 1.5 Mbps down / 750 kbps up / 100 ms");
  });

  it("uses catalog label for named presets", () => {
    expect(networkChipLabel({ devicePreset: "desktop", networkPreset: "4g" })).toBe("4G");
  });
});

describe("recordingCountsLine", () => {
  it("pluralizes each count", () => {
    expect(recordingCountsLine(1, 1, 1)).toBe("1 screen · 1 action · 1 event");
    expect(recordingCountsLine(2, 0, 5)).toBe("2 screens · 0 actions · 5 events");
  });
});
