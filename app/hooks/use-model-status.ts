"use client";

import { useEffect, useState } from "react";
import { getModelStatus } from "@/app/services/analytics";
import {
  MODEL_STARTING_STATES,
  toModelState,
  type ModelState,
} from "@/app/constants/model-status";

/** Polls the HF endpoint state (never wakes the model). Faster while it is starting. */
export function useModelStatus() {
  const [modelState, setModelState] = useState<ModelState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      let next: ModelState = "unknown";

      try {
        next = toModelState((await getModelStatus())?.state);
      } catch {
        next = "unknown";
      }

      if (cancelled) return;

      setModelState(next);
      timer = setTimeout(
        poll,
        MODEL_STARTING_STATES.includes(next) ? 10_000 : 30_000,
      );
    };

    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return modelState;
}
