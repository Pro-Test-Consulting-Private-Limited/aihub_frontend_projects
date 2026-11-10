"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbLoader2, TbBolt, TbBookmarkFilled, TbClipboardList, TbGitMerge } from "react-icons/tb";
import type { DeadFlag, SitDeadAudit, SitEpic, SitModelStatus, SitSheet, SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import { EXECUTION_STATUSES, type SitExecutionStatus } from "@/app/lib/sit-eisenhower";
import type { AtlasClient } from "@/app/services/appatlas";
import { SitCaseDrawer } from "./sit-case-drawer";
import { DeadFlagPills, DeadTestFinderStrip, filterRowsByDeadFlag } from "./sit-dead-finder";

function EpicIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#7C3AED] text-white" title="Epic">
      <TbBolt size={12} />
    </span>
  );
}

function StoryIcon() {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#16A34A] text-white" title="Story">
      <TbBookmarkFilled size={12} />
    </span>
  );
}

function filterSheetRows(
  sheet: SitSheet,
  ticketKey: string | "all",
  testType: string | null,
): SitSheet {
  let rows = sheet.rows;
  if (ticketKey !== "all") {
    rows = rows.filter(
      (r) =>
        r.cells.requirementId === ticketKey ||
        r.cells.issueKey === ticketKey ||
        (r.cells.feature || "").startsWith(ticketKey),
    );
  }
  if (testType) {
    rows = rows.filter((r) => (r.cells.testType || "").toLowerCase() === testType.toLowerCase());
  }
  return { ...sheet, rows };
}

type GenState = "idle" | "ready" | "generating" | "done" | "error";

/** Compact status light: same idea as the projects / status idle · model off tag. */
function modelBadge(model: SitModelStatus | null) {
  if (!model) return null;
  if (model.state === "up") {
    return { className: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]", dot: "bg-[#16a34a]" };
  }
  if (model.state === "idle" || model.state === "unconfigured") {
    return { className: "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]", dot: "bg-[#ef4444]" };
  }
  if (model.state === "down") {
    return { className: "border-[#fdba74] bg-[#fff7ed] text-[#c2410c]", dot: "bg-[#ea580c]" };
  }
  return { className: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]", dot: "bg-[#9ca3af]" };
}

function agoShort(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

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
        <p className="mt-2 text-[10.5px] text-[#8a93a8]">Showing 24 of {sheet.rows.length} links. Full matrix in the table.</p>
      )}
    </div>
  );
}

