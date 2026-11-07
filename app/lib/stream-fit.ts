/**
 * Scale a stream surface into a container while preserving aspect ratio.
 * Allows limited upscaling for small viewports (phone/tablet); never above maxUpscale.
 * `inset` reserves symmetrical bezel/padding so the fitted iframe + chrome still fit.
 */
export function fitStreamScale(
  containerW: number,
  containerH: number,
  streamW: number,
  streamH: number,
  opts: { maxUpscale?: number; inset?: number } = {},
): { scale: number; width: number; height: number } {
  const maxUpscale = opts.maxUpscale ?? 1.5;
  const inset = Math.max(0, opts.inset ?? 0);
  const cw = Math.max(1, containerW - inset * 2);
  const ch = Math.max(1, containerH - inset * 2);
  const sw = Math.max(1, streamW);
  const sh = Math.max(1, streamH);
  const raw = Math.min(cw / sw, ch / sh);
  const scale = Math.min(Math.max(raw, 0), maxUpscale);
  return {
    scale,
    width: Math.round(sw * scale),
    height: Math.round(sh * scale),
  };
}

/** Phone bezel: border-[3px] + p-1.5 (6px) on each side. */
export const MOBILE_BEZEL_INSET_PX = 9;
