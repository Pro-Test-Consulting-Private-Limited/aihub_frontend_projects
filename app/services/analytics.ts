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



