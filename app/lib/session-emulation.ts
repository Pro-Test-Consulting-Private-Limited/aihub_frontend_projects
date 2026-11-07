/** Device / network prefs for Start Recording. Payload shape for POST /sessions stays the same. */

export type Orientation = "portrait" | "landscape";

export type SessionEmulationPrefs = {
  devicePreset: string;
  networkPreset: string;
  orientation: Orientation;
  width: number;
  height: number;
  latencyMs: number;
  downloadKbps: number;
  uploadKbps: number;
  /** Custom pixel density (1 / 2 / 3). Catalog devices keep their own DPR. */
  deviceScaleFactor?: number;
};

export type StartSessionOptions = {
  url: string;
  devicePreset: string;
  networkPreset: string;
  viewer?: "auto" | "vnc";
  width?: number;
  height?: number;
  orientation?: Orientation;
  latencyMs?: number;
  downloadKbps?: number;
  uploadKbps?: number;
  offline?: boolean;
  /** Optional; custom sizes only. */
  deviceScaleFactor?: number;
  locale?: string;
  timezoneId?: string;
  colorScheme?: "light" | "dark" | "no-preference";
  reducedMotion?: "reduce" | "no-preference";
  geolocation?: { latitude: number; longitude: number } | null;
  permissions?: string[];
};

export type DeviceCategory = "phone" | "tablet" | "laptop" | "custom";

export type DeviceCatalogEntry = {
  id: string;
  label: string;
  category: DeviceCategory;
  width: number;
  height: number;
  dpr: number;
};

export type NetworkCatalogEntry = {
  id: string;
  label: string;
  /** Display rates; null = unlimited / n-a */
  downloadKbps: number | null;
  uploadKbps: number | null;
  latencyMs: number | null;
  offline?: boolean;
};

export const VIEWPORT = {
  widthMin: 320,
  widthMax: 3840,
  heightMin: 480,
  heightMax: 2160,
  widthDefault: 1280,
  heightDefault: 800,
} as const;

export const NETWORK_LIMITS = {
  latencyMax: 60000,
  kbpsMax: 100000,
} as const;

export const BREAKPOINT_CHIPS = [375, 768, 1024, 1280, 1440] as const;

/** Matches backend DEVICE_PRESETS + Playwright viewports used on the server. */
export const DEVICE_CATALOG: DeviceCatalogEntry[] = [
  { id: "iphone-14", label: "iPhone 14", category: "phone", width: 390, height: 844, dpr: 3 },
  { id: "pixel-7", label: "Pixel 7", category: "phone", width: 412, height: 915, dpr: 2.625 },
  { id: "ipad", label: "iPad Pro 11", category: "tablet", width: 834, height: 1194, dpr: 2 },
  { id: "desktop", label: "Desktop", category: "laptop", width: 1280, height: 800, dpr: 1 },
  { id: "desktop-hd", label: "Desktop HD", category: "laptop", width: 1920, height: 1080, dpr: 1 },
  { id: "custom", label: "Custom size", category: "custom", width: 1280, height: 800, dpr: 1 },
];

/** Display numbers aligned with backend NETWORK_PRESETS (kbps / ms). */
export const NETWORK_CATALOG: NetworkCatalogEntry[] = [
  { id: "none", label: "No throttling", downloadKbps: null, uploadKbps: null, latencyMs: null },
  { id: "slow-3g", label: "Slow 3G", downloadKbps: 500, uploadKbps: 500, latencyMs: 400 },
  { id: "fast-3g", label: "Fast 3G", downloadKbps: 1600, uploadKbps: 750, latencyMs: 150 },
  { id: "4g", label: "4G", downloadKbps: 4096, uploadKbps: 3072, latencyMs: 20 },
  { id: "offline", label: "Offline", downloadKbps: 0, uploadKbps: 0, latencyMs: 0, offline: true },
  { id: "custom", label: "Custom", downloadKbps: 1500, uploadKbps: 750, latencyMs: 100 },
];

