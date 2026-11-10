"use client";

import type { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { getFreshIdToken, getGraphAccessToken } from "@/app/lib/auth-client";
import { siteOrigin } from "@/app/config/urls";
import type {
  AtlasConfig,
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
import type { StartSessionOptions } from "@/app/lib/session-emulation";
import type {
  DevicePresetPayload,
  NetworkPresetPayload,
  PresetKind,
  SetupPresetPayload,
  UserRecordingPreset,
} from "@/app/lib/user-recording-presets";
import { isLocalAuthBypassEnabled } from "@/app/lib/auth-bypass";

type PresetPayload = DevicePresetPayload | NetworkPresetPayload | SetupPresetPayload;

const BUILD_APPATLAS_API = (
  process.env.NEXT_PUBLIC_APPATLAS_API || "https://ai-hub.protestcorp.com/atlas-api"
).replace(/\/$/, "");
const PROD_APPATLAS_API = "https://ai-hub.protestcorp.com/atlas-api";

/** When local auth bypass is on, route through /api/dev-atlas (server injects X-Proxy-Auth). */
export function atlasApiBase(): string {
  if (typeof window !== "undefined" && isLocalAuthBypassEnabled()) return "/api/dev-atlas";
  return siteOrigin() ? `${siteOrigin()}/atlas-api` : BUILD_APPATLAS_API;
}

/** Lazy base URL (re-evaluates bypass on each access). */
export const APPATLAS_API = {
  toString() {
    return atlasApiBase();
  },
  valueOf() {
    return atlasApiBase();
  },
  [Symbol.toPrimitive]() {
    return atlasApiBase();
  },
} as unknown as string;

export class AtlasError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Msal = { instance: IPublicClientApplication; accounts: AccountInfo[] };

export function atlasClient({ instance, accounts }: Msal) {
  /** `base` "" targets this app's own /api routes (Jira, which needs the server-side cookies). */
  const request = async <T>(path: string, init: RequestInit = {}, retried = false, base?: string): Promise<T> => {
    const api = base ?? atlasApiBase();
    const bypass = isLocalAuthBypassEnabled();
    const token = bypass ? null : await getFreshIdToken(instance, accounts, retried);
    const res = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.status === 401 && !retried && !bypass) return request<T>(path, init, true, api);
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
    getConfig: (projectId?: string) =>
      request<AtlasConfig>(projectId ? `/config?projectId=${encodeURIComponent(projectId)}` : "/config"),
    getProjectFeatures: (projectId: string) =>
      request<{
        projectId: string;
        features: {
          persona: boolean;
          replay: boolean;
          health: boolean;
          simulate?: boolean;
          jiraBug?: boolean;
          savedLogins?: boolean;
        };
        environment?: string;
        defaults: {
          persona: boolean;
          replay: boolean;
          health: boolean;
          simulate?: boolean;
          jiraBug?: boolean;
          savedLogins?: boolean;
        };
      }>(`/project-features/${encodeURIComponent(projectId)}`),
    setProjectFeatures: (
      projectId: string,
      body: Partial<{
        persona: boolean;
        replay: boolean;
        health: boolean;
        simulate: boolean;
        jiraBug: boolean;
        savedLogins: boolean;
        environment: string;
      }>,
    ) =>
      request<{
        projectId: string;
        features: {
          persona: boolean;
          replay: boolean;
          health: boolean;
          simulate: boolean;
          jiraBug: boolean;
          savedLogins: boolean;
        };
        environment: string;
      }>(`/project-features/${encodeURIComponent(projectId)}`, json("PUT", body)),
    armSimulate: (sessionId: string, body: { method: string; path: string; mode: string }) =>
      request<import("@/app/interfaces/appatlas").SessionSnapshot>(
        `/sessions/${sessionId}/simulate/arm`,
        json("POST", body),
      ),
    disarmSimulate: (sessionId: string) =>
      request<import("@/app/interfaces/appatlas").SessionSnapshot>(
        `/sessions/${sessionId}/simulate/disarm`,
        json("POST", {}),
      ),
    listSavedLogins: () =>
      request<{ items: Array<{ id: string; roleLabel: string; origin: string; expiresInLabel: string }> }>(
        "/saved-logins",
      ).then((r) => r.items),
    getSavedLogin: (id: string) =>
      request<{ id: string; roleLabel: string; origin: string; expiresInLabel: string }>(`/saved-logins/${id}`),
    deleteSavedLogin: (id: string) => request<void>(`/saved-logins/${id}`, json("DELETE")),
    saveSessionLogin: (
      sessionId: string,
      body: { roleLabel?: string; confirmUnauthenticated?: boolean } = {},
    ) =>
      request<{ id: string; roleLabel: string; origin: string; expiresInLabel: string }>(
        `/sessions/${sessionId}/saved-login`,
        json("POST", body),
      ),
    previewBug: (body: Record<string, unknown>) => request<Record<string, unknown>>("/bugs/preview", json("POST", body)),
    similarBugs: (body: Record<string, unknown>) =>
      request<{ similar: Array<{ key: string; summary: string }>; jql: string }>("/bugs/similar", json("POST", body)),
    createBug: (body: Record<string, unknown>) =>
      request<{ key?: string; error?: string; livePath?: string; liveTested?: boolean }>("/bugs", json("POST", body)),
    listRecordingPresets: () =>
      request<{ items: UserRecordingPreset[] }>("/recording-presets").then((r) => r.items),
    createRecordingPreset: (body: { kind: PresetKind; name: string; payload: PresetPayload }) =>
      request<UserRecordingPreset>("/recording-presets", json("POST", body)),
    updateRecordingPreset: (id: string, body: { name?: string; payload?: PresetPayload }) =>
      request<UserRecordingPreset>(`/recording-presets/${id}`, json("PATCH", body)),
    deleteRecordingPreset: (id: string) => request<void>(`/recording-presets/${id}`, json("DELETE")),
    setRecordingPresetDefault: (id: string) =>
      request<UserRecordingPreset>(`/recording-presets/${id}/default`, json("POST")),
    /** Live Start-recording preview JPEG (project URL resolved server-side; never pass a client URL). */
    previewScreenshot: async (body: {
      projectId: string;
      width: number;
      height: number;
      orientation: string;
      network?: string;
      devicePreset?: string;
      colorScheme?: string;
      locale?: string;
    }) => {
      const bypass = isLocalAuthBypassEnabled();
      const token = bypass ? null : await getFreshIdToken(instance, accounts);
      const res = await fetch(`${atlasApiBase()}/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new AtlasError((err as { error?: string }).error ?? res.statusText, res.status);
      }
      return res.blob();
    },
    startSession: (body: StartSessionOptions) => request<SessionSnapshot>("/sessions", json("POST", body)),
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
      const bypass = isLocalAuthBypassEnabled();
      const token = bypass ? "bypass" : await getFreshIdToken(instance, accounts);
      return new EventSource(
        `${atlasApiBase()}/sessions/${id}/events?access_token=${encodeURIComponent(token ?? "")}`,
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
    listJoinedTeams: async () => {
      const graph = await getGraphAccessToken(instance, accounts);
      return request<{ items: Array<{ id: string; displayName: string }> }>("/teams", {
        headers: { "X-Graph-Access-Token": graph },
      });
    },
    listTeamChannels: async (teamId: string) => {
      const graph = await getGraphAccessToken(instance, accounts);
      return request<{ items: Array<{ id: string; displayName: string }> }>(
        `/teams/${encodeURIComponent(teamId)}/channels`,
        { headers: { "X-Graph-Access-Token": graph } },
      );
    },
    listCanvasTeamMembers: async (canvasId: string) => {
      const graph = await getGraphAccessToken(instance, accounts);
      return request<{ items: Array<{ id: string; displayName: string; email: string | null }> }>(
        `/canvases/${canvasId}/teams/members`,
        { headers: { "X-Graph-Access-Token": graph } },
      );
    },
    /** Posts with Graph access token (ChannelMessage.Send); AppAtlas still uses the ID token. */
    sendTeamsMessage: async (
      canvasId: string,
      body: {
        text: string;
        subject?: string;
        replyToId?: string;
        issueKey?: string;
        mentions?: Array<{ id: string; displayName: string }>;
      },
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
  const api = atlasApiBase();
  if (!/^https?:/.test(url)) return `${api}${url}`;
  for (const base of [PROD_APPATLAS_API, BUILD_APPATLAS_API, "https://ai-hub-dev.protestcorp.com/atlas-api"]) {
    if (url.startsWith(`${base}/`)) return `${api}${url.slice(base.length)}`;
  }
  return url;
};
