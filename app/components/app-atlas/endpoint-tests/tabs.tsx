"use client";

import { useEffect, useRef, useState } from "react";
import { TbDownload, TbLoader2, TbPlayerPlay, TbPlus, TbSparkles, TbTrash, TbUpload } from "react-icons/tb";
import { apiAgent } from "@/app/services/api-testing";
import type { Assertion, DataRow, EndpointDetail, FunctionalScenario, GeneratedScenario, RequestOverrides, RunResponse } from "@/app/interfaces/api-testing";
import { buildColumns, cellText, getCell, ImportError, newId, newRow, rowFromSpecExample, rowsFromCsv, rowsFromJson, rowsToCsv, setCell } from "@/app/lib/api-testing/rows";
import { RunAsSelect } from "./accounts";
import { AssertionsEditor, OverridesEditor } from "./fields";
import { ResultsPanel, StatusBadge } from "./results";
import { Hint } from "./layout-mode";
import { box, iconButton, input, label, mono, outlineButton, primaryButton, SECRET_NAME } from "./ui";

export function RunBar({ text, running, disabled, onRun, hint }: { text: string; running: boolean; disabled: boolean; onRun: () => void; hint?: string | null }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center gap-3 bg-gradient-to-t from-white via-white/95 to-transparent px-4 pt-5 pb-3 dark:from-[#0a0a0a] dark:via-[#0a0a0a]/95">
      <button type="button" className={primaryButton} disabled={disabled || running} onClick={onRun}>
        {running ? <TbLoader2 size={14} className="animate-spin" /> : <TbPlayerPlay size={14} />} {running ? "Running…" : text}
      </button>
      {hint && <span className="text-[12px] text-[#7E7E7E]">{hint}</span>}
    </div>
  );
}

type TabProps = { run: RunResponse | undefined; running: boolean; disabled: boolean; reason: string | null; onRun: () => void };

/* ── Contract ─────────────────────────────────────────────────────────────────────────────────────── */

