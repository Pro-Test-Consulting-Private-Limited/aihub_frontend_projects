export interface ANALYTICS_STATS_MODAL {
  average_request_latency_seconds: number;
  average_token_count: string;
  total_requests: number;
}

export interface ANALYTICS_CHART_DATA_POINT {
  x: string | number;
  y: number;
}
