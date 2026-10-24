/** Shapes returned by the API Test Scenario Agent (see its docs/API_REFERENCE.md). Only the fields the UI reads. */

export type SpecEndpoint = {
  path: string;
  method: string;
  /** Swagger tag; "" when the operation has none. Used as the "module". */
  tag: string;
  secured?: boolean;
  summary?: string;
  responses?: string[];
};

export type EndpointsResponse = {
  source?: { title?: string; version?: string };
  serverUrl?: string | null;
  endpoints: SpecEndpoint[];
};

export type LintSeverity = "error" | "warning" | "info";

export type LintFinding = {
  ruleId: string;
  severity: LintSeverity;
  title: string;
  /** "METHOD /path" */
  endpoint: string;
  message: string;
  suggestion?: string;
};

export type LintEndpoint = { endpoint: string; score: number; grade: string; findings: number };

export type LintReport = {
  score: number;
  grade: string;
  scoring?: { passScore?: number };
  summary: { endpoints: number; errors: number; warnings: number; info: number };
  endpoints: LintEndpoint[];
  findings: LintFinding[];
};

export type ApiModule = { name: string; endpoints: number };

export type GateRow = {
  key: string;
  method: string;
  path: string;
  module: string;
  score: number;
  grade: string;
  pass: boolean;
  /** Error-level findings; they are what blocks an endpoint. */
  reasons: LintFinding[];
};

export type EndpointParam = { name: string; in: string; required: boolean; type: string; description: string; example?: unknown };

/** One endpoint in full, from POST /api/endpoints/detail. */
export type EndpointDetail = {
  method: string;
  path: string;
  fullUrl: string | null;
  tag: string;
  summary: string;
  description: string;
  deprecated: boolean;
  secured: boolean;
  headers: { name: string; value: string; required: boolean }[];
  params: EndpointParam[];
  body: { contentType: string; required: boolean; example: unknown } | null;
  responses: { code: string; description: string; contentType: string | null; example: unknown }[];
};

/* ── Endpoint tests: Contract, Data Driven, Functional (POST /api/execute-chain and friends) ── */

/** Any string inside may hold {{name}}; a value that is exactly "{{x}}" keeps x's JSON type. */
export type RequestOverrides = {
  pathParams?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  contentType?: string;
};

export type ExtractedVariable = {
  name: string;
  source: "body" | "header";
  /** JSONPath such as $.token for a body, or the header name for a header. */
  path: string;
  /** Masked everywhere in the UI. */
  secret: boolean;
};

export type PrerequisiteStep = {
  id: string;
  endpoint: { method: string; path: string };
  request: RequestOverrides;
  extract: ExtractedVariable[];
  expectStatus?: string;
  /** Reuse the extracted values for this browser session. */
  cache: boolean;
  /** Which account runs this step (an account id, or "none"). Empty = the default account. */
  as?: string;
  origin?: "suggested" | "manual";
  reason?: string;
};

export type Assertion =
  | { kind: "status"; op: "equals" | "in" | "class"; value: number | string | (number | string)[] }
  | { kind: "body"; path: string; op: "equals" | "contains" | "exists" | "notExists" | "type"; value?: unknown }
  | { kind: "header"; name: string; op: "equals" | "contains" | "exists"; value?: string }
  | { kind: "responseTime"; maxMs: number };

export type DataRowOrigin = "spec-example" | "generated-valid" | "generated-invalid" | "manual" | "import";

export type DataRow = {
  id: string;
  label?: string;
  request: RequestOverrides;
  expectedStatus: string;
  assertions: Assertion[];
  origin: DataRowOrigin;
  /** The spec sets no limit for this value: only a 5xx fails. */
  soft?: boolean;
  runAs?: string;
};

export type FunctionalScenario = {
  id: string;
  name: string;
  enabled: boolean;
  request: RequestOverrides;
  assertions: Assertion[];
  /** Still the suggested data: unique fields (email, mobile) are refreshed on every run. Cleared when the request is edited. */
  generated?: boolean;
  /** An account id, or none (no Authorization header), expired (a generated expired token), otherUser (the second account). Empty = the run's account. */
  runAs?: string;
  from?: { scenarioId: string; expectedStatusCode: string; assumed: boolean };
};

export type TestMode = "contract" | "data" | "functional";

export type RunRequest = {
  swaggerUrl: string;
  baseUrl: string;
  target: { method: string; path: string };
  mode: TestMode;
  prerequisites: PrerequisiteStep[];
  defaults?: { headers?: Record<string, string> };
  session?: Record<string, string>;
  /** Values the person defined (a token typed at connect time, a second user's token...). Usable as {{name}}. */
  variables?: Record<string, string>;
  /** Who is calling: every account the run may use. Held in browser memory only. */
  identities?: AccountSpec[];
  /** Run the target as this account. Empty = chosen from what the endpoint needs. */
  runAs?: string;
  /** Overrides the inferred requirement of the target endpoint. */
  requirement?: RequirementKind;
  refresh?: boolean;
  contract?: { expect: string; request?: RequestOverrides; runAs?: string };
  rows?: DataRow[];
  scenarios?: FunctionalScenario[];
};

export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export type CheckResult = { id: string; label: string; status: CheckStatus; expected?: string; actual?: string; path?: string };

