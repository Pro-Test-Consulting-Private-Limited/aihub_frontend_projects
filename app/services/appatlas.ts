"use client";

import type { IPublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { getFreshIdToken, getGraphAccessToken } from "@/app/lib/auth-client";
import { siteOrigin } from "@/app/config/urls";
import type {
  AtlasSettings,
  Canvas,
  CanvasCicd,
  CanvasClarifications,
  CanvasGithub,
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
      request<{ dismissed: number }>(
        "/sit/jobs/dismiss-all",
        json("POST", canvasId ? { canvasId } : {}),
      ),
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
  if (!/^https?:/.test(url)) return `${APPATLAS_API}${url}`;
  for (const base of [PROD_APPATLAS_API, BUILD_APPATLAS_API]) {
    if (url.startsWith(`${base}/`)) return `${APPATLAS_API}${url.slice(base.length)}`;
  }
  return url;
};
