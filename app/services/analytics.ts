import request from "@/xhr";
import { BASE_URL, CLARIFY_API_BASE } from "../config/urls";

export const getBusinessMetrics = async (seconds: number) =>
  request({
    method: "get",
    url: BASE_URL + `stats?back=${seconds}`,
  });

export const getPerformanceMetrics = async (seconds: number) =>
  request({
    method: "get",
    url: BASE_URL + `stats/performance?back=${seconds}`,
  });

export const getQualityMetrics = async (seconds: number) =>
  request({
    method: "get",
    url: BASE_URL + `stats/quality?back=${seconds}`,
  });

export const getServerStatus = async () =>
  request({
    method: "get",
    url: BASE_URL + "health",
    skipAuth: true,
  });

/** Hugging Face endpoint state, read without sending a request to the model. */
export const getModelStatus = async (): Promise<{ state: string }> => {
  const res = await fetch(`${CLARIFY_API_BASE}/api/v1/clarify/model-status`, {
    cache: "no-store",
  });
  return res.json();
};

export type ModelUsage = {
  state: string;
  instanceType: string | null;
  pricePerHourUsd: number | null;
  computeMinutes: number;
  costUsd: number;
};

/** HF billing for the model endpoint: "current" or "last" calendar month. */
export const getModelUsage = async (
  period: "current" | "last",
): Promise<ModelUsage> => {
  const res = await fetch(
    `${CLARIFY_API_BASE}/api/v1/clarify/model-usage?period=${period}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`model-usage ${res.status}`);
  return res.json();
};



