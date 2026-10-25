import { SECURITY_AGENT_BASE } from "@/app/config/urls";

export class SecurityAgentError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type StuffingFields = { name?: string; year?: string; company?: string; osintEmail?: string };

export type SecurityRunStep = {
  at: number;
  kind: string;
  message: string;
  attempt?: number;
  total?: number;
  /** Cleartext for authorized KT runs */
  password?: string;
  hint?: string;
  detail?: string[];
};

export type PasswordTry = {
  attempt: number;
  password: string;
  outcome: "trying" | "failed" | "success" | "blocked" | "error" | string;
  at?: number;
};

export type SecurityRun = {
  id: string;
  kind: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  createdAt: number;
  updatedAt: number;
  steps: SecurityRunStep[];
  breach: {
    available?: boolean;
    found?: boolean;
    count?: number;
    message?: string;
    reason?: string;
    breaches?: { name: string; domain?: string; breachDate?: string; dataClasses?: string[] }[];
  } | null;
  result: {
    verdict?: string;
    attempts?: number;
    reason?: string;
    summary?: string;
    matchedPassword?: string | null;
    lastPassword?: string | null;
    sameMessage?: boolean;
    notes?: string | null;
  } | null;
  error: string | null;
  /** Latest headed-browser JPEG as a data URL (polled with the run). */
  screenshot?: string | null;
  passwordsTried?: PasswordTry[];
  input?: {
    loginUrl?: string;
    identifier?: string;
    fields?: StuffingFields;
    maxAttempts?: number;
  };
};

export type EnumerationGuide = {
  id: string;
  title: string;
  plainStory: string;
  steps: { n: number; title: string; does: string }[];
  passWhen: string;
  failWhen: string;
};

async function req<T>(path: string, init?: RequestInit, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SECURITY_AGENT_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new SecurityAgentError(`Could not reach the Security Test Agent at ${SECURITY_AGENT_BASE}. Is it running?`, 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new SecurityAgentError((data as { error?: { message?: string } })?.error?.message ?? res.statusText, res.status);
  return data as T;
}

export const securityAgent = {
  startCredentialStuffing: (
    body: { loginUrl: string; identifier: string; fields?: StuffingFields; maxAttempts?: number; headed?: boolean },
    signal?: AbortSignal,
  ) =>
    req<SecurityRun>(
      "/api/checks/credential-stuffing",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    ),
  getRun: (id: string, signal?: AbortSignal) => req<SecurityRun>(`/api/checks/${id}`, undefined, signal),
  enumerationGuide: (signal?: AbortSignal) => req<EnumerationGuide>("/api/checks/username-enumeration/guide", undefined, signal),
  submitEnumeration: (
    body: { loginUrl?: string; validIdentifier?: string; invalidIdentifier?: string; sameMessage: boolean; notes?: string },
    signal?: AbortSignal,
  ) =>
    req<SecurityRun>(
      "/api/checks/username-enumeration",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    ),
  startUsernameEnumeration: (
    body: { loginUrl: string; validIdentifier: string; invalidIdentifier?: string; headed?: boolean },
    signal?: AbortSignal,
  ) =>
    req<SecurityRun>(
      "/api/checks/username-enumeration/run",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    ),
  /** Guided lab: SSRF-safe GET/POST with Bearer token against the app under test. */
  httpProbe: (
    body: { url: string; authorization: string; method?: "GET" | "POST" },
    signal?: AbortSignal,
  ) =>
    req<{ ok: boolean; status: number; statusText: string; bodyPreview: string }>(
      "/api/checks/http-probe",
      { method: "POST", body: JSON.stringify(body) },
      signal,
    ),
};
