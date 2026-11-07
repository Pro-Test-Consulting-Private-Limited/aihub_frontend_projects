/**
 * Scale a stream surface into a container while preserving aspect ratio.
 * Allows limited upscaling for small viewports (phone/tablet); never above maxUpscale.
 */
export function fitStreamScale(
  containerW: number,
  containerH: number,
  streamW: number,
  streamH: number,
  opts: { maxUpscale?: number } = {},
): { scale: number; width: number; height: number } {
  const maxUpscale = opts.maxUpscale ?? 1.5;
  const cw = Math.max(1, containerW);
  const ch = Math.max(1, containerH);
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
