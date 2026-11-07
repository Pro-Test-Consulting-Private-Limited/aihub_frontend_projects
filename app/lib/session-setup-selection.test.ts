import { describe, expect, it } from "vitest";
import { DEFAULT_EMULATION_PREFS } from "./session-emulation";
import {
  isCardSelected,
  selectionAfterSizeEdit,
  selectionFromPrefs,
  showCustomPanel,
  tabForSelection,
} from "./session-setup-selection";

describe("session-setup-selection", () => {
  it("selects the catalog card's tab from the selected card", () => {
    const sel = { kind: "catalog" as const, id: "iphone-14" };
    expect(tabForSelection(sel, DEFAULT_EMULATION_PREFS)).toBe("phone");
  });

  it("shows Custom panel only when Custom is selected", () => {
    expect(showCustomPanel({ kind: "custom" })).toBe(true);
    expect(showCustomPanel({ kind: "catalog", id: "desktop" })).toBe(false);
  });

  it("switches to Custom when size matches no preset", () => {
    expect(selectionAfterSizeEdit(320, 480, "portrait")).toEqual({ kind: "custom" });
  });

  it("selects matching catalog preset when size matches", () => {
    expect(selectionAfterSizeEdit(390, 844, "portrait")).toEqual({ kind: "catalog", id: "iphone-14" });
  });

  it("treats edited-away catalog prefs as custom", () => {
    const prefs = { ...DEFAULT_EMULATION_PREFS, devicePreset: "desktop", width: 320, height: 480 };
    expect(selectionFromPrefs(prefs)).toEqual({ kind: "custom" });
  });

  it("marks only the selected card", () => {
    expect(isCardSelected({ kind: "catalog", id: "desktop" }, "desktop")).toBe(true);
    expect(isCardSelected({ kind: "catalog", id: "desktop" }, "custom")).toBe(false);
    expect(isCardSelected({ kind: "custom" }, "custom")).toBe(true);
  });
});
