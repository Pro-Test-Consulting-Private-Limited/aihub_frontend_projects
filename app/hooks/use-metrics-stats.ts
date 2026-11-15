"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { METRICS_POLL_MS, MetricsTimeFilters } from "@/app/constants/metrics";
import { useMetricsFilter } from "@/app/context/metrics-filter-context";
import { getCustomFilterSeconds } from "@/app/interfaces/metrics-time-filter";

type Fetcher = (seconds: number) => Promise<{ data: unknown }>;

/**
 * Shared Metrics fetch: loading/error states + light polling while the tab is visible.
 */
export function useMetricsStats(fetcher: Fetcher, pollMs = METRICS_POLL_MS) {
  const { selectedFilter, appliedCustomFilter } = useMetricsFilter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const secondsForFilter = useCallback(() => {
    if (selectedFilter === "custom") return getCustomFilterSeconds(appliedCustomFilter);
    return MetricsTimeFilters.find((f) => f.value === selectedFilter)?.seconds || 10800;
  }, [selectedFilter, appliedCustomFilter]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetcherRef.current(secondsForFilter());
        setData(res?.data ?? null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load metrics");
        if (!opts?.silent) setData(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [secondsForFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!pollMs || pollMs < 5_000) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load({ silent: true });
      }, pollMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
        start();
      } else stop();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, pollMs]);

  return { data, loading, error, reload: () => void load() };
}

/** Prefer a known model key; otherwise first series in `models`. */
export function pickModelSeries(models: Record<string, unknown> | null | undefined): unknown[] {
  if (!models || typeof models !== "object") return [];
  const preferred = "ai-accelerator-protestcorp";
  if (Array.isArray(models[preferred])) return models[preferred] as unknown[];
  const first = Object.values(models).find((v) => Array.isArray(v));
  return (first as unknown[]) || [];
}
