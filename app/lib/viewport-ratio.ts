import { VIEWPORT, clampHeight, clampWidth, type Orientation } from "./session-emulation";

export type SizeByMode = "pixels" | "ratio" | "resolution";

export type RatioChip = {
  id: string;
  /** Landscape-named label, e.g. "16:9" */
  label: string;
  aw: number;
  ah: number;
};

export const RATIO_CHIPS: RatioChip[] = [
  { id: "16-9", label: "16:9", aw: 16, ah: 9 },
  { id: "16-10", label: "16:10", aw: 16, ah: 10 },
  { id: "4-3", label: "4:3", aw: 4, ah: 3 },
  { id: "3-2", label: "3:2", aw: 3, ah: 2 },
  { id: "21-9", label: "21:9", aw: 21, ah: 9 },
  { id: "1-1", label: "1:1", aw: 1, ah: 1 },
  { id: "9-19.5", label: "9:19.5", aw: 9, ah: 19.5 },
];

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Named ratio label, snapped within 1% to a known chip; else "about W:H" or "about N:1". */
export function ratioLabel(width: number, height: number): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const r = w / h;
  for (const chip of RATIO_CHIPS) {
    const landscape = chip.aw / chip.ah;
    const portrait = chip.ah / chip.aw;
    if (Math.abs(r - landscape) / landscape <= 0.01) return chip.label;
    if (Math.abs(r - portrait) / portrait <= 0.01) {
      // Flip label for portrait (16:9 → 9:16); keep 9:19.5 as-is when already tall.
      if (chip.ah > chip.aw) return chip.label;
      return `${chip.ah}:${chip.aw}`.replace(/\.0$/, "");
    }
  }
  const g = gcd(w, h);
  if (g > 1 && w / g < 40 && h / g < 40) return `${w / g}:${h / g}`;
  const simple = w >= h ? w / h : h / w;
  return `about ${simple.toFixed(2).replace(/\.?0+$/, "")}:1`;
}

export function orientedRatio(
  chip: RatioChip,
  orientation: Orientation,
): { aw: number; ah: number; label: string } {
  const chipIsLandscape = chip.aw >= chip.ah;
  const wantLandscape = orientation === "landscape";
  const flip = chipIsLandscape !== wantLandscape;
  const aw = flip ? chip.ah : chip.aw;
  const ah = flip ? chip.aw : chip.ah;
  const label = `${formatRatioPart(aw)}:${formatRatioPart(ah)}`;
  return { aw, ah, label };
}

function formatRatioPart(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(n).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

/**
 * Keep width, recompute height for the ratio. If height clamps, adjust width to the
 * nearest valid size that preserves the ratio as closely as possible.
 */
export function sizeFromRatio(
  width: number,
  chip: RatioChip,
  orientation: Orientation,
): { width: number; height: number; limited: boolean } {
  const { aw, ah } = orientedRatio(chip, orientation);
  let w = clampWidth(width);
  let h = Math.round((w * ah) / aw);
  let limited = false;
  if (h < VIEWPORT.heightMin || h > VIEWPORT.heightMax) {
    limited = true;
    h = clampHeight(h);
    w = Math.round((h * aw) / ah);
    w = clampWidth(w);
    h = clampHeight(Math.round((w * ah) / aw));
  }
  return { width: w, height: h, limited };
}

/** When lock is on: change one side, derive the other from the locked ratio. */
export function applyLockedDimension(
  current: { width: number; height: number },
  next: { width?: number; height?: number },
): { width: number; height: number; limited: boolean } {
  const ratio = current.height / Math.max(1, current.width);
  let limited = false;
  if (typeof next.width === "number" && next.height == null) {
    let w = clampWidth(next.width);
    let h = Math.round(w * ratio);
    if (h < VIEWPORT.heightMin || h > VIEWPORT.heightMax) {
      limited = true;
      h = clampHeight(h);
      w = clampWidth(Math.round(h / ratio));
      h = clampHeight(Math.round(w * ratio));
    } else {
      h = clampHeight(h);
    }
    return { width: w, height: h, limited };
  }
  if (typeof next.height === "number" && next.width == null) {
    let h = clampHeight(next.height);
    let w = Math.round(h / ratio);
    if (w < VIEWPORT.widthMin || w > VIEWPORT.widthMax) {
      limited = true;
      w = clampWidth(w);
      h = clampHeight(Math.round(w * ratio));
    } else {
      w = clampWidth(w);
    }
    return { width: w, height: h, limited };
  }
  return {
    width: clampWidth(next.width ?? current.width),
    height: clampHeight(next.height ?? current.height),
    limited: false,
  };
}

export const LOCK_RATIO_KEY = "appatlas-lock-ratio";

export function loadLockRatio(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(LOCK_RATIO_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveLockRatio(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCK_RATIO_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