export function SitTestingView({
  client,
  canvasId,
  canvasName,
  focusWorkbookId,
  focusTicketKey,
  focusTestType,
}: {
  client: AtlasClient;
  canvasId: string | null;
  canvasName?: string;
  focusWorkbookId?: string | null;
  focusTicketKey?: string | null;
  focusTestType?: string | null;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [source, setSource] = useState<"jira" | "none" | "">("");
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genState, setGenState] = useState<GenState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<SitWorkbook | null>(null);
  const [history, setHistory] = useState<SitWorkbook[]>([]);
  const [activeSheetId, setActiveSheetId] = useState("test-cases");
  const [resultTicket, setResultTicket] = useState<string | "all">("all");
  const [resultType, setResultType] = useState<string | null>(null);
  const [deadFlag, setDeadFlag] = useState<DeadFlag | null>(null);
  const [deadAudit, setDeadAudit] = useState<SitDeadAudit | null>(null);
  const [deadLoading, setDeadLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [model, setModel] = useState<SitModelStatus | null>(null);
  const [caseDrawer, setCaseDrawer] = useState<{
    workbookId: string;
    ticketKey: string;
    ticketName: string;
    focusRowId: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set()); // drop any stale keys (e.g. old demo WALLET-*) when Jira list reloads
    try {
      const [res, saved] = await Promise.all([
        client.listSitTickets(canvasId),
        client.listSitWorkbooks(canvasId).catch(() => ({ items: [] as SitWorkbook[] })),
      ]);
      setEpics(res.epics);
      setSource(res.source);
      setProjectKey(res.projectKey);
      setNote(res.note ?? null);
      if (res.model) setModel(res.model);
      const open: Record<string, boolean> = {};
      res.epics.forEach((e, i) => {
        open[e.key] = i === 0;
      });
      setExpanded(open);
      const items = saved.items || [];
      setHistory(items);
      // Restore last generated results even when the HF model is off.
      if (items[0]) {
        setWorkbook(items[0]);
        setActiveSheetId(items[0].sheets[0]?.id || "test-cases");
        setResultTicket("all");
        setGenState("done");
      } else {
        setWorkbook(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [client, canvasId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep model status fresh while the tab is open (HF can scale to zero).
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const m = await client.getSitModelStatus();
        if (!cancelled) setModel(m);
      } catch {
        /* ignore probe failures */
      }
    };
    const id = setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [client]);

  const badge = modelBadge(model);
  const modelInactive = model?.state === "idle" || model?.state === "unconfigured" || model?.state === "down";

  useEffect(() => {
    setGenState(selected.size ? "ready" : "idle");
  }, [selected]);

  useEffect(() => {
    if (!focusWorkbookId || !history.length) return;
    const wb = history.find((h) => h.id === focusWorkbookId);
    if (wb) {
      setWorkbook(wb);
      setActiveSheetId(wb.sheets[0]?.id || "test-cases");
      setResultTicket(focusTicketKey || "all");
      setResultType(focusTestType || null);
      setGenState("done");
    }
  }, [focusWorkbookId, focusTicketKey, focusTestType, history]);

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

  // Dead Test Finder: refresh whenever the open workbook changes (or after generate).
  useEffect(() => {
    if (!workbook?.id) {
      setDeadAudit(null);
      setDeadFlag(null);
      return;
    }
    let cancelled = false;
    setDeadLoading(true);
    void client
      .getSitWorkbookAudit(workbook.id, canvasId)
      .then((audit) => {
        if (!cancelled) setDeadAudit(audit);
      })
      .catch(() => {
        if (!cancelled) setDeadAudit(null);
      })
      .finally(() => {
        if (!cancelled) setDeadLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, workbook?.id, workbook?.updatedAt, canvasId]);

  const rawSheet: SitSheet | null =
    workbook?.sheets.find((s) => s.id === activeSheetId) || workbook?.sheets[0] || null;
  const ticketFiltered: SitSheet | null = rawSheet ? filterSheetRows(rawSheet, resultTicket, resultType) : null;
  const activeSheet: SitSheet | null = ticketFiltered
    ? { ...ticketFiltered, rows: filterRowsByDeadFlag(ticketFiltered.rows, deadAudit, deadFlag) }
    : null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const patchExecutionStatus = async (rowId: string, executionStatus: SitExecutionStatus) => {
    if (!workbook) return;
    try {
      const next = await client.patchSitCase(workbook.id, rowId, { executionStatus });
      setWorkbook(next);
      setHistory((prev) => prev.map((h) => (h.id === next.id ? next : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  };

  const selectAll = () => setSelected(new Set(allTicketKeys));
  const clearAll = () => setSelected(new Set());

  const handleGenerate = async (useTemplate = false) => {
    const valid = new Set(allTicketKeys);
    const keys = [...selected].filter((k) => valid.has(k));
    if (keys.length !== selected.size) setSelected(new Set(keys));
    if (!keys.length) {
      setError("Select tickets from the Jira list below (stale demo keys were cleared).");
      setGenState("idle");
      return;
    }
    if (!canvasId) {
      setError("Select a canvas connected to Jira first.");
      return;
    }
    setGenState("generating");
    setError(null);
    try {
      const wb = await client.generateSitWorkbook({
        issueKeys: keys,
        canvasId,
        useTemplate,
      });
      setWorkbook(wb);
      setActiveSheetId(wb.sheets[0]?.id || "test-cases");
      setResultTicket(wb.sourceIssueKeys.length === 1 ? wb.sourceIssueKeys[0] : "all");
      setGenState("done");
      setHistory((prev) => [wb, ...prev.filter((x) => x.id !== wb.id)].slice(0, 50));
      void client.getSitModelStatus().then(setModel).catch(() => undefined);
    } catch (err) {
      setGenState("error");
      setError(err instanceof Error ? err.message : "Generation failed");
      void client.getSitModelStatus().then(setModel).catch(() => undefined);
    }
  };

  const openSaved = (wb: SitWorkbook) => {
    setWorkbook(wb);
    setActiveSheetId(wb.sheets[0]?.id || "test-cases");
    setResultTicket("all");
    setResultType(null);
    setGenState("done");
    setError(null);
  };

  const ticketKeyForRow = (row: SitSheetRow) => {
    if (row.cells.requirementId) return row.cells.requirementId;
    if (row.cells.issueKey) return row.cells.issueKey;
    const feature = row.cells.feature || "";
    return workbook?.sourceIssueKeys.find((k) => feature.startsWith(k)) || "";
  };

  const openCaseDrawer = (row: SitSheetRow) => {
    if (!workbook) return;
    const ticketKey = ticketKeyForRow(row);
    if (!ticketKey) return;
    setCaseDrawer({
      workbookId: workbook.id,
      ticketKey,
      ticketName: workbook.sourceSummaries[ticketKey] || ticketKey,
      focusRowId: row.id,
    });
  };

  const generateDisabled = !selected.size || genState === "generating" || !!modelInactive;
  const generateTitle = modelInactive
    ? "Model is not running"
    : !selected.size
      ? "Select one or more tickets"
      : undefined;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f7f8fb] dark:bg-[#0a0a0a]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEE] bg-white px-5 py-4 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-[16px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
            <TbClipboardList size={18} className="text-[#8664F2]" />
            SIT Testing
            {model && badge ? (
              <span
                title={model.detail}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {model.label}
              </span>
            ) : null}
          </h1>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">
            {canvasName ? (
              <>
                Canvas: <span className="font-medium text-[#1F1F1F] dark:text-[#ededed]">{canvasName}</span>
                {" · "}
              </>
            ) : null}
            {source === "jira" && projectKey
              ? `Jira project ${projectKey}`
              : source === "none"
                ? "Select a Jira-connected canvas in the explorer"
                : "…"}
            {selected.size ? ` · ${selected.size} selected` : ""}
            {history.length ? ` · ${history.length} saved run${history.length === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={selectAll} className="rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-[12px] dark:border-[#2a2a2a]">
            {selected.size ? `${selected.size} selected` : `Select all (${allTicketKeys.length})`}
          </button>
          <button type="button" onClick={clearAll} className="rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-[12px] dark:border-[#2a2a2a]">
            Clear
          </button>
          <span className="relative inline-flex flex-col items-end gap-1 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={generateDisabled}
              title={generateTitle}
              onClick={() => void handleGenerate(false)}
              className="rounded-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
            >
              {genState === "generating" ? (
                <span className="inline-flex items-center gap-1.5">
                  <TbLoader2 className="animate-spin" size={14} /> Generating…
                </span>
              ) : (
                `Generate Test Cases + Test Data${selected.size ? ` (${selected.size})` : ""}`
              )}
            </button>
            <button
              type="button"
              disabled={!selected.size || genState === "generating" || !canvasId}
              title="Create template cases without calling the model. Test depth will be based on template cases."
              onClick={() => void handleGenerate(true)}
              className="rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-[12px] text-[#5b647a] disabled:opacity-40 dark:border-[#2a2a2a]"
            >
              Use template
            </button>
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {(error || note) && (
          <div
            className={`mb-4 rounded-[8px] border px-3 py-2 text-[12.5px] ${
              error
                ? "border-[#f5c2c7] bg-[#fff5f5] text-[#b42318]"
                : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
            }`}
          >
            {error || note}
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

        {history.length > 0 && (
          <section className="mb-6 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
            <div className="border-b border-[#eef0f5] px-4 py-3 text-[13px] font-medium text-[#1F1F1F] dark:border-[#1a1a1a] dark:text-[#ededed]">
              Saved SIT runs
              <span className="ml-2 text-[11px] font-normal text-[#8a93a8]">kept when the model is inactive</span>
            </div>
            <ul className="divide-y divide-[#f3f4f6] dark:divide-[#1a1a1a]">
              {history.slice(0, 8).map((wb) => {
                const cases = wb.sheets.find((s) => s.kind === "test-cases")?.rows.length ?? 0;
                const active = workbook?.id === wb.id;
                return (
                  <li key={wb.id}>
                    <button
                      type="button"
                      onClick={() => openSaved(wb)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[12.5px] hover:bg-[#fafafa] dark:hover:bg-[#141414] ${
                        active ? "bg-[#f3f0ff] dark:bg-[#1c1530]" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">
                          {wb.sourceIssueKeys.join(", ")}
                        </span>
                        <span className="ml-2 text-[#8a93a8]">
                          {Object.values(wb.sourceSummaries || {})
                            .slice(0, 2)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-[#5b647a]">{cases} cases</span>
                      <span className="shrink-0 text-[11px] text-[#9ca3af]">{agoShort(wb.createdAt)}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          wb.generator === "huggingface" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f6] text-[#6b7280]"
                        }`}
                      >
                        {wb.generator}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
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
                    <EpicIcon />
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
                              <StoryIcon />
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
                    .map((k) => `${k}${workbook.sourceSummaries[k] ? `: ${workbook.sourceSummaries[k]}` : ""}`)
                    .join("; ")}
                  {" · "}Confirmed ID: <code className="text-[10.5px]">{workbook.confirmedId}</code>
                  {" · "}Generator:{" "}
                  <span className={workbook.generator === "huggingface" ? "font-semibold text-[#16a34a]" : ""}>
                    {workbook.generator}
                  </span>
                  {" · "}
                  {activeSheet.rows.length} rows
                  {resultTicket !== "all" ? ` · ${resultTicket}` : ""}
                  {resultType ? ` · ${resultType}` : ""}
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
                Hide results
              </button>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-[#eef0f5] bg-[#fafafa] px-3 py-2 dark:border-[#1a1a1a] dark:bg-[#141414]">
              <button
                type="button"
                onClick={() => setResultTicket("all")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  resultTicket === "all" ? "bg-[#8664F2] text-white" : "bg-white text-[#5b647a] border border-[#e2e6ef]"
                }`}
              >
                All tickets
              </button>
              {workbook.sourceIssueKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setResultTicket(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    resultTicket === k ? "bg-[#8664F2] text-white" : "bg-white text-[#5b647a] border border-[#e2e6ef]"
                  }`}
                  title={workbook.sourceSummaries[k] || k}
                >
                  {k}
                </button>
              ))}
              {resultType ? (
                <button
                  type="button"
                  onClick={() => setResultType(null)}
                  className="rounded-full border border-[#f5c2c7] bg-[#fff5f5] px-2.5 py-1 text-[11px] font-medium text-[#b91c1c]"
                  title="Clear type filter"
                >
                  Type: {resultType} ×
                </button>
              ) : null}
            </div>

            <DeadTestFinderStrip
              audit={deadAudit}
              loading={deadLoading}
              activeFlag={deadFlag}
              onFlag={setDeadFlag}
            />

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
                        <span className="inline-flex items-center gap-1">
                          {col.name}
                          {col.id === "priority" || col.id === "severity" ? (
                            <span
                              title="AI-assisted estimate. Review before relying on it."
                              className="rounded border border-white/30 bg-white/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-white"
                            >
                              beta
                            </span>
                          ) : null}
                        </span>
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
                          {col.id === "executionStatus" ? (
                            <select
                              className="rounded-[6px] border border-[#e2e6ef] bg-white px-1.5 py-1 text-[11.5px] text-[#1F1F1F] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]"
                              value={(row.cells.executionStatus as SitExecutionStatus) || "Draft"}
                              onChange={(e) => void patchExecutionStatus(row.id, e.target.value as SitExecutionStatus)}
                              title="Manual execution status"
                            >
                              {EXECUTION_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : col.id === "testType" || col.id === "coverage" ? (
                            <TypePill value={row.cells[col.id] || ""} />
                          ) : col.id === "priority" || col.id === "severity" ? (
                            <button
                              type="button"
                              title={row.cells.why || undefined}
                              onClick={() => openCaseDrawer(row)}
                              className="text-left underline decoration-dotted decoration-[#c4b5fd] underline-offset-2 hover:text-[#8664F2]"
                            >
                              {row.cells[col.id] || "-"}
                            </button>
                          ) : col.id === "scenario" || col.id === "requirementId" || col.id === "tcId" ? (
                            <div>
                              {row.cells[col.id] ?? ""}
                              {(col.id === "scenario" || col.id === "tcId") && (
                                <DeadFlagPills hits={deadAudit?.flagsByRowId[row.id]} />
                              )}
                            </div>
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

        {!workbook && !history.length && genState === "idle" && (
          <p className="text-[13px] text-[#8a93a8]">
            Select a Jira-connected canvas, then pick tickets to generate, or open a saved run above once you have one.
          </p>
        )}
      </div>
      {caseDrawer ? (
        <SitCaseDrawer
          client={client}
          workbookId={caseDrawer.workbookId}
          ticketKey={caseDrawer.ticketKey}
          ticketName={caseDrawer.ticketName}
          focusRowId={caseDrawer.focusRowId}
          modelInactive={!!modelInactive}
          canvasId={canvasId}
          onClose={() => setCaseDrawer(null)}
          onChanged={(wb) => {
            setWorkbook(wb);
            setHistory((prev) => prev.map((h) => (h.id === wb.id ? wb : h)));
          }}
        />
      ) : null}
    </div>
  );
}
