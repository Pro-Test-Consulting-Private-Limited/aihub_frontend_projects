import { API_AGENT_BASE } from "@/app/config/urls";
import type { EndpointsResponse, LintReport } from "@/app/interfaces/api-testing";

export class ApiAgentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/**
 * Calls the API Test Scenario Agent. This is a separate service from AI Hub / App Atlas: its base URL comes from
 * NEXT_PUBLIC_API_AGENT_BASE_URL (local by default) and is never replaced by the site origin.
 */
async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_AGENT_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiAgentError(`Could not reach the API Test Scenario Agent at ${API_AGENT_BASE}. Is it running?`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiAgentError(data?.error?.message ?? res.statusText, res.status);
  return data as T;
}

export const apiAgent = {
  endpoints: (swaggerUrl: string, signal?: AbortSignal) => post<EndpointsResponse>("/api/endpoints", { swaggerUrl }, signal),
  lint: (swaggerUrl: string, signal?: AbortSignal) => post<LintReport>("/api/specs/lint", { swaggerUrl }, signal),
};
