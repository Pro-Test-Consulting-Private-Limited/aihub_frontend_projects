"use client";

import type { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { getFreshIdToken } from "@/app/lib/auth-client";
import type {
  Canvas,
  CanvasSummary,
  JiraProject,
  SessionSnapshot,
} from "@/app/interfaces/appatlas";

export const APPATLAS_API = (
  process.env.NEXT_PUBLIC_APPATLAS_API || "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");

export class AtlasError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Msal = { instance: IPublicClientApplication; accounts: AccountInfo[] };

export function atlasClient({ instance, accounts }: Msal) {
  /** `base` "" targets this app's own /api routes (Jira, which needs the server-side cookies). */
  const request = async <T>(path: string, init: RequestInit = {}, retried = false, base = APPATLAS_API): Promise<T> => {
    const token = await getFreshIdToken(instance, accounts, retried);
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401 && !retried) return request<T>(path, init, true, base);
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new AtlasError(body.error ?? res.statusText, res.status);
    return body as T;
  };

  const json = (method: string, body?: unknown): RequestInit => ({
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    startSession: (body: { url: string; devicePreset: string; networkPreset: string }) =>
      request<SessionSnapshot>("/sessions", json("POST", body)),
    getSession: (id: string) => request<SessionSnapshot>(`/sessions/${id}`),
    finishSession: (id: string) => request<SessionSnapshot>(`/sessions/${id}/finish`, json("POST")),
    discardSession: (id: string) => request<void>(`/sessions/${id}`, json("DELETE")),
    listCanvases: () => request<CanvasSummary[]>("/canvases"),
    getCanvas: (id: string) => request<Canvas>(`/canvases/${id}`),
    saveCanvas: (body: { sessionId: string; name: string; description?: string }) =>
      request<Canvas>("/canvases", json("POST", body)),
    renameCanvas: (id: string, body: { name?: string; description?: string }) =>
      request<Canvas>(`/canvases/${id}`, json("PATCH", body)),
    deleteCanvas: (id: string) => request<void>(`/canvases/${id}`, json("DELETE")),
    listJiraProjects: () =>
      request<{ projects: JiraProject[] }>("/api/app-atlas/jira/projects", {}, false, "").then((r) => r.projects),
    connectJira: (canvasId: string, projectKey: string) =>
      request<Canvas>(`/api/app-atlas/canvases/${canvasId}/jira`, json("POST", { projectKey }), false, ""),
    disconnectJira: (canvasId: string) =>
      request<Canvas>(`/api/app-atlas/canvases/${canvasId}/jira`, json("DELETE"), false, ""),
    /** EventSource can't send headers, so the token goes in the query string. */
    openEvents: async (id: string) => {
      const token = await getFreshIdToken(instance, accounts);
      return new EventSource(
        `${APPATLAS_API}/sessions/${id}/events?access_token=${encodeURIComponent(token ?? "")}`,
      );
    },
  };
}

export type AtlasClient = ReturnType<typeof atlasClient>;

/** Viewer URLs may be relative to the API. */
export const atlasUrl = (url: string) => (/^https?:/.test(url) ? url : `${APPATLAS_API}${url}`);
