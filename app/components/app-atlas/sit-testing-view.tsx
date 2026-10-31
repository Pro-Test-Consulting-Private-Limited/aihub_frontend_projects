"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbLoader2, TbBolt, TbClipboardList, TbGitMerge } from "react-icons/tb";
import type { SitEpic, SitSheet, SitWorkbook } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";

type GenState = "idle" | "ready" | "generating" | "done" | "error";

function statusColor(cat: string) {
  if (cat === "done") return "bg-[#d1fae5] text-[#065f46]";
  if (cat === "indeterminate") return "bg-[#fef3c7] text-[#92400e]";
  return "bg-[#e5e7eb] text-[#374151] dark:bg-[#2a2a2a] dark:text-[#9ca3af]";
}

const TYPE_STYLE: Record<string, string> = {
  Positive: "bg-[#E2EFDA] text-[#375623]",
  Negative: "bg-[#FCE4E4] text-[#9b1c1c]",
  Boundary: "bg-[#FFF2CC] text-[#7a5b00]",
  Validation: "bg-[#DDEBF7] text-[#1e3a5f]",
  "Business Rule": "bg-[#E4DFEC] text-[#4a3a6b]",
  Security: "bg-[#F8CBAD] text-[#7a3e12]",
  Concurrency: "bg-[#dde7f5] text-[#1e3a5f]",
};