export function ContractTab({ expect, onExpect, request, onRequest, isLogin, ...p }: TabProps & { expect: string; onExpect: (v: string) => void; request: RequestOverrides; onRequest: (r: RequestOverrides) => void; isLogin: boolean }) {
  const preset = ["2xx", "4xx", "ALL"].includes(expect.toUpperCase() === "ALL" ? "ALL" : expect.toLowerCase()) ? (expect.toUpperCase() === "ALL" ? "ALL" : expect.toLowerCase()) : "code";
  const valid = /^(ALL|[1-5]xx|[1-5]\d\d)$/i.test(expect);
  return (
    <section className="space-y-3">
      <Hint short="Sends a real request and checks it against the spec.">
        Sends a real request and checks the answer against the spec: the status code is documented, required fields are present, types match, and the content type is the one the spec declares. Fields the spec does not document are reported as warnings.
      </Hint>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${label} !mb-0`}>Expect</span>
        <select className="rounded-[6px] border border-[#D9D9D9] bg-white px-2 py-1.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#0a0a0a] dark:text-[#ededed]" value={preset} onChange={(e) => onExpect(e.target.value === "code" ? "404" : e.target.value)}>
          <option value="2xx">2xx (success)</option>
          <option value="4xx">4xx (client error)</option>
          <option value="ALL">ALL declared responses</option>
          <option value="code">One status code…</option>
        </select>
        {preset === "code" && <input className={`${input} ${mono} !w-[72px] ${valid ? "" : "!border-[#DC2626]"}`} value={expect} onChange={(e) => onExpect(e.target.value.trim())} aria-label="Status code" />}
      </div>
      {isLogin && expect.toLowerCase() === "2xx" && <div className="rounded-[6px] bg-[#EFF6FF] px-2.5 py-2 text-[12px] text-[#1E40AF] dark:bg-[#10203a] dark:text-[#93C5FD]">Generated credentials are usually rejected with 401. To see the success checks, enter real credentials under Request overrides (kept in memory only), or choose 4xx.</div>}
      <details className={`${box} px-3 py-2`}>
        <summary className="cursor-pointer text-[12px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Request overrides (optional)</summary>
        <div className="mt-3">
          <OverridesEditor value={request} onChange={onRequest} />
        </div>
      </details>
      <RunBar text="Run contract test" running={p.running} disabled={p.disabled || !valid} onRun={p.onRun} hint={p.reason} />
      {p.run && <ResultsPanel run={p.run} />}
    </section>
  );
}

/* ── Functional ───────────────────────────────────────────────────────────────────────────────────── */

const scenarioFrom = (s: GeneratedScenario): FunctionalScenario => {
  const r = s.request ?? {};
  const assertions: Assertion[] = /^\d{3}$/.test(s.expectedStatusCode) ? [{ kind: "status", op: "equals", value: Number(s.expectedStatusCode) }] : [];
  return {
    id: newId(),
    name: s.scenario,
    enabled: true,
    request: {
      ...(r.pathParams ? { pathParams: r.pathParams } : {}),
      ...(r.query ? { query: r.query } : {}),
      ...(r.headers ? { headers: r.headers } : {}),
      ...(r.body !== undefined ? { body: r.body } : r.rawBody !== undefined ? { body: r.rawBody } : {}),
      ...(r.contentType ? { contentType: r.contentType } : {}),
    },
    assertions,
    generated: true,
    from: { scenarioId: s.id, expectedStatusCode: s.expectedStatusCode, assumed: s.assumed },
  };
};

export function FunctionalTab({ scenarios, onScenarios, specUrl, target, accountIds, ...p }: TabProps & { accountIds: string[]; scenarios: FunctionalScenario[]; onScenarios: (s: FunctionalScenario[]) => void; specUrl: string; target: { method: string; path: string } }) {
  const [loading, setLoading] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const update = (id: string, patch: Partial<FunctionalScenario>) => onScenarios(scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const needsStatus = (s: FunctionalScenario) => s.assertions.length === 0;
  const runnable = scenarios.filter((s) => s.enabled);
  const suggest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiAgent.suggestScenarios(specUrl, target.path, target.method, useLlm);
      onScenarios([...scenarios, ...res.scenarios.map(scenarioFrom)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not suggest scenarios.");
    } finally {
      setLoading(false);
    }
  };
  const resultOf = (id: string) => p.run?.results.find((r) => r.id === id);
  return (
    <section className="space-y-3">
      <Hint short="Your own scenarios with assertions, or suggestions from the spec.">Write scenarios with your own assertions, or get suggestions from the spec and edit them before running. A suggestion whose expected status is TBD stays TBD until you set a status assertion.</Hint>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={outlineButton} onClick={() => onScenarios([...scenarios, { id: newId(), name: `Scenario ${scenarios.length + 1}`, enabled: true, request: {}, assertions: [{ kind: "status", op: "equals", value: 200 }] }])}>
          <TbPlus size={13} /> Add scenario
        </button>
        <button type="button" className={outlineButton} onClick={suggest} disabled={loading}>
          {loading ? <TbLoader2 size={13} className="animate-spin" /> : <TbSparkles size={13} />} Suggest scenarios
        </button>
        <label className="flex items-center gap-1.5 text-[11.5px] text-[#5E6066] dark:text-[#9ca3af]" title="Off: instant, rule-based suggestions. On: also asks the AI model, which can take a while.">
          <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} /> Use AI model
        </label>
      </div>
      {error && <div className="text-[12px] text-[#DC2626]">{error}</div>}
      <div className="space-y-2">
        {scenarios.length === 0 && <div className={`${box} px-3 py-3 text-[12px] text-[#7E7E7E]`}>No scenarios yet.</div>}
        {scenarios.map((s) => {
          const res = resultOf(s.id);
          return (
            <div key={s.id} className={`${box} overflow-hidden`}>
              <div className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={s.enabled} onChange={(e) => update(s.id, { enabled: e.target.checked })} aria-label="Run this scenario" />
                <input className={`${input} !border-transparent !bg-transparent font-medium`} value={s.name} onChange={(e) => update(s.id, { name: e.target.value })} aria-label="Scenario name" />
                {needsStatus(s) && <span className="shrink-0 rounded-[4px] border border-[#D97706] bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-bold text-[#D97706]">{s.from?.expectedStatusCode === "TBD" ? "TBD" : "NO ASSERTIONS"}</span>}
                {res && <StatusBadge status={res.status} />}
                <button type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  {open === s.id ? "Close" : "Edit"}
                </button>
                <button type="button" className={iconButton} aria-label="Remove scenario" onClick={() => onScenarios(scenarios.filter((x) => x.id !== s.id))}>
                  <TbTrash size={14} />
                </button>
              </div>
              {open === s.id && (
                <div className="space-y-3 border-t border-[#EEE] px-3 py-3 dark:border-[#1a1a1a]">
                  <div>
                    <div className={label}>Request overrides</div>
                    <OverridesEditor value={s.request} onChange={(request) => update(s.id, { request, generated: false })} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#5E6066] dark:text-[#9ca3af]">
                    <span className={label + " !mb-0"}>Run as</span>
                    <RunAsSelect value={s.runAs ?? ""} onChange={(runAs) => update(s.id, { runAs: runAs || undefined })} accounts={accountIds} emptyLabel="(this run's account)" />
                    <span className="text-[11.5px] text-[#7E7E7E]">none sends no Authorization header; expired sends a generated expired token.</span>
                  </div>
                  <div>
                    <div className={label}>Assertions</div>
                    <AssertionsEditor value={s.assertions} onChange={(assertions) => update(s.id, { assertions })} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <RunBar text={`Run ${runnable.length} scenario${runnable.length === 1 ? "" : "s"}`} running={p.running} disabled={p.disabled || runnable.length === 0} onRun={p.onRun} hint={p.reason} />
      {p.run && <ResultsPanel run={p.run} />}
    </section>
  );
}

/* ── Data Driven ──────────────────────────────────────────────────────────────────────────────────── */

const STATUS_OK = /^([1-5]xx|[1-5]\d\d)$/i;

export function DataDrivenTab({ rows, onRows, detail, specUrl, target, seeded, onSeeded, ...p }: TabProps & { rows: DataRow[]; onRows: (r: DataRow[]) => void; detail: EndpointDetail | null; specUrl: string; target: { method: string; path: string }; seeded: boolean; onSeeded: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [openAssert, setOpenAssert] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  // First visit: the first row is the spec's own example, so there is something to run straight away.
  useEffect(() => {
    if (!seeded && detail && rows.length === 0) {
      onSeeded();
      onRows([rowFromSpecExample(detail)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded, detail]);

  const bodyExample = detail?.body?.example;
  const bodyFields = bodyExample && typeof bodyExample === "object" && !Array.isArray(bodyExample) ? Object.keys(bodyExample) : [];
  const columns = buildColumns(detail?.params ?? [], bodyFields, rows);
  const update = (id: string, patch: Partial<DataRow>) => onRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const badStatus = rows.some((r) => !STATUS_OK.test(r.expectedStatus));
  const resultOf = (id: string) => p.run?.results.find((r) => r.id === id);

  const generate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiAgent.generateRows(specUrl, target.path, target.method);
      const kept = rows.filter((r) => r.origin === "manual" || r.origin === "import");
      onRows([...res.rows.map((r) => ({ ...r, id: newId() })), ...kept]);
      setMessage({ ok: true, text: `Generated ${res.rows.length} rows from the spec.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Could not generate rows." });
    } finally {
      setLoading(false);
    }
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const text = await f.text();
      const imported = /\.json$/i.test(f.name) || text.trim().startsWith("[") || text.trim().startsWith("{") ? rowsFromJson(text) : rowsFromCsv(text);
      onRows([...rows, ...imported]);
      setMessage({ ok: true, text: `Imported ${imported.length} row${imported.length === 1 ? "" : "s"} from ${f.name}.` });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ImportError ? e.message : "Could not read that file." });
    }
    if (file.current) file.current.value = "";
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([rowsToCsv(rows, columns)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-rows.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3">
      <Hint short="One request per row. Edit a cell to pin your own value.">
        One request per row. A cell is parsed as JSON when it can be (<span className={mono}>5</span>, <span className={mono}>true</span>, <span className={mono}>&quot;&quot;</span> for an empty string); an empty cell leaves the field out. Generated rows get fresh unique values (email, mobile number) on every run and reuse data created by prerequisites; edit a cell to pin your own value. CSV columns: label, status, path:&lt;name&gt;, query:&lt;name&gt;, header:&lt;name&gt;, body:&lt;field&gt;, assert:&lt;$.path&gt;.
      </Hint>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={outlineButton} onClick={() => onRows([...rows, newRow()])}>
          <TbPlus size={13} /> Add row
        </button>
        <button type="button" className={outlineButton} onClick={generate} disabled={loading}>
          {loading ? <TbLoader2 size={13} className="animate-spin" /> : <TbSparkles size={13} />} Generate rows
        </button>
        <button type="button" className={outlineButton} onClick={() => file.current?.click()}>
          <TbUpload size={13} /> Import CSV / JSON
        </button>
        <input ref={file} type="file" accept=".csv,.json,.txt,text/csv,application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        <button type="button" className={outlineButton} onClick={exportCsv} disabled={rows.length === 0}>
          <TbDownload size={13} /> Export CSV
        </button>
      </div>
      {message && <div className={`text-[12px] ${message.ok ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{message.text}</div>}
      <div className="overflow-x-auto rounded-[8px] border border-[#EEE] dark:border-[#1a1a1a]">
        <table className="w-full border-collapse text-left text-[12px]">
          <thead>
            <tr className="bg-[#F8F9FB] text-[#1F1F1F] dark:bg-[#141414] dark:text-[#ededed]">
              <th className="px-2 py-2 font-medium">#</th>
              <th className="min-w-[110px] px-2 py-2 font-medium">Label</th>
              <th className="px-2 py-2 font-medium">Expect</th>
              {columns.map((c) => (
                <th key={c.id} className="min-w-[110px] px-2 py-2 font-medium" title={`${c.where} ${c.name}`}>
                  <span className="text-[10px] text-[#7E7E7E] uppercase">{c.where} </span>
                  {c.name}
                </th>
              ))}
              <th className="px-2 py-2 font-medium">Asserts</th>
              <th className="px-2 py-2 font-medium">Result</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 6} className="px-3 py-6 text-center text-[#7E7E7E]">
                  No rows. Add one, generate rows from the spec, or import a file.
                </td>
              </tr>
            )}
            {rows.flatMap((r, i) => {
              const res = resultOf(r.id);
              const cells = (
                <tr key={r.id} className="border-t border-[#F0F0F0] align-top dark:border-[#1a1a1a]">
                  <td className="px-2 py-1.5 text-[#7E7E7E]">{i + 1}</td>
                  <td className="px-1 py-1">
                    <input className={input} value={r.label ?? ""} placeholder={r.origin === "generated-invalid" ? "invalid case" : "label"} onChange={(e) => update(r.id, { label: e.target.value })} title={r.label} />
                  </td>
                  <td className="px-1 py-1">
                    <input className={`${input} ${mono} !w-[64px] ${STATUS_OK.test(r.expectedStatus) ? "" : "!border-[#DC2626]"}`} value={r.expectedStatus} onChange={(e) => update(r.id, { expectedStatus: e.target.value.trim(), soft: undefined })} aria-label="Expected status" />
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-1 py-1">
                      <input className={`${input} ${mono}`} type={SECRET_NAME.test(c.name) ? "password" : "text"} autoComplete="off" value={cellText(getCell(r.request, c))} onChange={(e) => update(r.id, { request: setCell(r.request, c, e.target.value), origin: r.origin === "spec-example" || r.origin === "generated-valid" ? "manual" : r.origin })} aria-label={`${c.name} for row ${i + 1}`} />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <button type="button" className={`${outlineButton} !px-2 !py-1 !text-[11.5px]`} onClick={() => setOpenAssert(openAssert === r.id ? null : r.id)}>
                      {r.assertions.length}
                    </button>
                  </td>
                  <td className="px-2 py-1.5">{res ? <StatusBadge status={res.status} /> : <span className="text-[#7E7E7E]">—</span>}</td>
                  <td className="px-1 py-1">
                    <button type="button" className={iconButton} aria-label={`Remove row ${i + 1}`} onClick={() => onRows(rows.filter((x) => x.id !== r.id))}>
                      <TbTrash size={14} />
                    </button>
                  </td>
                </tr>
              );
              return openAssert === r.id
                ? [
                    cells,
                    <tr key={`${r.id}-a`} className="bg-[#F8F9FB] dark:bg-[#141414]">
                      <td colSpan={columns.length + 6} className="px-4 py-3">
                        <div className={label}>Assertions for row {i + 1}</div>
                        <AssertionsEditor value={r.assertions} onChange={(assertions) => update(r.id, { assertions })} />
                      </td>
                    </tr>,
                  ]
                : [cells];
            })}
          </tbody>
        </table>
      </div>
      <RunBar text={`Run ${rows.length} row${rows.length === 1 ? "" : "s"}`} running={p.running} disabled={p.disabled || rows.length === 0 || badStatus} onRun={p.onRun} hint={badStatus ? "Fix the expected status (like 2xx or 404)." : p.reason} />
      {p.run && <ResultsPanel run={p.run} rowOrder={rows.map((r) => r.id)} />}
    </section>
  );
}
