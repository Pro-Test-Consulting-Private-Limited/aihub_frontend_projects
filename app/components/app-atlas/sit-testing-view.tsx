"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbLoader2, TbBolt, TbClipboardList } from "react-icons/tb";
import type { SitEpic, SitSheet, SitWorkbook } from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";

type GenState = "idle" | "ready" | "generating" | "done" | "error";

function statusColor(cat: string) {
  if (cat === "done") return "bg-[#d1fae5] text-[#065f46]";
  if (cat === "indeterminate") return "bg-[#fef3c7] text-[#92400e]";
  return "bg-[#e5e7eb] text-[#374151] dark:bg-[#2a2a2a] dark:text-[#9ca3af]";
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
    setGenState(selectedKey ? "ready" : "idle");
  }, [selectedKey]);

  const selectedLabel = useMemo(() => {
    if (!selectedKey) return null;
    for (const e of epics) {
      const t = e.tickets.find((x) => x.key === selectedKey);
      if (t) return `${t.key}: ${t.summary}`;
    }
    return selectedKey;
  }, [epics, selectedKey]);

  const activeSheet: SitSheet | null =
    workbook?.sheets.find((s) => s.id === activeSheetId) || workbook?.sheets[0] || null;

  const handleGenerate = async () => {
    if (!selectedKey) return;
    setGenState("generating");
    setError(null);
    try {
      const wb = await client.generateSitWorkbook({ issueKey: selectedKey, canvasId });
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
            Select one Jira story, then generate test cases and test data. Spreadsheet columns are
            provisional until design finalizes names. Traceability sheet is a placeholder for the
            later mind-map.
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
          </p>
        </div>
        <button
          type="button"
          disabled={!selectedKey || genState === "generating"}
          onClick={() => void handleGenerate()}
          className="rounded-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
        >
          {genState === "generating" ? (
            <span className="inline-flex items-center gap-1.5">
              <TbLoader2 className="animate-spin" size={14} /> Generating…
            </span>
          ) : (
            "Generate Test Cases + Test Data"
          )}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 rounded-[8px] border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[12.5px] text-[#b42318]">
            {error}
          </div>
        )}

        {selectedLabel && (
          <div className="mb-3 text-[13px] text-[#374151] dark:text-[#9ca3af]">
            Selected: <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{selectedLabel}</span>
            <button type="button" className="ml-2 text-[12px] text-[#8664F2]" onClick={() => setSelectedKey(null)}>
              Clear
            </button>
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
                        const on = selectedKey === t.key;
                        return (
                          <li key={t.key}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 border-t border-[#f3f4f6] py-2.5 pr-4 pl-12 text-[13px] dark:border-[#1a1a1a] ${
                                on ? "bg-[#f3f0ff] dark:bg-[#1c1530]" : "hover:bg-[#f9fafb] dark:hover:bg-[#141414]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="sit-ticket"
                                checked={on}
                                onChange={() => setSelectedKey(t.key)}
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
                  {" · "}Generator: {workbook.generator}
                </div>
              </div>
              <button
                type="button"
                className="text-[12px] text-[#8664F2]"
                onClick={() => {
                  setWorkbook(null);
                  setGenState(selectedKey ? "ready" : "idle");
                }}
              >
                Back to ticket list
              </button>
            </div>

            {activeSheet.kind === "traceability" && activeSheet.traceabilityNote && (
              <div className="mx-4 mt-3 rounded-[8px] border border-dashed border-[#cfd5e4] bg-[#fafafa] px-3 py-2 text-[11.5px] text-[#5b647a] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#9ca3af]">
                {activeSheet.traceabilityNote}
              </div>
            )}

            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-full border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-[#f8f9fc] dark:bg-[#141414]">
                  <tr>
                    {activeSheet.columns.map((col) => (
                      <th
                        key={col.id}
                        className="whitespace-nowrap border-b border-[#e5e7eb] px-3 py-2 text-left text-[11px] font-semibold text-[#5b647a] dark:border-[#1a1a1a] dark:text-[#9ca3af]"
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
                          className="max-w-[280px] border-b border-[#f3f4f6] px-3 py-2 align-top whitespace-pre-wrap text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]"
                        >
                          {row.cells[col.id] ?? ""}
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
                </button>
              ))}
            </div>
          </section>
        )}

        {!workbook && genState === "idle" && (
          <p className="text-[13px] text-[#8a93a8]">Select a single ticket to enable generation (Phase 1).</p>
        )}
      </div>
    </div>
  );
}
