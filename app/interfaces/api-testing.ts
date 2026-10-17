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
