import request from "@/xhr";
import { BASE_URL } from "../config/urls";

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

const CLARIFY_API_BASE =
  process.env.NEXT_PUBLIC_CLARIFY_API_BASE_URL || "http://localhost:4000";

/** Hugging Face endpoint state, read without sending a request to the model. */
export const getModelStatus = async (): Promise<{ state: string }> => {
  const res = await fetch(`${CLARIFY_API_BASE}/api/v1/clarify/model-status`, {
    cache: "no-store",
  });
  return res.json();
};