export const DEFAULT_EMULATION_PREFS: SessionEmulationPrefs = {
  devicePreset: "desktop",
  networkPreset: "none",
  orientation: "landscape",
  width: 1280,
  height: 800,
  latencyMs: 100,
  downloadKbps: 1500,
  uploadKbps: 750,
};

const GLOBAL_KEY = "appatlas-session-emulation";
const RECENT_KEY = "appatlas-session-device-recent";
const CANVAS_VIEWPORT_KEY = "appatlas-canvas-last-viewport";

export function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, v));
}

export function clampWidth(n: unknown): number {
  return clampInt(n, VIEWPORT.widthMin, VIEWPORT.widthMax, VIEWPORT.widthDefault);
}

export function clampHeight(n: unknown): number {
  return clampInt(n, VIEWPORT.heightMin, VIEWPORT.heightMax, VIEWPORT.heightDefault);
}

export function orientationFromSize(width: number, height: number): Orientation {
  return height >= width ? "portrait" : "landscape";
}

/**
 * Swap W/H so the pair matches the requested orientation.
 * `mode: "custom"` uses BE custom clamps (H >= 480). `mode: "preset"` allows short side down to widthMin
 * so phone landscape (e.g. 844×390) matches what the backend does for Playwright devices.
 */
export function applyOrientation(
  width: number,
  height: number,
  orientation: Orientation,
  mode: "custom" | "preset" = "custom",
): { width: number; height: number } {
  const minH = mode === "preset" ? VIEWPORT.widthMin : VIEWPORT.heightMin;
  const w = clampInt(width, VIEWPORT.widthMin, VIEWPORT.widthMax, VIEWPORT.widthDefault);
  const h = clampInt(height, minH, VIEWPORT.heightMax, VIEWPORT.heightDefault);
  const isPortrait = h >= w;
  if (orientation === "portrait" && !isPortrait) return { width: h, height: w };
  if (orientation === "landscape" && isPortrait) return { width: h, height: w };
  return { width: w, height: h };
}

export function swapDimensions(width: number, height: number): { width: number; height: number; orientation: Orientation } {
  const next = {
    width: clampInt(height, VIEWPORT.widthMin, VIEWPORT.widthMax, VIEWPORT.widthDefault),
    height: clampInt(width, VIEWPORT.widthMin, VIEWPORT.heightMax, VIEWPORT.heightDefault),
  };
  return { ...next, orientation: orientationFromSize(next.width, next.height) };
}

export function deviceById(id: string): DeviceCatalogEntry | undefined {
  return DEVICE_CATALOG.find((d) => d.id === id);
}

export function networkById(id: string): NetworkCatalogEntry | undefined {
  return NETWORK_CATALOG.find((n) => n.id === id);
}

/** Resolve width/height/orientation (and dpr) for a device preset id. */
export function sizeForDevicePreset(
  devicePreset: string,
  orientation: Orientation,
  custom?: { width?: number; height?: number },
): { width: number; height: number; orientation: Orientation; dpr: number } {
  const entry = deviceById(devicePreset) ?? deviceById("desktop")!;
  if (entry.id === "custom") {
    const width = clampWidth(custom?.width ?? entry.width);
    const height = clampHeight(custom?.height ?? entry.height);
    const sized = applyOrientation(width, height, orientation, "custom");
    return { ...sized, orientation: orientationFromSize(sized.width, sized.height), dpr: entry.dpr };
  }
  const sized = applyOrientation(entry.width, entry.height, orientation, "preset");
  return { ...sized, orientation, dpr: entry.dpr };
}

