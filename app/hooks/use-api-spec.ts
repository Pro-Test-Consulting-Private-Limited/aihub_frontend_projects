"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiAgent } from "@/app/services/api-testing";
import type { ApiModule, GateRow, LintReport, SpecEndpoint } from "@/app/interfaces/api-testing";

export const DEFAULT_PASS_SCORE = 75;
export const UNTAGGED = "Untagged";

type Loaded = { endpoints: SpecEndpoint[]; lint: LintReport };
export type ApiSpecState = {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  data: Loaded | null;
};

const IDLE: ApiSpecState = { status: "idle", error: null, data: null };
const cache = new Map<string, Loaded>();

/** Reads a spec through the API Test Scenario Agent: its endpoints (grouped into modules) and its quality report. */
export function useApiSpec(specUrl: string | null) {
  const [state, setState] = useState<ApiSpecState>(IDLE);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!specUrl) {
      setState(IDLE);
      return;
    }
    const cached = cache.get(specUrl);
    if (cached) {
      setState({ status: "ready", error: null, data: cached });
      return;
    }
    const ctrl = new AbortController();
    setState({ status: "loading", error: null, data: null });
    Promise.all([apiAgent.endpoints(specUrl, ctrl.signal), apiAgent.lint(specUrl, ctrl.signal)])
      .then(([eps, lint]) => {
        const data = { endpoints: eps.endpoints, lint };
        cache.set(specUrl, data);
        setState({ status: "ready", error: null, data });
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setState({ status: "error", error: err instanceof Error ? err.message : "Could not read the spec.", data: null });
      });
    return () => ctrl.abort();
  }, [specUrl, nonce]);

  const reload = useCallback(() => {
    if (specUrl) cache.delete(specUrl);
    setNonce((n) => n + 1);
  }, [specUrl]);

  return { ...state, reload };
}

const moduleOf = (e: SpecEndpoint) => e.tag?.trim() || UNTAGGED;

export function buildModules(endpoints: SpecEndpoint[]): ApiModule[] {
  const counts = new Map<string, number>();
  for (const e of endpoints) counts.set(moduleOf(e), (counts.get(moduleOf(e)) ?? 0) + 1);
  return [...counts].map(([name, n]) => ({ name, endpoints: n }));
}

/** Same rule as the agent's own UI: blocked if the score is below the pass mark or the endpoint has an error-level finding. */
export function buildGateRows(data: Loaded): GateRow[] {
  const passScore = data.lint.scoring?.passScore ?? DEFAULT_PASS_SCORE;
  const moduleByKey = new Map(data.endpoints.map((e) => [`${e.method.toUpperCase()} ${e.path}`, moduleOf(e)]));
  const errors = data.lint.findings.filter((f) => f.severity === "error");
  return data.lint.endpoints.map((ep) => {
    const reasons = errors.filter((f) => f.endpoint === ep.endpoint);
    const space = ep.endpoint.indexOf(" ");
    return {
      key: ep.endpoint,
      method: ep.endpoint.slice(0, space).toUpperCase(),
      path: ep.endpoint.slice(space + 1),
      module: moduleByKey.get(ep.endpoint) ?? UNTAGGED,
      score: ep.score,
      grade: ep.grade,
      pass: ep.score >= passScore && reasons.length === 0,
      reasons,
    };
  });
}

export function useApiSpecView(spec: ApiSpecState) {
  return useMemo(() => {
    if (!spec.data) return { modules: [] as ApiModule[], rows: [] as GateRow[], passScore: DEFAULT_PASS_SCORE };
    return {
      modules: buildModules(spec.data.endpoints),
      rows: buildGateRows(spec.data),
      passScore: spec.data.lint.scoring?.passScore ?? DEFAULT_PASS_SCORE,
    };
  }, [spec.data]);
}
