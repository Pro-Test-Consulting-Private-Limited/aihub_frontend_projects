"use client";

import type { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { getFreshIdToken, getGraphAccessToken } from "@/app/lib/auth-client";
import { siteOrigin } from "@/app/config/urls";
import type {
  AtlasConfig,
  AtlasSettings,
  Canvas,
  CanvasCicd,
  CanvasClarifications,
  CanvasGithub,
  CanvasTeams,
  CicdPipeline,
  CicdRun,
  CicdSnippets,
  PipelineRun,
  PresenceUser,
  CanvasSummary,
  JiraProject,
  SessionSnapshot,
  SitEpic,
  SitJob,
  SitJobsList,
  SitModelStatus,
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
          visualDiff?: boolean;
          responsiveSheet?: boolean;
          shareExport?: boolean;
        };
        environment?: string;
        defaults: {
          persona: boolean;
          replay: boolean;
          health: boolean;
          simulate?: boolean;
          jiraBug?: boolean;
          savedLogins?: boolean;
          visualDiff?: boolean;
          responsiveSheet?: boolean;
          shareExport?: boolean;
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
        visualDiff: boolean;
        responsiveSheet: boolean;
        shareExport: boolean;
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
          visualDiff: boolean;
          responsiveSheet: boolean;
          shareExport: boolean;
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
    /** Guided Security: read URL / JWT / page text from the remote browser (same as Canvas). */
    sessionPageState: (id: string) =>
      request<{ url: string; token: string; bodyText: string }>(`/sessions/${id}/page-state`),
    /** Guided Security: navigate the remote browser while the user watches the center pane. */
    sessionGoto: (id: string, url: string) =>
      request<{ url: string; token: string; bodyText: string }>(`/sessions/${id}/goto`, json("POST", { url })),
    /** Guided Security: probe API from inside the remote browser (resolves demo hosts the laptop can’t). */
    sessionHttpProbe: (
      id: string,
      body: { url: string; method?: string; authorization?: string; jsonBody?: Record<string, unknown> },
    ) =>
      request<{ status: number; body: unknown; bodyPreview: string }>(`/sessions/${id}/http-probe`, json("POST", body)),
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

    /** SIT Testing: epics/tickets (canvas Jira). */
    listSitTickets: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{
        source: "jira" | "none";
        projectKey: string | null;
        epics: SitEpic[];
        note?: string;
        model?: SitModelStatus;
      }>(`/sit/tickets${q}`);
    },
    getSitModelStatus: () => request<SitModelStatus>("/sit/model"),
    generateSitWorkbook: (body: {
      issueKey?: string;
      issueKeys?: string[];
      canvasId?: string | null;
      useTemplate?: boolean;
    }) => request<SitWorkbook>("/sit/generate", json("POST", body)),
    enqueueSitGenerateJobs: (body: { issueKey?: string; issueKeys?: string[]; canvasId?: string | null }) =>
      request<{ batchId: string; jobs: SitJob[] }>("/sit/jobs/generate", json("POST", body)),
    enqueueSitReassessJobs: (body: { workbookId: string; issueKeys?: string[]; canvasId?: string | null }) =>
      request<{ batchId: string; jobs: SitJob[] }>("/sit/jobs/reassess", json("POST", body)),
    listSitJobs: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<SitJobsList>(`/sit/jobs${q}`);
    },
    getSitJob: (id: string) => request<SitJob>(`/sit/jobs/${id}`),
    cancelSitJob: (id: string) => request<SitJob>(`/sit/jobs/${id}/cancel`, json("POST", {})),
    dismissSitJob: (id: string) => request<{ ok: true }>(`/sit/jobs/${id}/dismiss`, json("POST", {})),
    dismissAllSitFailedJobs: (canvasId?: string | null) =>
      request<{ dismissed: number }>("/sit/jobs/dismiss-all", json("POST", canvasId ? { canvasId } : {})),
    listSitWorkbooks: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{ items: SitWorkbook[] }>(`/sit/workbooks${q}`);
    },
    getSitWorkbook: (id: string) => request<SitWorkbook>(`/sit/workbooks/${id}`),
    reassessSitWorkbook: (body: { workbookId: string; issueKeys?: string[]; canvasId?: string | null }) =>
      request<{ workbook: SitWorkbook; stats: { modelCalls: number; cases: number; model: string } }>(
        "/sit/reassess",
        json("POST", body),
      ),
    patchSitCase: (
      workbookId: string,
      rowId: string,
      body: { priority?: string; severity?: string; note?: string },
    ) => request<SitWorkbook>(`/sit/workbooks/${workbookId}/cases/${rowId}`, json("PATCH", body)),
    getSitRiskRubric: () => request<Record<string, unknown>>("/sit/risk-rubric"),
    getSitRiskEval: (workbookId: string) =>
      request<Record<string, unknown>>(`/sit/risk-eval?workbookId=${encodeURIComponent(workbookId)}`),
    sitCoverage: (canvasId?: string | null) => {
      const q = canvasId ? `?canvasId=${encodeURIComponent(canvasId)}` : "";
      return request<{
        tickets: Record<
          string,
          {
            tests: number;
            byType: Record<string, number>;
            byPriority?: Record<string, number>;
            bySeverity?: Record<string, number>;
            notAssessed?: number;
            automationYes?: number;
            workbookId: string;
            generator: string;
            updatedAt: number;
            summary?: string | null;
          }
        >;
        workbookCount?: number;
      }>(`/sit/coverage${q}`);
    },

    /** Phase C1: visual diff vs a baseline / release canvas (match by path). */
    visualDiff: (
      canvasId: string,
      body: {
        rightCanvasId: string;
        releaseLabel?: string;
        threshold?: number;
        ignoreRegions?: Array<{ x: number; y: number; width: number; height: number }>;
        nodeIds?: string[];
      },
    ) =>
      request<{
        leftCanvasId: string;
        rightCanvasId: string;
        releaseLabel: string | null;
        pairs: Array<{
          path: string;
          leftNodeId: string;
          rightNodeId: string;
          leftUrl: string;
          rightUrl: string;
          diffUrl: string;
          percentChanged: number;
          changed: boolean;
          width: number;
          height: number;
        }>;
        changedNodeIds: string[];
        summary: { compared: number; changed: number; skipped: number };
      }>(`/canvases/${canvasId}/visual-diff`, json("POST", body)),
    /** Phase C2: probe whether a Run engine exists, then build phone/tablet/laptop sheet. */
    responsiveSheetEngine: (canvasId: string) =>
      request<{
        engine: {
          actionRun: boolean;
          videoReplay: boolean;
          scriptedDrive: boolean;
          contactSheetStrategy: string;
          note: string;
        };
      }>(`/canvases/${canvasId}/responsive-sheet`),
    responsiveSheet: (canvasId: string, body: { maxScreens?: number; savedLoginId?: string } = {}) =>
      request<{
        canvasId: string;
        engine: { actionRun: boolean; note: string };
        rows: Array<{
          nodeId: string;
          path: string;
          url: string;
          frames: Array<{
            presetId: string;
            label: string;
            category: string;
            width: number;
            height: number;
            screenshotUrl: string;
            warnings: Array<{ kind: string; message: string; detail?: string }>;
          }>;
        }>;
        posterPngUrl: string | null;
        posterPdfUrl?: string | null;
        createdAt: number;
      }>(`/canvases/${canvasId}/responsive-sheet`, json("POST", body)),
    /** Phase C3: read-only share link + PDF poster. */
    createShareLink: (canvasId: string, body: { expiresInHours?: number } = {}) =>
      request<{ token: string; urlPath: string; expiresAt: number }>(
        `/canvases/${canvasId}/share`,
        json("POST", body),
      ),
    exportCanvasPoster: (canvasId: string) =>
      request<{ pdfUrl: string; bytes: number }>(`/canvases/${canvasId}/poster`, json("POST", {})),

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

    getSettings: () => request<AtlasSettings>("/settings"),

    /** Canvas GitHub trial (logs `cicdCanvasTrial`) — secondary; prefer CI/CD page. */
    connectGithub: (
      canvasId: string,
      body: { owner: string; repo: string; openapiPath?: string; smokeBaseUrl?: string },
    ) =>
      request<Canvas & { github: CanvasGithub; webhookPath: string }>(
        `/canvases/${canvasId}/github`,
        json("POST", body),
      ),
    disconnectGithub: (canvasId: string) => request<Canvas>(`/canvases/${canvasId}/github`, json("DELETE")),

    /** CI/CD page: enable trigger secret for Jenkins/Actions (uses canvas Swagger). */
    enableCicd: (canvasId: string, body: { smokeBaseUrl?: string } = {}) =>
      request<Canvas & { cicd: CanvasCicd; triggerPath: string; snippets: CicdSnippets }>(
        `/canvases/${canvasId}/cicd`,
        json("POST", body),
      ),
    disableCicd: (canvasId: string) => request<Canvas>(`/canvases/${canvasId}/cicd`, json("DELETE")),
    rotateCicdSecret: (canvasId: string) =>
      request<Canvas & { cicd: CanvasCicd; snippets: CicdSnippets }>(
        `/canvases/${canvasId}/cicd/rotate`,
        json("POST", {}),
      ),
    listCicdRuns: (canvasId: string) =>
      request<{ items: CicdRun[]; cicd: CanvasCicd | null }>(`/canvases/${canvasId}/cicd/runs`),
    getCicdRun: (canvasId: string, runId: string) => request<CicdRun>(`/canvases/${canvasId}/cicd/runs/${runId}`),
    startCicdRun: (canvasId: string, body: { ref?: string; title?: string } = {}) =>
      request<CicdRun>(`/canvases/${canvasId}/cicd/run`, json("POST", body)),

    /** Standalone pipelines (base URL + Swagger — no canvas required). */
    listCicdPipelines: () => request<{ items: CicdPipeline[] }>("/cicd/pipelines"),
    createCicdPipeline: (body: { name: string; baseUrl: string; swaggerUrl: string; mode?: "live" | "demo" }) =>
      request<{ pipeline: CicdPipeline; triggerSecret: string; snippets: CicdSnippets }>(
        "/cicd/pipelines",
        json("POST", body),
      ),
    createWalletCicdDemo: () =>
      request<{
        pipeline: CicdPipeline;
        triggerSecret: string;
        snippets: CicdSnippets;
        runs: PipelineRun[];
      }>("/cicd/pipelines/demo/wallet", json("POST", {})),
    deleteCicdPipeline: (id: string) => request<void>(`/cicd/pipelines/${id}`, json("DELETE")),
    listPipelineRuns: (id: string) => request<{ items: PipelineRun[] }>(`/cicd/pipelines/${id}/runs`),
    getPipelineRun: (pipelineId: string, runId: string) =>
      request<PipelineRun>(`/cicd/pipelines/${pipelineId}/runs/${runId}`),
    startPipelineRun: (id: string, body: { title?: string; event?: string; branch?: string } = {}) =>
      request<PipelineRun>(`/cicd/pipelines/${id}/run`, json("POST", body)),
    rotatePipelineSecret: (id: string) =>
      request<{ triggerSecret: string; snippets: CicdSnippets }>(`/cicd/pipelines/${id}/rotate`, json("POST", {})),
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
