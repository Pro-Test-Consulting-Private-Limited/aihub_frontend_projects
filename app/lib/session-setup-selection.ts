import {
  DEVICE_CATALOG,
  deviceById,
  type DeviceCategory,
  type SessionEmulationPrefs,
} from "./session-emulation";

export type DeviceTab = DeviceCategory | "recent" | "mine";

export type DeviceSelection =
  | { kind: "catalog"; id: string }
  | { kind: "custom" }
  | { kind: "mine"; presetId: string };

/** Tab is derived from the selected card — never the other way around. */
export function tabForSelection(selection: DeviceSelection, prefs: SessionEmulationPrefs): DeviceTab {
  if (selection.kind === "mine") return "mine";
  if (selection.kind === "custom") return "custom";
  const entry = deviceById(selection.id);
  return entry?.category ?? "laptop";
}

export function selectionFromPrefs(prefs: SessionEmulationPrefs): DeviceSelection {
  if (prefs.devicePreset === "custom") return { kind: "custom" };
  const entry = deviceById(prefs.devicePreset);
  if (!entry || entry.id === "custom") return { kind: "custom" };
  // Prefs may have been edited away from the catalog size — treat as custom.
  if (prefs.width !== entry.width || prefs.height !== entry.height) return { kind: "custom" };
  return { kind: "catalog", id: entry.id };
}

/** Editing W/H: if it still matches a catalog preset, select that; otherwise Custom. */
export function selectionAfterSizeEdit(
  width: number,
  height: number,
  orientation: SessionEmulationPrefs["orientation"],
): DeviceSelection {
  const match = DEVICE_CATALOG.find(
    (d) => d.id !== "custom" && d.width === width && d.height === height,
  );
  if (match) return { kind: "catalog", id: match.id };
  void orientation;
  return { kind: "custom" };
}

export function showCustomPanel(selection: DeviceSelection): boolean {
  return selection.kind === "custom";
}

export function isCardSelected(selection: DeviceSelection, cardId: string): boolean {
  if (selection.kind === "catalog") return selection.id === cardId;
  if (selection.kind === "custom") return cardId === "custom";
  return false;
}
