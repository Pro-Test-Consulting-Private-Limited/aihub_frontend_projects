"use client";

import { useEffect, useRef, useState } from "react";
import { getModelStatus } from "@/app/services/analytics";
import {
  mapModelStatus,
  type MappedModelStatus,
} from "@/app/lib/map-model-status";
import { RAW_WARMING_NORMALIZED, normalizeModelRaw } from "@/app/lib/map-model-status";

/** Polls the HF endpoint state via the same clarify path as Home (never wakes the model). */
export function useModelStatus(opts?: { notConfigured?: boolean }) {
  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const notConfigured = Boolean(opts?.notConfigured);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      let nextRaw: string | null = null;
      let nextError = false;

      try {
        const res = await getModelStatus();
        nextRaw = typeof res?.state === "string" ? res.state : null;
      } catch {
        nextError = true;
        nextRaw = null;
      }

      if (cancelled) return;

      setRaw(nextRaw);
      setError(nextError);
      setLoading(false);

      const norm = normalizeModelRaw(nextRaw);
      const warming = (RAW_WARMING_NORMALIZED as readonly string[]).includes(norm);
      timer = setTimeout(poll, warming ? 10_000 : 30_000);
    };

    startedAt.current = Date.now();
    setLoading(true);
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Atlas "unconfigured" only wins when the shared Home/clarify source has no usable state.
  const mapped: MappedModelStatus = mapModelStatus({
    raw,
    loading,
    error,
    notConfigured: notConfigured && (error || (!loading && !raw)),
    checkingStartedAt: startedAt.current,
  });

  return { raw, loading, error, mapped };
}
