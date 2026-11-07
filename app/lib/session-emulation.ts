/** Last device / network choices for Start Recording (shared across Run / New / Requirements record). */

export type SessionEmulationPrefs = {
  devicePreset: string;
  networkPreset: string;
  orientation: "portrait" | "landscape";
  width: number;
  height: number;
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
};

export type StartSessionOptions = {
  url: string;
  devicePreset: string;
  networkPreset: string;
  viewer?: "auto" | "vnc";
  width?: number;
  height?: number;
  orientation?: "portrait" | "landscape";
  latencyMs?: number;
  downloadKbps?: number;
  uploadKbps?: number;
  offline?: boolean;
};

const KEY = "appatlas-session-emulation";

export const DEFAULT_EMULATION_PREFS: SessionEmulationPrefs = {
  devicePreset: "desktop",
  networkPreset: "none",
  orientation: "portrait",
  width: 1280,
  height: 800,
  latencyMs: 100,
  downloadKbps: 1500,
  uploadKbps: 750,
};

export function loadEmulationPrefs(): SessionEmulationPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_EMULATION_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_EMULATION_PREFS };
    const parsed = JSON.parse(raw) as Partial<SessionEmulationPrefs>;
    return {
      ...DEFAULT_EMULATION_PREFS,
      ...parsed,
      orientation: parsed.orientation === "landscape" ? "landscape" : "portrait",
      width: clamp(parsed.width, 320, 3840, 1280),
      height: clamp(parsed.height, 480, 2160, 800),
      latencyMs: clamp(parsed.latencyMs, 0, 60000, 100),
      downloadKbps: clamp(parsed.downloadKbps, 0, 100000, 1500),
      uploadKbps: clamp(parsed.uploadKbps, 0, 100000, 750),
    };
  } catch {
    return { ...DEFAULT_EMULATION_PREFS };
  }
}

export function saveEmulationPrefs(prefs: SessionEmulationPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

/** Build POST /sessions body fields from prefs (beyond url / viewer). */
export function emulationBodyFromPrefs(prefs: SessionEmulationPrefs): Omit<StartSessionOptions, "url" | "viewer"> {
  const body: Omit<StartSessionOptions, "url" | "viewer"> = {
    devicePreset: prefs.devicePreset || "desktop",
    networkPreset: prefs.networkPreset || "none",
    orientation: prefs.orientation,
  };
  if (prefs.devicePreset === "custom") {
    body.width = prefs.width;
    body.height = prefs.height;
  }
  if (prefs.networkPreset === "custom") {
    body.latencyMs = prefs.latencyMs;
    body.downloadKbps = prefs.downloadKbps;
    body.uploadKbps = prefs.uploadKbps;
  }
  if (prefs.networkPreset === "offline") {
    body.offline = true;
  }
  return body;
}

function clamp(n: unknown, min: number, max: number, fallback: number) {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, v));
}
