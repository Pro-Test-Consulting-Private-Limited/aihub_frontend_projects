import { API_AGENT_BASE } from "@/app/config/urls";
import type {
  AccountSpec,
  DataRow,
  IdentityReport,
  IdentitySuggestionsResponse,
  DependenciesResponse,
  EndpointDetail,
  EndpointsResponse,
  GenerationResponse,
  LintReport,
  PrerequisiteSuggestion,
  RunRequest,
  RunResponse,
} from "@/app/interfaces/api-testing";

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
  detail: (swaggerUrl: string, path: string, method: string, signal?: AbortSignal) =>
    post<EndpointDetail>("/api/endpoints/detail", { swaggerUrl, path, method }, signal),
  /** Runs prerequisites, then the target tests, in one call. Secrets come back masked, except `session` (browser memory only). */
  executeChain: (req: RunRequest, signal?: AbortSignal) => post<RunResponse>("/api/execute-chain", req, signal),
  suggestPrerequisites: (swaggerUrl: string, path: string, method: string, signal?: AbortSignal) =>
    post<{ suggestions: PrerequisiteSuggestion[] }>("/api/prerequisites/suggest", { swaggerUrl, path, method }, signal),
  generateRows: (swaggerUrl: string, path: string, method: string, signal?: AbortSignal) =>
    post<{ rows: DataRow[] }>("/api/test-data/rows", { swaggerUrl, path, method, valid: 1, invalid: 4 }, signal),
  /** Which endpoints stand on their own and which need another call first. */
  dependencies: (swaggerUrl: string, signal?: AbortSignal) => post<DependenciesResponse>("/api/endpoints/dependencies", { swaggerUrl }, signal),
  /** Suggested accounts for a spec (customer, fresh customer, admin, verified customer, second user). Heuristics: the person edits them. */
  suggestIdentities: (swaggerUrl: string, signal?: AbortSignal) => post<IdentitySuggestionsResponse>("/api/identities/suggest", { swaggerUrl }, signal),
  /** Test login: gives every account a usable token (uses it, logs in, or registers). Tokens come back only inside `session`. */
  checkIdentities: (req: { swaggerUrl: string; baseUrl: string; identities: AccountSpec[]; session?: Record<string, string> }, signal?: AbortSignal) =>
    post<{ identities: IdentityReport[]; session: Record<string, string> }>("/api/identities/check", req, signal),
  /** The existing scenario generator. useLlm false is instant and deterministic; true asks the model (can take a while). */
  suggestScenarios: (swaggerUrl: string, path: string, method: string, useLlm: boolean, signal?: AbortSignal) =>
    post<GenerationResponse>("/api/generate-from-swagger", { swaggerUrl, path, method, useLlm }, signal),
};