/** Keep prefs internally consistent (no Portrait + width > height). */
export function normalizePrefs(raw: Partial<SessionEmulationPrefs>): SessionEmulationPrefs {
  const devicePreset = raw.devicePreset || DEFAULT_EMULATION_PREFS.devicePreset;
  const networkPreset = raw.networkPreset || DEFAULT_EMULATION_PREFS.networkPreset;
  const entry = deviceById(devicePreset);
  let orientation: Orientation =
    raw.orientation === "landscape" || raw.orientation === "portrait"
      ? raw.orientation
      : DEFAULT_EMULATION_PREFS.orientation;

  const sized = sizeForDevicePreset(devicePreset, orientation, {
    width: raw.width,
    height: raw.height,
  });

  // After applying orientation, force the label to match the geometry.
  const geoOrientation = orientationFromSize(sized.width, sized.height);

  const dpr =
    entry?.id === "custom"
      ? clampInt(raw.deviceScaleFactor, 1, 3, 1)
      : entry?.dpr ?? 1;

  return {
    devicePreset,
    networkPreset,
    orientation: entry?.id === "custom" ? geoOrientation : orientation,
    width: sized.width,
    height: sized.height,
    latencyMs: clampInt(raw.latencyMs, 0, NETWORK_LIMITS.latencyMax, DEFAULT_EMULATION_PREFS.latencyMs),
    downloadKbps: clampInt(raw.downloadKbps, 0, NETWORK_LIMITS.kbpsMax, DEFAULT_EMULATION_PREFS.downloadKbps),
    uploadKbps: clampInt(raw.uploadKbps, 0, NETWORK_LIMITS.kbpsMax, DEFAULT_EMULATION_PREFS.uploadKbps),
    deviceScaleFactor: entry?.id === "custom" ? dpr : undefined,
  };
}

/** Pick a catalog device: fills natural W×H and orientation from that preset. */
export function selectDevicePreset(
  prefs: SessionEmulationPrefs,
  devicePreset: string,
): SessionEmulationPrefs {
  const entry = deviceById(devicePreset) ?? deviceById("desktop")!;
  if (entry.id === "custom") {
    return setCustomSize(prefs, prefs.width, prefs.height);
  }
  const orientation = orientationFromSize(entry.width, entry.height);
  return normalizePrefs({
    ...prefs,
    devicePreset: entry.id,
    width: entry.width,
    height: entry.height,
    orientation,
  });
}

export function setCustomSize(
  prefs: SessionEmulationPrefs,
  width: number,
  height: number,
): SessionEmulationPrefs {
  const w = clampWidth(width);
  const h = clampHeight(height);
  return normalizePrefs({
    ...prefs,
    devicePreset: "custom",
    width: w,
    height: h,
    orientation: orientationFromSize(w, h),
  });
}

export function setOrientation(prefs: SessionEmulationPrefs, orientation: Orientation): SessionEmulationPrefs {
  const mode = prefs.devicePreset === "custom" ? "custom" : "preset";
  const base = deviceById(prefs.devicePreset);
  const source =
    mode === "preset" && base
      ? { width: base.width, height: base.height }
      : { width: prefs.width, height: prefs.height };
  const sized = applyOrientation(source.width, source.height, orientation, mode);
  return normalizePrefs({
    ...prefs,
    width: sized.width,
    height: sized.height,
    orientation,
  });
}

export function snapWidth(width: number, chips: readonly number[] = BREAKPOINT_CHIPS, threshold = 24): number {
  const w = clampWidth(width);
  let best = w;
  let bestDist = Infinity;
  for (const c of chips) {
    const d = Math.abs(c - w);
    if (d < bestDist && d <= threshold) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function prefsKey(projectId?: string | null): string {
  return projectId ? `${GLOBAL_KEY}:${projectId}` : GLOBAL_KEY;
}

export function loadEmulationPrefs(projectId?: string | null): SessionEmulationPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_EMULATION_PREFS };
  try {
    const raw =
      (projectId && localStorage.getItem(prefsKey(projectId))) ||
      localStorage.getItem(GLOBAL_KEY);
    if (!raw) return normalizePrefs(DEFAULT_EMULATION_PREFS);
    return normalizePrefs(JSON.parse(raw) as Partial<SessionEmulationPrefs>);
  } catch {
    return normalizePrefs(DEFAULT_EMULATION_PREFS);
  }
}

