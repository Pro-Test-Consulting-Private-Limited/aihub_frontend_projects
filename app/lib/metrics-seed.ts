/** Deterministic demo series when live `/stats` has no points yet. */

export type MetricsPoint = { x: string; y: number };

const DAY = 86_400;
const EIGHTEEN_MONTHS = 548 * DAY;

function hash(n: number) {
  let x = (n * 2654435761) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

/**
 * Build a stable fake series for `seconds` lookback (capped at ~18 months).
 * Live API points replace this when present.
 */
export function seedSeries(seconds: number, seedKey: string, opts?: { scale?: number }): MetricsPoint[] {
  const span = Math.min(Math.max(seconds, 900), EIGHTEEN_MONTHS);
  const scale = opts?.scale ?? 1;
  const buckets =
    span <= DAY ? 24 : span <= 7 * DAY ? 42 : span <= 30 * DAY ? 60 : Math.min(90, Math.ceil(span / DAY));
  const stepMs = (span * 1000) / buckets;
  const now = Date.now();
  const base = [...seedKey].reduce((a, c) => a + c.charCodeAt(0), 0);
  const out: MetricsPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const t = now - (buckets - 1 - i) * stepMs;
    const wave = 0.55 + 0.45 * Math.sin((i / buckets) * Math.PI * 4 + base);
    const noise = 0.85 + 0.3 * hash(base * 17 + i * 31);
    const trend = 0.7 + 0.3 * (i / Math.max(1, buckets - 1));
    const y = Math.max(0, Math.round(12 * scale * wave * noise * trend));
    out.push({ x: new Date(t).toISOString(), y });
  }
  return out;
}

function seriesOrSeed(
  live: MetricsPoint[] | undefined | null,
  seconds: number,
  key: string,
  scale?: number,
): MetricsPoint[] {
  if (Array.isArray(live) && live.length > 0) return live;
  return seedSeries(seconds, key, { scale });
}

/** Fill empty business-usage payload with seeded history; keep any live series. */
export function withBusinessSeed(data: any, seconds: number) {
  const models = { ...(data?.models || {}) };
  const preferred = "ai-accelerator-protestcorp";
  const liveModel = Array.isArray(models[preferred]) ? models[preferred] : null;
  const anyModel = liveModel || Object.values(models).find((v) => Array.isArray(v) && (v as unknown[]).length);
  models[preferred] = seriesOrSeed(anyModel as MetricsPoint[] | null, seconds, "model", 1.1);

  return {
    ...data,
    total_invocations: {
      ...(data?.total_invocations || {}),
      data: seriesOrSeed(data?.total_invocations?.data, seconds, "invocations", 1.4),
    },
    models,
    tokens: {
      ...(data?.tokens || {}),
      input: seriesOrSeed(data?.tokens?.input, seconds, "tokens-in", 8),
      output: seriesOrSeed(data?.tokens?.output, seconds, "tokens-out", 5),
    },
  };
}

export function withPerformanceSeed(data: any, seconds: number) {
  return {
    ...data,
    api_latency: {
      ...(data?.api_latency || {}),
      data: seriesOrSeed(data?.api_latency?.data, seconds, "api-lat", 40),
    },
    inference_latency: {
      ...(data?.inference_latency || {}),
      data: seriesOrSeed(data?.inference_latency?.data, seconds, "inf-lat", 80),
    },
    error_rate: {
      ...(data?.error_rate || {}),
      data: seriesOrSeed(data?.error_rate?.data, seconds, "err", 0.4),
    },
    throttling: {
      ...(data?.throttling || {}),
      data: seriesOrSeed(
        data?.throttling?.data || data?.throttle_events?.data || data?.throttling_events?.data || data?.throughput?.data,
        seconds,
        "throttle",
        2,
      ),
    },
  };
}

export function withQualitySeed(data: any, seconds: number) {
  return {
    ...data,
    hallucination: {
      ...(data?.hallucination || {}),
      data: seriesOrSeed(data?.hallucination?.data, seconds, "hall", 0.08),
    },
    healing: {
      ...(data?.healing || {}),
      data: seriesOrSeed(data?.healing?.data, seconds, "heal", 0.6),
    },
    validity_rate: {
      ...(data?.validity_rate || {}),
      data: seriesOrSeed(data?.validity_rate?.data, seconds, "valid", 0.95),
    },
  };
}
