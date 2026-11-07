import { VIEWPORT, clampHeight, clampWidth, type Orientation } from "./session-emulation";
import { ratioLabel } from "./viewport-ratio";

export type ResolutionPreset = {
  id: string;
  /** Short chip label */
  label: string;
  /** Longer name for recent/my presets */
  name: string;
  width: number;
  height: number;
};

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: "480p", label: "480p", name: "480p", width: 854, height: 480 },
  { id: "720p", label: "720p HD", name: "720p HD", width: 1280, height: 720 },
  { id: "900p", label: "900p", name: "900p", width: 1600, height: 900 },
  { id: "1080p", label: "1080p Full HD", name: "1080p Full HD", width: 1920, height: 1080 },
  { id: "1440p", label: "1440p QHD", name: "1440p QHD", width: 2560, height: 1440 },
  { id: "4k", label: "4K UHD", name: "4K UHD", width: 3840, height: 2160 },
];

/** Remote display cap used for the "Emulated, stream scaled" badge (matches backend default). */
export const REMOTE_DISPLAY_MAX = { width: 3840, height: 2160 } as const;
export const BROWSER_CHROME_ESTIMATE = 88;

/** True when viewport + chrome cannot fit the remote display without stream capping. */
export function needsStreamEmulation(width: number, height: number, chrome = BROWSER_CHROME_ESTIMATE): boolean {
  const outerH = Math.round(height) + chrome;
  const outerW = Math.round(width);
  return outerW > REMOTE_DISPLAY_MAX.width || outerH > REMOTE_DISPLAY_MAX.height;
}

export function sizeFromResolution(
  preset: ResolutionPreset,
  orientation: Orientation,
): { width: number; height: number } {
  let w = preset.width;
  let h = preset.height;
  if (orientation === "portrait" && w > h) [w, h] = [h, w];
  if (orientation === "landscape" && h > w) [w, h] = [h, w];
  return { width: clampWidth(w), height: clampHeight(h) };
}

export function clampScreenSize(width: number, height: number): { width: number; height: number } {
  return { width: clampWidth(width), height: clampHeight(height) };
}

/** Match W×H (either orientation) to a resolution preset name, else null. */
export function resolutionNameForSize(width: number, height: number): string | null {
  const a = Math.min(width, height);
  const b = Math.max(width, height);
  for (const p of RESOLUTION_PRESETS) {
    const pa = Math.min(p.width, p.height);
    const pb = Math.max(p.width, p.height);
    if (a === pa && b === pb) return p.name;
  }
  return null;
}

/** Friendly label for recent / My presets chips. */
export function sizeDisplayLabel(width: number, height: number): string {
  const res = resolutionNameForSize(width, height);
  if (res) return res;
  // Prefer snapped named ratios (16:10) over reduced gcd (8:5).
  const label = ratioLabel(width, height);
  if (!label.startsWith("about ")) return label;
  return `${width} × ${height}`;
}

export function myScreenSize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: VIEWPORT.widthDefault, height: VIEWPORT.heightDefault };
  }
  return clampScreenSize(window.screen.width, window.screen.height);
}

export function thisWindowSize(): { width: number; height: number } {
  if (typeof window === "undefined") {
    return { width: VIEWPORT.widthDefault, height: VIEWPORT.heightDefault };
  }
  return clampScreenSize(window.innerWidth, window.innerHeight);
}