function TypePill({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${TYPE_STYLE[value] || "bg-[#eee] text-[#444]"}`}>
      {value}
    </span>
  );
}

/** Compact requirement → test case → data link strip for the Traceability tab. */
function LinkMap({ sheet }: { sheet: SitSheet }) {
  const links = sheet.rows.slice(0, 24).map((r) => ({
    req: r.cells.requirementId || "?",
    tc: r.cells.tcId || "?",
    td: r.cells.dataId || "?",
    cov: r.cells.coverage || "",
  }));
  if (!links.length) return null;
  return (
    <div className="mx-4 mt-3 overflow-x-auto rounded-[8px] border border-dashed border-[#cfd5e4] bg-[#fafafa] p-3 dark:border-[#2a2a2a] dark:bg-[#141414]">
      <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium text-[#5b647a] dark:text-[#9ca3af]">
        <TbGitMerge size={14} className="text-[#8664F2]" />
        Link map · Requirement → Test case → Test data
      </div>
      <div className="flex min-w-max flex-col gap-1.5">
        {links.map((l, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px]">
            <span className="rounded bg-[#ede9fe] px-2 py-1 font-semibold text-[#5b21b6]">{l.req}</span>
            <span className="text-[#c4b5fd]">→</span>
            <span className="rounded bg-[#dbeafe] px-2 py-1 font-semibold text-[#1d4ed8]">{l.tc}</span>
            <span className="text-[#93c5fd]">→</span>
            <span className="rounded bg-[#d1fae5] px-2 py-1 font-semibold text-[#065f46]">{l.td}</span>
            {l.cov ? <TypePill value={l.cov} /> : null}
          </div>
        ))}
      </div>
      {sheet.rows.length > 24 && (
        <p className="mt-2 text-[10.5px] text-[#8a93a8]">Showing 24 of {sheet.rows.length} links — full matrix in the table.</p>
      )}
    </div>
  );
}

export function SitTestingView({
  client,
  canvasId,
  canvasName,
}: {
  client: AtlasClient;
  canvasId: string | null;
  canvasName?: string;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [source, setSource] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genState, setGenState] = useState<GenState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<SitWorkbook | null>(null);
  const [activeSheetId, setActiveSheetId] = useState("test-cases");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await client.listSitTickets(canvasId);
      setEpics(res.epics);
      setSource(res.source);
      const open: Record<string, boolean> = {};
      res.epics.forEach((e, i) => {
        open[e.key] = i === 0;
      });
      setExpanded(open);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [client, canvasId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setGenState(selected.size ? "ready" : "idle");
  }, [selected]);

  const allTicketKeys = useMemo(() => epics.flatMap((e) => e.tickets.map((t) => t.key)), [epics]);

  const selectedLabel = useMemo(() => {
    if (!selected.size) return null;
    const labels: string[] = [];
    for (const e of epics) {
      for (const t of e.tickets) {
        if (selected.has(t.key)) labels.push(`${t.key}: ${t.summary}`);
      }
    }
    return labels;
  }, [epics, selected]);

  const activeSheet: SitSheet | null =
    workbook?.sheets.find((s) => s.id === activeSheetId) || workbook?.sheets[0] || null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allTicketKeys));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async () => {
    if (!selected.size) return;
    setGenState("generating");
    setError(null);
    try {
      const wb = await client.generateSitWorkbook({
        issueKeys: [...selected],
        canvasId,
      });
      setWorkbook(wb);
      setActiveSheetId(wb.sheets[0]?.id || "test-cases");
      setGenState("done");
    } catch (err) {
      setGenState("error");
      setError(err instanceof Error ? err.message : "Generation failed");
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f7f8fb] dark:bg-[#0a0a0a]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEE] bg-white px-5 py-4 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div>
          <h1 className="flex items-center gap-2 text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <TbClipboardList size={18} className="text-[#8664F2]" />
            SIT Testing
          </h1>
          <p className="mt-1 max-w-2xl text-[12.5px] text-[#5E6066] dark:text-[#9ca3af]">
            Select one or more Jira stories, then generate Positive / Negative / Boundary / Business-rule cases
            (Hugging Face when configured, otherwise a rich template). Results match the QA workbook layout and feed Coverage.
            {canvasName ? (
              <>
                {" "}
                Canvas: <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{canvasName}</span>
              </>
            ) : (
              " · No canvas selected — demo catalog if App Atlas has no Jira mapping."
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">
            Ticket source: {source || "…"}
            {source === "demo" ? " (demo until this canvas is connected to Jira)" : ""}
            {selected.size ? ` · ${selected.size} selected` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectAll} className="rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-[12px] dark:border-[#2a2a2a]">
            Select all
          </button>
          <button type="button" onClick={clearAll} className="rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-[12px] dark:border-[#2a2a2a]">
            Clear
          </button>
          <button
            type="button"
            disabled={!selected.size || genState === "generating"}
            onClick={() => void handleGenerate()}
            className="rounded-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
          >
            {genState === "generating" ? (
              <span className="inline-flex items-center gap-1.5">
                <TbLoader2 className="animate-spin" size={14} /> Generating…
              </span>
            ) : selected.size > 1 ? (
              `Generate for ${selected.size} tickets`
            ) : (
              "Generate Test Cases + Test Data"
            )}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 rounded-[8px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[12.5px] text-[#b42318]">
            {error}
          </div>
        )}

        {selectedLabel && selectedLabel.length > 0 && (
          <div className="mb-3 text-[13px] text-[#374151] dark:text-[#9ca3af]">
            Selected:{" "}
            <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">
              {selectedLabel.length <= 3 ? selectedLabel.join(" · ") : `${selectedLabel.slice(0, 2).join(" · ")} +${selectedLabel.length - 2} more`}
            </span>
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
          <div className="border-b border-[#eef0f5] px-4 py-3 text-[13px] font-medium text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]">
            Jira epics & tickets
          </div>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-[13px] text-[#8a93a8]">
              <TbLoader2 className="animate-spin" /> Loading tickets…
            </div>
          ) : (
            <ul>
              {epics.map((epic) => (
                <li key={epic.key} className="border-b border-[#f3f4f6] last:border-0 dark:border-[#1a1a1a]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[#fafafa] dark:hover:bg-[#141414]"
                    onClick={() => setExpanded((e) => ({ ...e, [epic.key]: !e[epic.key] }))}
                  >
                    <span className="w-4 text-[#8664F2]">{expanded[epic.key] ? "▾" : "▸"}</span>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#ede9fe] text-[10px] font-bold text-[#8664F2]">
                      <TbBolt size={12} />
                    </span>
                    <span className="flex-1 font-medium text-[#1F1F1F] dark:text-[#ededed]">
                      {epic.summary}
                      <span className="ml-2 text-[11px] font-normal text-[#8a93a8]">
                        {epic.key !== "_unassigned" ? epic.key : ""} · {epic.ticketCount} tickets
                      </span>
                    </span>
                    {epic.status && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusColor(epic.statusCategory)}`}>
                        {epic.status}
                      </span>
                    )}
                  </button>
                  {expanded[epic.key] && (
                    <ul className="bg-[#fcfcfd] dark:bg-[#0c0c0c]">
                      {epic.tickets.map((t) => {
                        const on = selected.has(t.key);
                        return (
                          <li key={t.key}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 border-t border-[#f3f4f6] py-2.5 pr-4 pl-12 text-[13px] dark:border-[#1a1a1a] ${
                                on ? "bg-[#f3f0ff] dark:bg-[#1c1530]" : "hover:bg-[#f9fafb] dark:hover:bg-[#141414]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => toggle(t.key)}
                                className="accent-[#8664F2]"
                              />
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#dbeafe] text-[10px] font-bold text-[#1d4ed8]">
                                S
                              </span>
                              <span className="flex-1 text-[#1F1F1F] dark:text-[#ededed]">
                                <span className="font-medium">{t.key}</span>
                                <span className="text-[#5b647a] dark:text-[#9ca3af]">: {t.summary}</span>
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusColor(t.statusCategory)}`}>
                                {t.status}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {workbook && activeSheet && (
          <section className="overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef0f5] px-4 py-3 dark:border-[#1a1a1a]">
              <div>
                <div className="text-[13px] font-medium text-[#1F1F1F] dark:text-[#ededed]">Results workspace</div>
                <div className="mt-0.5 text-[11px] text-[#5b647a] dark:text-[#9ca3af]">
                  Source:{" "}
                  {workbook.sourceIssueKeys
                    .map((k) => `${k}${workbook.sourceSummaries[k] ? ` — ${workbook.sourceSummaries[k]}` : ""}`)
                    .join("; ")}
                  {" · "}Confirmed ID: <code className="text-[10.5px]">{workbook.confirmedId}</code>
                  {" · "}Generator:{" "}
                  <span className={workbook.generator === "huggingface" ? "font-semibold text-[#16a34a]" : ""}>
                    {workbook.generator}
                  </span>
                  {" · "}
                  {workbook.sheets.find((s) => s.kind === "test-cases")?.rows.length ?? 0} test cases
                </div>
              </div>
              <button
                type="button"
                className="text-[12px] text-[#8664F2]"
                onClick={() => {
                  setWorkbook(null);
                  setGenState(selected.size ? "ready" : "idle");
                }}
              >
                Back to ticket list
              </button>
            </div>

            {activeSheet.kind === "traceability" && <LinkMap sheet={activeSheet} />}

            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 z-[1] bg-[#1F4E78] text-white">
                  <tr>
                    {activeSheet.columns.map((col) => (
                      <th
                        key={col.id}
                        className="whitespace-nowrap border-b border-[#163a5c] px-3 py-2 text-left text-[11px] font-semibold tracking-wide"
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-[#fafafa] dark:hover:bg-[#141414]">
                      {activeSheet.columns.map((col) => (
                        <td
                          key={col.id}
                          className="max-w-[320px] border-b border-[#f3f4f6] px-3 py-2 align-top whitespace-pre-wrap text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]"
                        >
                          {col.id === "testType" || col.id === "coverage" ? (
                            <TypePill value={row.cells[col.id] || ""} />
                          ) : (
                            row.cells[col.id] ?? ""
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-1 border-t border-[#eef0f5] bg-[#f8f9fc] px-2 pt-2 pb-2 dark:border-[#1a1a1a] dark:bg-[#141414]">
              {workbook.sheets.map((sheet) => (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() => setActiveSheetId(sheet.id)}
                  className={`rounded-t-[6px] px-3 py-1.5 text-[11.5px] ${
                    activeSheetId === sheet.id
                      ? "-mb-px border border-b-white border-[#e2e6ef] bg-white font-medium text-[#1F1F1F] dark:border-[#2a2a2a] dark:border-b-[#101010] dark:bg-[#101010] dark:text-[#ededed]"
                      : "text-[#5b647a] hover:bg-[#eef0f5] dark:text-[#9ca3af] dark:hover:bg-[#1a1a1a]"
                  }`}
                >
                  {sheet.name}
                  <span className="ml-1 text-[10px] opacity-70">({sheet.rows.length})</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {!workbook && genState === "idle" && (
          <p className="text-[13px] text-[#8a93a8]">Select one or more tickets to enable generation.</p>
        )}
      </div>
    </div>
  );
}
