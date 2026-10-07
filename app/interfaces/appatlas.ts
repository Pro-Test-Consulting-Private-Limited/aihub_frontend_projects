/** AppAtlas API contract, copied from appatlas-backend backend/src/types.ts. Keep in sync. */

export type ElementChip = {
  id: string;
  kind: "input" | "button" | "link" | "select" | "other";
  label: string;
  value?: string;
};

export type NavType = "button" | "link" | "form" | "key" | "in-page" | "other";

export type ScreenStateKind = "initial" | "loading" | "loaded" | "interaction" | "error";

export type ScreenState = {
  id: string;
  label: string;
  /** Relative URL of the JPEG, e.g. /sessions/abc/shots/xyz.jpg */
  shotUrl: string;
  elements: ElementChip[];
  /** Visible page text (collapsed, truncated), used for Jira matching. */
  text?: string;
  kind: ScreenStateKind;
  createdAt: number;
};

export type ArrivalInfo = {
  summary: string;
  elementLabel: string;
  elementKind: "button" | "link" | "input" | "select" | "key" | "other";
  navType: NavType;
  fromPath: string;
  fromTitle?: string;
  action: string;
};

export type ScreenNode = {
  id: string;
  title: string;
  url: string;
  path: string;
  shotUrl: string;
  elements: ElementChip[];
  states: ScreenState[];
  status: "active" | "visited" | "error";
  createdAt: number;
  arrivedVia?: ArrivalInfo;
};

export type ActionEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "click" | "fill" | "navigate" | "submit" | "key";
  navType: NavType;
  elementLabel: string;
  elementKind: ArrivalInfo["elementKind"];
  sourcePath: string;
  actionSummary: string;
};

export type SessionStatus = "starting" | "recording" | "finishing" | "finished" | "error" | "expired";

/**
 * How the user sees and controls the remote browser.
 * - neko:  WebRTC video (smoothest). Embed `url` in an <iframe allow="autoplay; clipboard-read; clipboard-write; fullscreen">
 * - vnc:   noVNC (lighter). Embed `url` in an <iframe allow="clipboard-read; clipboard-write; fullscreen">
 * - local: dev mode, a real Chromium window opened on the backend machine
 */
export type Viewer = { kind: "neko"; url: string } | { kind: "vnc"; url: string } | { kind: "local" };

export type EmulationSummary = {
  devicePreset: string;
  viewport: { width: number; height: number };
  networkPreset: string;
  isMobile: boolean;
  locale?: string;
  timezoneId?: string;
  colorScheme?: string;
  orientation?: string;
  offline: boolean;
  cpuThrottlingRate?: number;
};

export type SessionSnapshot = {
  id: string;
  startUrl: string;
  status: SessionStatus;
  error?: string;
  viewer: Viewer | null;
  currentUrl?: string;
  currentTitle?: string;
  nodes: ScreenNode[];
  edges: ActionEdge[];
  /** Increments on every change; ignore snapshots older than the one you have. */
  revision: number;
  eventCount: number;
  createdAt: number;
  /** Epoch ms after which the backend will close the browser automatically. */
  expiresAt: number;
  /** Who started the recording (from Microsoft Entra, or nginx basic auth when login is off). */
  owner?: { name: string; email: string };
  emulation: EmulationSummary;
};

export type Capacity = {
  active: number;
  max: number;
  /** Viewer the next session would get, or null when full. */
  next: Viewer["kind"] | null;
  /** When full: seconds until the soonest live session hits its time limit. */
  retryAfterSec?: number;
};

/** Page object colours in the canvas: input = blue, button = green, link = orange. */
export type PageObjectType = ElementChip["kind"];

export type CanvasPageObject = { type: PageObjectType; label: string; value?: string };

export type CanvasState = {
  id: string;
  label: string;
  kind: ScreenStateKind;
  screenshotUrl: string;
  pageObjectCount: number;
};