export function saveEmulationPrefs(prefs: SessionEmulationPrefs, projectId?: string | null) {
  if (typeof window === "undefined") return;
  const normalized = normalizePrefs(prefs);
  const json = JSON.stringify(normalized);
  localStorage.setItem(GLOBAL_KEY, json);
  if (projectId) localStorage.setItem(prefsKey(projectId), json);
  pushRecentDevice(normalized.devicePreset);
}

export function loadRecentDevices(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is string => typeof x === "string" && Boolean(deviceById(x))).slice(0, 3);
  } catch {
    return [];
  }
}

function pushRecentDevice(id: string) {
  if (id === "custom") return;
  const next = [id, ...loadRecentDevices().filter((x) => x !== id)].slice(0, 3);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function rememberCanvasViewport(canvasId: string | null | undefined, width: number, height: number) {
  if (typeof window === "undefined" || !canvasId) return;
  localStorage.setItem(
    `${CANVAS_VIEWPORT_KEY}:${canvasId}`,
    JSON.stringify({ width: clampWidth(width), height: clampHeight(height) }),
  );
}

export function loadCanvasViewport(canvasId: string | null | undefined): { width: number; height: number } | null {
  if (typeof window === "undefined" || !canvasId) return null;
  try {
    const raw = localStorage.getItem(`${CANVAS_VIEWPORT_KEY}:${canvasId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: number; height?: number };
    return { width: clampWidth(parsed.width), height: clampHeight(parsed.height) };
  } catch {
    return null;
  }
}

/** Build POST /sessions body fields from prefs (beyond url / viewer). Same contract as before. */
export function emulationBodyFromPrefs(
  prefs: SessionEmulationPrefs,
  personaFields?: Partial<StartSessionOptions>,
): Omit<StartSessionOptions, "url" | "viewer"> {
  const normalized = normalizePrefs(prefs);
  const body: Omit<StartSessionOptions, "url" | "viewer"> = {
    devicePreset: normalized.devicePreset || "desktop",
    networkPreset: normalized.networkPreset || "none",
    orientation: normalized.orientation,
  };
  if (normalized.devicePreset === "custom") {
    body.width = normalized.width;
    body.height = normalized.height;
    if (normalized.deviceScaleFactor && normalized.deviceScaleFactor !== 1) {
      body.deviceScaleFactor = normalized.deviceScaleFactor;
    }
  }
  if (normalized.networkPreset === "custom") {
    body.latencyMs = normalized.latencyMs;
    body.downloadKbps = normalized.downloadKbps;
    body.uploadKbps = normalized.uploadKbps;
  }
  if (normalized.networkPreset === "offline") {
    body.offline = true;
  }
  if (personaFields) {
    if (personaFields.locale) body.locale = personaFields.locale;
    if (personaFields.timezoneId) body.timezoneId = personaFields.timezoneId;
    if (personaFields.colorScheme) body.colorScheme = personaFields.colorScheme;
    if (personaFields.reducedMotion) body.reducedMotion = personaFields.reducedMotion;
    if (personaFields.geolocation !== undefined) body.geolocation = personaFields.geolocation;
    if (personaFields.permissions?.length) body.permissions = personaFields.permissions;
  }
  return body;
}

export function summaryLine(prefs: SessionEmulationPrefs): string {
  const device = deviceById(prefs.devicePreset);
  const network = networkById(prefs.networkPreset);
  const name = device?.label ?? prefs.devicePreset;
  const net = network?.label ?? prefs.networkPreset;
  return `${name} · ${prefs.width} × ${prefs.height} · ${prefs.orientation === "portrait" ? "Portrait" : "Landscape"} · ${net}`;
}