export type ResultStatus = "passed" | "failed" | "blocked" | "skipped" | "inconclusive";

export type RunResult = {
  id: string;
  name: string;
  kind: "prerequisite" | "contract" | "data-row" | "scenario";
  status: ResultStatus;
  blockedBy?: string;
  /** Already masked by the agent. */
  request: { method: string; url: string; headers: Record<string, string>; body?: unknown } | null;
  response: { status: number; contentType?: string; headers: Record<string, string>; body: unknown } | null;
  durationMs: number;
  checks: CheckResult[];
  /** Values saved from the response. auto: saved without being configured. */
  extracted?: { name: string; masked: string; auto?: boolean }[];
  fromCache?: boolean;
  hint?: string;
  error?: string;
  /** The account this call ran as. */
  ranAs?: string;
  /** e.g. "token refreshed via POST /auth/login". */
  note?: string;
  /** Set on a result blocked because an account is missing. */
  action?: { type: "add-account"; role: string };
};

export type RunSummary = { total: number; passed: number; failed: number; blocked: number; skipped: number; passRate: number | null };

export type GateInfo = { eligible: boolean; score: number; reasons: string[] };

export type RunResponse = {
  status: "completed" | "blocked";
  gate: GateInfo;
  prerequisites: RunResult[];
  /** Real values of cached variables: keep in memory only, never render or store. */
  session: Record<string, string>;
  results: RunResult[];
  summary: RunSummary;
  notes: string[];
  /** Where each account stands after the run. Never holds a token. */
  identities?: IdentityReport[];
  requirement?: Requirement;
  blockedReason?: { code: string; title: string; message: string; action?: { type: "add-account"; role: string }; missing?: string[] };
};

export type PrerequisiteSuggestion = {
  id: string;
  reason: string;
  endpoint: { method: string; path: string };
  request: RequestOverrides;
  extract: ExtractedVariable[];
  cache: boolean;
  defaultHeader?: Record<string, string>;
  /** How sure the match is (0-1), and "high" or "possible". Optional ones are not required by the spec. */
  confidence?: number;
  level?: "high" | "possible";
  optional?: boolean;
};

export type GeneratedScenario = {
  id: string;
  scenario: string;
  requestCondition: string;
  expectedStatusCode: string;
  assumed: boolean;
  request?: { headers?: Record<string, string>; pathParams?: Record<string, string>; query?: Record<string, string>; body?: unknown; rawBody?: string; contentType?: string };
};

export type GenerationResponse = { scenarios: GeneratedScenario[] };

/** What an endpoint needs from another call. `optional` needs (a body field the spec does not require) do not make it dependent. */
export type DependencyNeed = { kind: "auth" | "path-param" | "query-param" | "body-field"; name: string; providedBy: string | null; optional?: boolean; confidence?: number; level?: "high" | "possible"; reason?: string };

export type EndpointDependency = { key: string; method: string; path: string; independent: boolean; needs: DependencyNeed[]; dependsOn: string[]; requirement?: Requirement };

export type DependenciesResponse = { endpoints: EndpointDependency[]; summary: { independent: number; dependent: number } };

/* ── Accounts (identities): who is calling ── */

export type RequirementKind = "public" | "any-customer" | "fresh-customer" | "ready-customer" | "kyc-verified" | "admin" | "second-user" | "needs-secret" | "external";

/** Inferred from the spec's wording: a suggestion the tester can override, never a fact. */
export type Requirement = { kind: RequirementKind; reason: string; confidence: "high" | "medium" | "low"; also?: { kind: RequirementKind; reason: string }[] };

export type AccountStep = { endpoint: { method: string; path: string }; request?: RequestOverrides; expectStatus?: string; tokenVar?: string };

export type AccountSpec = {
  id: string;
  label?: string;
  role?: string;
  /** shared: one account reused across runs. disposable: a new account every run. */
  lifecycle: "shared" | "disposable";
  /** token: pasted (cannot refresh). credentials: login data (can refresh). register: created by calling register. */
  source: "token" | "credentials" | "register";
  token?: string;
  credentials?: { fields: Record<string, string> };
  loginStep?: AccountStep;
  registerStep?: AccountStep;
  readySteps?: AccountStep[];
  tokenVar?: string;
  /** What the account already has, for endpoints that cannot be prepared through the API: "kyc-verified", "funded". */
  provides?: string[];
};

export type IdentityStatus = "ready" | "refreshed" | "created" | "expired" | "missing" | "failed";

export type IdentityReport = {
  id: string;
  status: IdentityStatus;
  source: AccountSpec["source"];
  role: string;
  lifecycle: AccountSpec["lifecycle"];
  refreshable: boolean;
  expiresInSec?: number;
  via?: string;
  error?: string;
  auto?: boolean;
};

export type AccountSuggestion = AccountSpec & { reason: string; confidence: "high" | "medium" | "low"; needs: "credentials" | "credentials-or-token" | null; forEndpoints: string[] };

export type IdentitySuggestionsResponse = {
  /** The names the spec's login body asks for. Empty when the spec has no login call. */
  loginFields: string[];
  canLogin: boolean;
  canRegister: boolean;
  /** Set when the spec has nothing to log in to (the Petstore): paste a token or API key instead. */
  hint?: string;
  identities: AccountSuggestion[];
};