export type CanvasNode = {
  id: string;
  title: string;
  /** e.g. "/login" */
  path: string;
  url: string;
  /** The screen as it looks once loading has finished (first state after any loading/blank state). */
  screenshotUrl: string;
  stateCount: number;
  states: CanvasState[];
  pageObjectCount: number;
  pageObjectCounts: Record<PageObjectType, number>;
  /** Unique across all states of the page. */
  pageObjects: CanvasPageObject[];
  arrivedVia?: { summary: string; elementLabel: string; navType: NavType; fromPath: string };
};

export type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  navType: NavType;
  /** dotted = navigated through a link, solid = button / form / anything else. */
  lineStyle: "dotted" | "solid";
  elementLabel: string;
  elementKind: ArrivalInfo["elementKind"];
  action: string;
};

export type CanvasTestData = { nodeId: string; path: string; field: string; value: string };

export type CanvasSummary = {
  id: string;
  name: string;
  description: string;
  /** The tester who recorded and saved it. */
  owner: { id: string; name: string; email: string };
  /** True when the caller may rename/delete it. */
  isMine: boolean;
  startUrl: string;
  host: string;
  screens: number;
  /** Arrows on the canvas (screen-to-screen navigations). */
  transitions: number;
  /** Every recorded interaction (clicks, fills, submits, key presses). */
  events: number;
  states: number;
  pageObjects: number;
  thumbnailUrl: string | null;
  jiraProjectKey: string | null;
  createdAt: number;
  updatedAt: number;
};

export type Canvas = CanvasSummary & {
  sessionId: string | null;
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  testData: CanvasTestData[];
  jira: JiraMapping | null;
  /** One entry per Jira ticket mapped to a screen; filled in the background after connecting Jira. */
  clarifications?: CanvasClarification[];
};

export type ClarificationQuestion = {
  id: string;
  /** Risk area, e.g. "Business Rules and Validations", "Error Handling". */
  category: string;
  /** "Critical" | "Important" | "Optional" */
  priority: string;
  question: string;
  reason: string;
  confidence: number | null;
};

/** Requirement clarification questions for one Jira ticket mapped to canvas screens. */
export type CanvasClarification = {
  issueKey: string;
  summary: string;
  nodeIds: string[];
  status: "queued" | "running" | "ready" | "failed";
  note: string | null;
  error: string | null;
  questions: ClarificationQuestion[];
  confidence: number | null;
  model: string | null;
  attempts: number;
  generatedAt: number | null;
  updatedAt: number;
};

export type CanvasClarifications = { canvasId: string; pending: number; items: CanvasClarification[] };

export type JiraStatus = { connected: boolean; baseUrl?: string; email?: string; user?: string };

export type JiraProject = { key: string; name: string };

export type JiraIssue = {
  priority?: string;
  assignee?: string;
  key: string;
  summary: string;
  /** Jira issue type name: Epic, Story, Task, Bug, Sub-task, ... */
  type: string;
  /** 1 = epic, 0 = story/task/bug, -1 = sub-task */
  level: number;
  parentKey?: string;
  status: string;
  /** "new" | "indeterminate" | "done" */
  statusCategory: string;
  labels: string[];
  url: string;
  acceptanceCriteria: string[];
  description: string;
};

export type CriterionCheck = { text: string; observed: boolean; via?: string };

export type JiraNodeMatch = {
  key: string;
  /** 0..1 fused score. */
  confidence: number;
  level: "high" | "possible";
  /** Per-signal scores, each 0..1, so the UI can show why. */
  signals: { keyword: number; semantic: number | null; structure: number; flow: number };
  evidence: string[];
  criteria: CriterionCheck[];
};

export type JiraMapping = {
  projectKey: string;
  baseUrl: string;
  createdAt: number;
  durationMs: number;
  /** Which matchers contributed, e.g. ["bm25", "embedding:Xenova/bge-small-en-v1.5", "structure", "flow"] */
  matchers: string[];
  issues: JiraIssue[];
  /** nodeId -> best matching tickets (sorted, at most 3). */
  nodes: Record<string, JiraNodeMatch[]>;
  /** issueKey -> nodeIds whose best/possible matches include it. Epics roll up from their children. */
  coverage: Record<string, string[]>;
};

export type Preset = { id: string; label: string };

export type AtlasConfig = {
  provider: string;
  capacity: Capacity;
  presets: { devices: Preset[]; networks: Preset[] };
};
