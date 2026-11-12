import {
  DEFAULT_EMULATION_PREFS,
  normalizePrefs,
  type Orientation,
  type SessionEmulationPrefs,
} from "./session-emulation";

export const USER_PRESET_MAX = 20;

export type PresetKind = "device" | "network" | "setup";

export type DevicePresetPayload = {
  width: number;
  height: number;
  orientation: Orientation;
  /** Optional; older presets omit this. */
  deviceScaleFactor?: number;
  /** Optional custom UA persisted with the W×H profile. */
  userAgent?: string;
};

export type NetworkPresetPayload = {
  downloadKbps: number;
  uploadKbps: number;
  latencyMs: number;
  offline?: boolean;
};

export type SetupPresetPayload = {
  device: DevicePresetPayload;
  network: NetworkPresetPayload;
};

export type UserRecordingPreset = {
  id: string;
  kind: PresetKind;
  name: string;
  payload: DevicePresetPayload | NetworkPresetPayload | SetupPresetPayload;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const cacheKey = (userId: string) => `appatlas-user-recording-presets:${userId || "anonymous"}`;

export function loadPresetCache(userId: string): UserRecordingPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset).slice(0, USER_PRESET_MAX);
  } catch {
    return [];
  }
}

export function savePresetCache(userId: string, items: UserRecordingPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cacheKey(userId), JSON.stringify(items.slice(0, USER_PRESET_MAX)));
}

function isPreset(x: unknown): x is UserRecordingPreset {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.kind === "device" || o.kind === "network" || o.kind === "setup") &&
    typeof o.name === "string" &&
    o.payload != null
  );
}

export function devicePayloadFromPrefs(prefs: SessionEmulationPrefs): DevicePresetPayload {
  const payload: DevicePresetPayload = {
    width: prefs.width,
    height: prefs.height,
    orientation: prefs.orientation,
  };
  if (prefs.deviceScaleFactor && prefs.deviceScaleFactor !== 1) {
    payload.deviceScaleFactor = prefs.deviceScaleFactor;
  }
  const ua = (prefs as SessionEmulationPrefs & { userAgent?: string }).userAgent?.trim();
  if (ua) payload.userAgent = ua.slice(0, 512);
  return payload;
}

export function networkPayloadFromPrefs(prefs: SessionEmulationPrefs): NetworkPresetPayload {
  return {
    downloadKbps: prefs.downloadKbps,
    uploadKbps: prefs.uploadKbps,
    latencyMs: prefs.latencyMs,
    offline: prefs.networkPreset === "offline",
  };
}

export function setupPayloadFromPrefs(prefs: SessionEmulationPrefs): SetupPresetPayload {
  return {
    device: devicePayloadFromPrefs(prefs),
    network: networkPayloadFromPrefs(prefs),
  };
}

/** Apply a saved preset onto prefs. Always resolves to fields the existing POST body builder understands. */
export function applyUserPreset(
  prefs: SessionEmulationPrefs,
  preset: UserRecordingPreset,
): SessionEmulationPrefs {
  if (preset.kind === "device") {
    const d = preset.payload as DevicePresetPayload;
    return normalizePrefs({
      ...prefs,
      devicePreset: "custom",
      width: d.width,
      height: d.height,
      orientation: d.orientation,
      deviceScaleFactor: d.deviceScaleFactor ?? 1,
    });
  }
  if (preset.kind === "network") {
    const n = preset.payload as NetworkPresetPayload;
    return normalizePrefs({
      ...prefs,
      networkPreset: n.offline ? "offline" : "custom",
      downloadKbps: n.downloadKbps,
      uploadKbps: n.uploadKbps,
      latencyMs: n.latencyMs,
    });
  }
  const s = preset.payload as SetupPresetPayload;
  return normalizePrefs({
    ...prefs,
    devicePreset: "custom",
    width: s.device.width,
    height: s.device.height,
    orientation: s.device.orientation,
    deviceScaleFactor: s.device.deviceScaleFactor ?? 1,
    networkPreset: s.network.offline ? "offline" : "custom",
    downloadKbps: s.network.downloadKbps,
    uploadKbps: s.network.uploadKbps,
    latencyMs: s.network.latencyMs,
  });
}

/** Reset target: setup default → device+network defaults → system. */
export function resolveResetPrefs(presets: UserRecordingPreset[]): SessionEmulationPrefs {
  const setup = presets.find((p) => p.kind === "setup" && p.isDefault);
  if (setup) return applyUserPreset(DEFAULT_EMULATION_PREFS, setup);
  let base = { ...DEFAULT_EMULATION_PREFS };
  const device = presets.find((p) => p.kind === "device" && p.isDefault);
  const network = presets.find((p) => p.kind === "network" && p.isDefault);
  if (device) base = applyUserPreset(base, device);
  if (network) base = applyUserPreset(base, network);
  return normalizePrefs(base);
}

export function nameTaken(presets: UserRecordingPreset[], kind: PresetKind, name: string, exceptId?: string): boolean {
  const needle = name.trim().toLowerCase();
  return presets.some(
    (p) => p.kind === kind && p.id !== exceptId && p.name.trim().toLowerCase() === needle,
  );
}

export const PRESET_SAVE_SOFT_FAIL =
  "Could not save to your account. Saved on this browser and will sync later";

export function isLocalPresetId(id: string): boolean {
  return id.startsWith("local-");
}

export function makeLocalPreset(
  kind: PresetKind,
  name: string,
  payload: DevicePresetPayload | NetworkPresetPayload | SetupPresetPayload,
): UserRecordingPreset {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    name,
    payload,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}
