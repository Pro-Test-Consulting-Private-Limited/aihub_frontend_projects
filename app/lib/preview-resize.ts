import { clampHeight, clampWidth, snapWidth } from "./session-emulation";

export type ResizeEdge = "corner" | "right" | "bottom";

/**
 * Convert a screen-space pointer delta into viewport CSS pixels, given the
 * preview scale (frameCssPx / viewportPx). Fixed during a drag so the frame
 * visibly grows even when the layout would otherwise re-fit.
 */
export function screenDeltaToViewportPx(deltaScreen: number, scale: number): number {
  const s = scale > 0.0001 ? scale : 1;
  return deltaScreen / s;
}

export function applyResizeDelta(opts: {
  startW: number;
  startH: number;
  dxScreen: number;
  dyScreen: number;
  scale: number;
  edge: ResizeEdge;
  shift: boolean;
  keepAspect: boolean;
}): { width: number; height: number } {
  const dx = screenDeltaToViewportPx(opts.dxScreen, opts.scale);
  const dy = screenDeltaToViewportPx(opts.dyScreen, opts.scale);
  let width = opts.startW;
  let height = opts.startH;
  const ratio = opts.startH / Math.max(opts.startW, 1);

  if (opts.edge === "right") {
    width = opts.startW + dx;
    if (opts.keepAspect) height = width * ratio;
  } else if (opts.edge === "bottom") {
    height = opts.startH + dy;
    if (opts.keepAspect) width = height / ratio;
  } else {
    // corner: primary axis is X; keep aspect when keepAspect (lock or default corner)
    if (opts.shift || !opts.keepAspect) {
      width = opts.startW + dx;
      height = opts.startH + dy;
    } else {
      width = opts.startW + dx;
      height = width * ratio;
    }
  }

  if (!opts.shift) width = snapWidth(width);
  width = clampWidth(width);
  height = clampHeight(Math.round(height));
  return { width, height };
}

/** Fit a viewport into a box; returns the uniform scale used. */
export function fitScale(
  viewportW: number,
  viewportH: number,
  boxW: number,
  boxH: number,
): { scale: number; frameW: number; frameH: number } {
  const vw = Math.max(1, viewportW);
  const vh = Math.max(1, viewportH);
  const scale = Math.min(boxW / vw, boxH / vh);
  return { scale, frameW: vw * scale, frameH: vh * scale };
}
