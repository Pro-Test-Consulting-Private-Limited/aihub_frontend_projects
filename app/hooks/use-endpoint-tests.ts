"use client";

import { useEffect, useRef, useState } from "react";
import { apiAgent } from "@/app/services/api-testing";
import type { DataRow, FunctionalScenario, GateRow, PrerequisiteStep, RequestOverrides, RequirementKind, RunRequest, RunResponse, TestMode } from "@/app/interfaces/api-testing";
import { validateBaseUrl } from "@/app/lib/api-testing/environment";
import { getRunAccounts, setStatuses } from "@/app/lib/api-testing/identities";
import { cloneSteps, getSharedSetup, getSharedVariables, setSharedVariables } from "@/app/lib/api-testing/shared-setup";
import { clearSession, getSession, mergeSession, sessionKey } from "@/app/lib/api-testing/session-cache";

/**
 * Per-endpoint test setup and last results. Module memory only: nothing here is written to browser storage, because
 * prerequisite bodies and data rows can hold passwords. A page reload starts clean.
 */
export type TestState = {
  prerequisites: PrerequisiteStep[];
  /** Headers added to every test call, e.g. Authorization: Bearer {{token}}. */
  defaultHeaders: Record<string, string>;
  contract: { expect: string; request: RequestOverrides };
  rows: DataRow[];
  rowsSeeded: boolean;
  scenarios: FunctionalScenario[];
  /** The person's own variables, usable as {{name}} in any test. */
  variables: Record<string, string>;
  /** Which account runs the target. "" = chosen from what the endpoint needs. */
  runAs: string;
  /** Overrides the requirement inferred for this endpoint. "" = use the inferred one. */
  requirement: RequirementKind | "";
  results: Partial<Record<TestMode, RunResponse>>;
};

const store = new Map<string, TestState>();
const fresh = (): TestState => ({ prerequisites: [], defaultHeaders: {}, contract: { expect: "2xx", request: {} }, rows: [], rowsSeeded: false, scenarios: [], variables: {}, runAs: "", requirement: "", results: {} });

// The id is `${specUrl}|${endpointKey}`; what is shared by the whole spec is looked up by the first part.
const specOf = (id: string) => id.slice(0, id.lastIndexOf("|"));

/** The state of an endpoint the first time it is opened: the spec's shared steps (if any) and variables are its starting point. */
function initial(id: string): TestState {
  const own = store.get(id);
  const spec = specOf(id);
  const variables = getSharedVariables(spec);
  if (own) return variables ? { ...own, variables } : own;
  const base = fresh();
  const sharedSetup = getSharedSetup(spec);
  return { ...base, ...(sharedSetup ? { prerequisites: cloneSteps(sharedSetup.prerequisites), defaultHeaders: { ...sharedSetup.defaultHeaders } } : {}), ...(variables ? { variables } : {}) };
}

export function useTestState(id: string): [TestState, (patch: Partial<TestState>) => void] {
  const [state, setState] = useState<TestState>(() => initial(id));
  const patch = (p: Partial<TestState>) =>
    setState((prev) => {
      const next = { ...prev, ...p };
      store.set(id, next);
      if (p.variables) setSharedVariables(specOf(id), p.variables); // your variables are the same for every endpoint of the spec
      return next;
    });
  return [state, patch];
}

const nonEmpty = (o: object | undefined) => !!o && Object.keys(o).length > 0;

export function useEndpointRun({
  specUrl,
  row,
  state,
  patch,
  baseUrl,
}: {
  specUrl: string;
  row: GateRow;
  state: TestState;
  patch: (p: Partial<TestState>) => void;
  baseUrl: string;
}) {
  const [running, setRunning] = useState<TestMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const start = async (mode: TestMode, opts: { refresh?: boolean } = {}) => {
    setError(null);
    const urlError = validateBaseUrl(baseUrl);
    if (urlError) return setError(urlError);

    const key = sessionKey(specUrl, baseUrl);
    if (opts.refresh) clearSession(key);
    // The Authorization header now comes from the account the call runs as, not from one global {{token}}.
    const defaultHeaders = { ...state.defaultHeaders };

    const req: RunRequest = {
      swaggerUrl: specUrl,
      baseUrl: baseUrl.trim(),
      target: { method: row.method, path: row.path },
      mode,
      prerequisites: state.prerequisites,
      defaults: nonEmpty(defaultHeaders) ? { headers: defaultHeaders } : undefined,
      // Values saved by earlier runs (login token, data sent by register...). Kept in browser memory only.
      session: getSession(key),
      // The token typed in the Connect Swagger step is the account `default`; other accounts are added under Accounts.
      identities: getRunAccounts(specUrl),
      runAs: state.runAs || undefined,
      requirement: state.requirement || undefined,
      variables: { ...state.variables },
      refresh: !!opts.refresh,
      ...(mode === "contract" ? { contract: { expect: state.contract.expect, request: nonEmpty(state.contract.request) ? state.contract.request : undefined } } : {}),
      ...(mode === "data" ? { rows: state.rows } : {}),
      ...(mode === "functional" ? { scenarios: state.scenarios.filter((s) => s.enabled) } : {}),
    };

    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRunning(mode);
    try {
      const { session, ...res } = await apiAgent.executeChain(req, ctrl.signal);
      mergeSession(key, session ?? {}); // real values stay in module memory; they are never rendered or stored in React state
      if (res.identities?.length) setStatuses(specUrl, res.identities);
      patch({ results: { ...state.results, [mode]: { ...res, session: {} } } });
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : "The run failed.");
    } finally {
      if (abort.current === ctrl) setRunning(null);
    }
  };

  return { running, error, start };
}
