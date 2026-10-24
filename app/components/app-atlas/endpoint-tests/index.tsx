"use client";

import { useState } from "react";
import { apiAgent } from "@/app/services/api-testing";
import { newId } from "@/app/lib/api-testing/rows";
import { DependencyOverview, PreRunCheck } from "./dependencies";
import { TbAlertTriangle, TbLock } from "react-icons/tb";
import type { EndpointDetail, GateRow } from "@/app/interfaces/api-testing";
import { useEndpointRun, useTestState } from "@/app/hooks/use-endpoint-tests";
import { getEnvironment, getToken, setEnvironment, setToken } from "@/app/lib/api-testing/environment";
import { clearSession, sessionKey } from "@/app/lib/api-testing/session-cache";
import { ContractTab, DataDrivenTab, FunctionalTab } from "./tabs";
import { AccountsSection } from "./accounts";
import { SetupForMe } from "./setup-for-me";
import { PrerequisitesSection } from "./prerequisites";
import { getRunAccounts } from "@/app/lib/api-testing/identities";
import { box, input, label, mono, outlineButton, primaryButton } from "./ui";

export type TestTab = "contract" | "data" | "functional";

/** Contract, Data Driven and Functional testing for one endpoint, sharing one target environment and one prerequisite list. */
export function EndpointTests({
  tab,
  specUrl,
  row,
  rows,
  serverUrl,
  detail,
  view = "all",
  onSetup,
}: {
  /** all: the classic page (setup and tests together). setup / tests: the two halves of the new layout. */
  view?: "all" | "setup" | "tests";
  onSetup?: () => void;
  tab: TestTab;
  specUrl: string;
  row: GateRow;
  rows: GateRow[];
  serverUrl: string | null;
  detail: EndpointDetail | null;
}) {
  const [state, patch] = useTestState(`${specUrl}|${row.key}`);
  const [env, setEnv] = useState(() => {
    const e = getEnvironment(specUrl);
    return { ...e, baseUrl: e.baseUrl || serverUrl || "" };
  });
  const [token, setTokenText] = useState(() => getToken(specUrl));
  const runner = useEndpointRun({ specUrl, row, state, patch, baseUrl: env.baseUrl });

  const updateEnv = (next: typeof env) => {
    setEnv(next);
    setEnvironment(specUrl, next);
  };
  const target = { method: row.method, path: row.path };
  const gateReason = row.pass ? null : row.reasons.length ? row.reasons.map((f) => `${f.ruleId}: ${f.message}`).join("; ") : `Spec quality score ${row.score} is below the pass mark`;
  const lastRun = state.results[tab];
  const common = { running: runner.running === tab, disabled: !row.pass || (runner.running !== null && runner.running !== tab), reason: row.pass ? null : "Blocked by the Spec Quality gate", run: lastRun, onRun: () => runner.start(tab) };

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
      {gateReason && (
        <div className="flex items-start gap-2 rounded-[8px] border border-[#DC2626] bg-[#FEF2F2] px-3 py-2.5 text-[12.5px] text-[#991B1B] dark:bg-[#2a1212] dark:text-[#FCA5A5]">
          <TbAlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <b>BLOCKED by the Spec Quality gate.</b> This endpoint cannot be run until the spec is fixed (score ≥ 75 and no error-level findings).
            <div className="mt-1 text-[12px]">{gateReason}</div>
          </div>
        </div>
      )}

      {view !== "tests" && (<>
      {view === "setup" && <SetupForMe specUrl={specUrl} row={row} state={state} patch={patch} secured={detail?.secured ?? true} />}
      <section className={`${box} space-y-2.5 px-3 py-3`}>
        <div className={label}>Target environment</div>
        <input className={`${input} ${mono}`} value={env.baseUrl} placeholder="https://staging.example.com/api" onChange={(e) => updateEnv({ ...env, baseUrl: e.target.value })} aria-label="Base URL for testing" />
        <div className="flex items-center gap-2">
          <TbLock size={14} className="shrink-0 text-[#7E7E7E]" />
          <input
            className={`${input} ${mono}`}
            type="password"
            autoComplete="new-password"
            value={token}
            placeholder="Bearer token (optional, kept in memory only)"
            onChange={(e) => {
              setTokenText(e.target.value);
              setToken(specUrl, e.target.value);
            }}
            aria-label="Bearer token"
          />
        </div>
      </section>

      <DependencyOverview
        specUrl={specUrl}
        targetKey={row.key}
        hasPrerequisites={state.prerequisites.length > 0}
        requirement={state.requirement}
        onRequirement={(requirement) => patch({ requirement })}
        onAddSuggested={async () => {
          const { suggestions } = await apiAgent.suggestPrerequisites(specUrl, row.path, row.method);
          const headers = suggestions.reduce((h, x) => ({ ...h, ...(x.defaultHeader ?? {}) }), {} as Record<string, string>);
          patch({
            prerequisites: [...state.prerequisites, ...suggestions.map((x) => ({ id: newId(), endpoint: x.endpoint, request: x.request ?? {}, extract: x.extract, cache: x.cache, origin: "suggested" as const, reason: x.reason }))],
            defaultHeaders: { ...state.defaultHeaders, ...headers },
          });
        }}
      />

      <AccountsSection specUrl={specUrl} targetKey={row.key} baseUrl={env.baseUrl} runAs={state.runAs} onRunAs={(runAs) => patch({ runAs })} />

      <PrerequisitesSection
        accountIds={getRunAccounts(specUrl).map((a) => a.id)}
        steps={state.prerequisites}
        onChange={(prerequisites) => patch({ prerequisites })}
        defaultHeaders={state.defaultHeaders}
        onDefaultHeaders={(defaultHeaders) => patch({ defaultHeaders })}
        variables={state.variables}
        onVariables={(variables) => patch({ variables })}
        rows={rows}
        target={target}
        specUrl={specUrl}
        lastRun={lastRun}
        running={runner.running !== null}
        canRerun={row.pass}
        onRerun={() => {
          clearSession(sessionKey(specUrl, env.baseUrl));
          runner.start(tab, { refresh: true });
        }}
      />
      </>)}

      {view === "tests" && <PreRunCheck specUrl={specUrl} targetKey={row.key} runAs={state.runAs} requirement={state.requirement} prerequisiteCount={state.prerequisites.length} onSetup={() => onSetup?.()} />}

      {runner.error && <div className="rounded-[8px] border border-[#DC2626] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C] dark:bg-[#2a1212] dark:text-[#FCA5A5]">{runner.error}</div>}

      {view !== "setup" && tab === "contract" && <ContractTab {...common} expect={state.contract.expect} onExpect={(expect) => patch({ contract: { ...state.contract, expect } })} request={state.contract.request} onRequest={(request) => patch({ contract: { ...state.contract, request } })} isLogin={/login|signin|auth/i.test(row.path) && row.method === "POST"} />}
      {view !== "setup" && tab === "data" && <DataDrivenTab {...common} rows={state.rows} onRows={(r) => patch({ rows: r })} detail={detail} specUrl={specUrl} target={target} seeded={state.rowsSeeded} onSeeded={() => patch({ rowsSeeded: true })} />}
      {view !== "setup" && tab === "functional" && <FunctionalTab {...common} scenarios={state.scenarios} onScenarios={(scenarios) => patch({ scenarios })} specUrl={specUrl} target={target} accountIds={getRunAccounts(specUrl).map((a) => a.id)} />}
    </div>
  );
}
