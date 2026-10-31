"use client";

import type { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { getFreshIdToken, getGraphAccessToken } from "@/app/lib/auth-client";
import { siteOrigin } from "@/app/config/urls";
import type {
  Canvas,
  CanvasClarifications,
  CanvasTeams,
  PresenceUser,
  CanvasSummary,
  JiraProject,
  SessionSnapshot,
  SitEpic,
  SitWorkbook,
  TicketNote,
} from "@/app/interfaces/appatlas";

const BUILD_APPATLAS_API = (
  process.env.NEXT_PUBLIC_APPATLAS_API || "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");
const PROD_APPATLAS_API = "https://ai-hub.protestcorp.com/atlas-api";

export const APPATLAS_API = siteOrigin() ? `${siteOrigin()}/atlas-api` : BUILD_APPATLAS_API;

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
    startSession: (body: { url: string; devicePreset: string; networkPreset: string; viewer?: "auto" | "vnc" }) =>
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
    /** `regenerate` re-asks the clarification agent for every ticket instead of keeping unchanged ones. */
    connectJira: (canvasId: string, projectKey: string, regenerate = false) =>
      request<Canvas>(`/api/app-atlas/canvases/${canvasId}/jira`, json("POST", { projectKey, regenerate }), false, ""),
    disconnectJira: (canvasId: string) =>
      request<Canvas>(`/api/app-atlas/canvases/${canvasId}/jira`, json("DELETE"), false, ""),
    /** Heartbeat: marks the caller present in `room` and returns everyone there. */
    presence: (room: string, leaving = false) =>
      request<{ users: PresenceUser[] }>("/presence", json("POST", { room, leaving })),
    getClarifications: (canvasId: string) => request<CanvasClarifications>(`/canvases/${canvasId}/clarifications`),
    /** Owner only. No issueKey = every failed ticket; `force` regenerates a ticket that already has questions. */
    retryClarifications: (canvasId: string, body: { issueKey?: string; force?: boolean } = {}) =>
      request<CanvasClarifications>(`/canvases/${canvasId}/clarifications/retry`, json("POST", body)),
    /** Owner only; stored per canvas and ticket in App Atlas, never sent to Jira. */
    saveTicketNote: (canvasId: string, issueKey: string, text: string) =>
      request<TicketNote>(`/canvases/${canvasId}/notes/${encodeURIComponent(issueKey)}`, json("PUT", { text })),
    /** EventSource can't send headers, so the token goes in the query string. */
    openEvents: async (id: string) => {
      const token = await getFreshIdToken(instance, accounts);
      return new EventSource(
        `${APPATLAS_API}/sessions/${id}/events?access_token=${encodeURIComponent(token ?? "")}`,
      );
    },

    /** SIT Testing: epics/tickets (canvas Jira or demo catalog). */
    listSitTickets: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{
        source: "jira" | "none";
        projectKey: string | null;
        epics: SitEpic[];
        note?: string;
      }>(`/sit/tickets${q}`);
    },
    generateSitWorkbook: (body: { issueKey?: string; issueKeys?: string[]; canvasId?: string | null }) =>
      request<SitWorkbook>("/sit/generate", json("POST", body)),
    listSitWorkbooks: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{ items: SitWorkbook[] }>(`/sit/workbooks${q}`);
    },
    getSitWorkbook: (id: string) => request<SitWorkbook>(`/sit/workbooks/${id}`),
    sitCoverage: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{
        tickets: Record<
          string,
          { tests: number; byType: Record<string, number>; workbookId: string; generator: string; updatedAt: number }
        >;
      }>(`/sit/coverage${q}`);
    },

    /** Teams Phase 1: store team/channel ids on the canvas (config, not a second login). */
    connectTeams: (canvasId: string, body: { teamId: string; channelId: string; teamName?: string; channelName?: string }) =>
      request<Canvas>(`/canvases/${canvasId}/teams`, json("POST", body)),
    disconnectTeams: (canvasId: string) => request<Canvas>(`/canvases/${canvasId}/teams`, json("DELETE")),
    /** Posts with Graph access token (ChannelMessage.Send); AppAtlas still uses the ID token. */
    sendTeamsMessage: async (
      canvasId: string,
      body: { text: string; subject?: string; replyToId?: string; issueKey?: string },
    ) => {
      const graph = await getGraphAccessToken(instance, accounts);
      return request<{ graphMessageId: string; id: string }>(
        `/canvases/${canvasId}/teams/messages`,
        {
          ...json("POST", { ...body, graphAccessToken: graph }),
          headers: { "X-Graph-Access-Token": graph },
        },
      );
    },
  };
}

export type AtlasClient = ReturnType<typeof atlasClient>;

/** Viewer and screenshot URLs may be relative to the API, or absolute on the backend's public (prod) host. */
export const atlasUrl = (url: string) => {
  if (!/^https?:/.test(url)) return `${APPATLAS_API}${url}`;
  for (const base of [PROD_APPATLAS_API, BUILD_APPATLAS_API]) {
    if (url.startsWith(`${base}/`)) return `${APPATLAS_API}${url.slice(base.length)}`;
  }
  return url;
};
