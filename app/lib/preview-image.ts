/** Near-white / blank preview frame: very bright and almost no contrast. */
export const NEAR_WHITE_MEAN_MIN = 245;
export const NEAR_WHITE_STD_MAX = 12;

export type BrightnessStats = { mean: number; std: number; samples: number };

export function isNearWhiteBrightness(
  stats: BrightnessStats,
  meanMin = NEAR_WHITE_MEAN_MIN,
  stdMax = NEAR_WHITE_STD_MAX,
): boolean {
  return stats.samples > 0 && stats.mean >= meanMin && stats.std <= stdMax;
}

/**
 * Decode an image Blob and sample luminance mean/std.
 * Used to treat a returned near-white JPEG as a preview failure.
 */
export async function measureImageBrightness(blob: Blob, maxSamples = 5000): Promise<BrightnessStats> {
  const bitmap = await createImageBitmap(blob);
  try {
    const maxW = 320;
    const scale = Math.min(1, maxW / Math.max(1, bitmap.width));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { mean: 0, std: 0, samples: 0 };
    ctx.drawImage(bitmap, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const totalPx = w * h;
    const step = Math.max(1, Math.floor(totalPx / maxSamples));
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < totalPx; i += step) {
      const o = i * 4;
      const y = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
      sum += y;
      sumSq += y * y;
      n += 1;
    }
    if (!n) return { mean: 0, std: 0, samples: 0 };
    const mean = sum / n;
    return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), samples: n };
  } finally {
    bitmap.close();
  }
}

export async function isNearWhiteImage(blob: Blob): Promise<boolean> {
  try {
    const stats = await measureImageBrightness(blob);
    return isNearWhiteBrightness(stats);
  } catch {
    return false;
  }
}
