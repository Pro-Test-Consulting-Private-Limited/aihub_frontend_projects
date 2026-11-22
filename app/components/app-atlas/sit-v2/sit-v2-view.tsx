"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TbClipboardList, TbLoader2, TbPlus } from "react-icons/tb";
import type {
  CanvasClarification,
  SitDeadAudit,
  SitEpic,
  SitModelStatus,
  SitSheetRow,
  SitTicket,
  SitWorkbook,
} from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import {
  DeadTestFinderToolbar,
  filterRowsByDeadFlag,
  QualityActiveChip,
  type QualityFilter,
} from "../sit-dead-finder";
import { SitV2Picker } from "./sit-v2-picker";
import { SitV2GenerateDialog, type TicketGenChoice } from "./sit-v2-generate-dialog";
import { SitV2Grid } from "./sit-v2-grid";
import { SitV2AcChip } from "./sit-v2-ac-chip";
import { SitV2Select } from "./sit-v2-select";
import {
  defaultLayout,
  loadColumnLayout,
  saveColumnLayout,
  resetColumnLayout,
  moveColumnInOrder,
  SIT_OPTIONAL_COLUMNS,
  SIT_DEFAULT_ORDER,
  type SitColumnId,
  type SitColumnLayout,
  type SitOrderableColumnId,
} from "./sit-v2-prefs";
import {
  buildXlsxBlob,
  downloadBlob,
  toCopyTable,
  toCsv,
  type ExportScope,
} from "@/app/lib/sit-export";

function modelLabel(model: SitModelStatus | null) {
  if (!model) return "Unknown";
  if (model.state === "up") return "Ready";
  if (model.state === "idle") return "Warming up";
  if (model.state === "unconfigured") return "Not configured";
  if (model.state === "down") return "Down";
  return model.label || "Unknown";
}

type Progress = Record<string, { status: string; count: number; message?: string }>;

export function SitTestingViewV2({
  client,
  canvasId,
  canvasName,
  projectName,
  canEdit = true,
}: {
  client: AtlasClient;
  canvasId: string | null;
  canvasName?: string;
  projectName?: string;
  /** Owner (or admin) may edit; others get a View-only grid. */
  canEdit?: boolean;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [model, setModel] = useState<SitModelStatus | null>(null);
  const [selected, setSelected] = useState<SitTicket[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [workbook, setWorkbook] = useState<SitWorkbook | null>(null);
  const [history, setHistory] = useState<SitWorkbook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [genDialog, setGenDialog] = useState<TicketGenChoice[] | null>(null);
  const [clarifications, setClarifications] = useState<CanvasClarification[]>([]);
  const [ticketFilter, setTicketFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [undoRow, setUndoRow] = useState<{ workbookId: string; rowId: string } | null>(null);
  const [deadFlag, setDeadFlag] = useState<QualityFilter>(null);
  const [deadAudit, setDeadAudit] = useState<SitDeadAudit | null>(null);
  const [deadLoading, setDeadLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [columnLayout, setColumnLayout] = useState<SitColumnLayout>(() => defaultLayout());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const firstRowAt = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tickets, saved] = await Promise.all([
        client.listSitTickets(canvasId),
        client.listSitWorkbooks(canvasId).catch(() => ({ items: [] as SitWorkbook[] })),
      ]);
      setEpics(tickets.epics);
      setProjectKey(tickets.projectKey);
      setNote(tickets.note ?? null);
      if (tickets.model) setModel(tickets.model);
      setHistory(saved.items || []);
      if (saved.items?.[0] && !workbook) setWorkbook(saved.items[0]);
      if (canvasId) {
        client.getClarifications(canvasId).then((c) => setClarifications(c.items || [])).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [client, canvasId, workbook]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only when canvas changes
  }, [client, canvasId]);

  useEffect(() => {
    setColumnLayout(loadColumnLayout(canvasId));
  }, [canvasId]);

  const persistLayout = useCallback(
    (next: SitColumnLayout) => {
      setColumnLayout(next);
      saveColumnLayout(canvasId, next);
    },
    [canvasId],
  );

  useEffect(() => {
    const id = setInterval(() => {
      client.getSitModelStatus().then(setModel).catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [client]);

  useEffect(() => {
    if (!undoRow) return;
    const t = setTimeout(() => setUndoRow(null), 10_000);
    return () => clearTimeout(t);
  }, [undoRow]);

  useEffect(() => {
    if (!workbook?.id || workbook.id === "pending") {
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

  const activateTicket = (key: string) => {
    setTicketFilter(key);
    const match = history.find((h) => h.sourceIssueKeys.includes(key));
    if (match) setWorkbook(match);
    const all = epics.flatMap((e) => e.tickets);
    const t = all.find((x) => x.key === key);
    if (t && !selected.some((s) => s.key === key)) setSelected((s) => [...s, t]);
  };

  const modelReady = model?.state === "up";
  const startGenerate = async (choices: TicketGenChoice[]) => {
    if (!canvasId) {
      setError("Select a Jira-connected canvas first.");
      return;
    }
    if (!modelReady) {
      setError("Model is warming up. Generate is disabled until the model is Ready.");
      return;
    }
    setGenDialog(null);
    setGenerating(true);
    setError(null);
    setProgress({});
    firstRowAt.current = null;
    const started = Date.now();
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    // Seed skeleton workbook
    setWorkbook((prev) =>
      prev
        ? prev
        : ({
            id: "pending",
            canvasId,
            confirmedId: "",
            sourceIssueKeys: choices.map((c) => c.issueKey),
            sourceSummaries: {},
            status: "running",
            error: null,
            generator: "huggingface",
            sheets: [
              {
                id: "test-cases",
                name: "Test Cases",
                kind: "test-cases",
                columns: [],
                rows: [],
              },
            ],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdBy: { id: "", name: "" },
          } as SitWorkbook),
    );

    try {
      await client.streamSitGenerate(
        {
          canvasId,
          tickets: choices.map((c) => ({
            issueKey: c.issueKey,
            mode: c.mode === "template" ? "new" : c.mode,
            workbookId: c.workbookId,
          })),
          useTemplate: false,
        },
        (event, data) => {
          const d = data as Record<string, unknown>;
          if (event === "ticket_started") {
            setProgress((p) => ({
              ...p,
              [String(d.issueKey)]: { status: "generating", count: 0 },
            }));
          } else if (event === "case") {
            if (firstRowAt.current == null) {
              firstRowAt.current = Date.now() - started;
              console.info(`[sit-v2] time-to-first-row ${firstRowAt.current}ms`);
            }
            const row = d.row as SitSheetRow;
            const issueKey = String(d.issueKey);
            setProgress((p) => ({
              ...p,
              [issueKey]: { status: "generating", count: Number(d.index) || (p[issueKey]?.count || 0) + 1 },
            }));
            setWorkbook((prev) => {
              if (!prev) return prev;
              const sheets = prev.sheets.map((s) => {
                if (s.kind !== "test-cases") return s;
                if (s.rows.some((r) => r.id === row.id)) return s;
                return { ...s, rows: [...s.rows, row] };
              });
              return { ...prev, sheets, status: "running" };
            });
          } else if (event === "ticket_done") {
            setProgress((p) => ({
              ...p,
              [String(d.issueKey)]: { status: "done", count: Number(d.caseCount) || 0 },
            }));
          } else if (event === "assessed") {
            const rows = Array.isArray(d.rows) ? (d.rows as SitSheetRow[]) : [];
            if (rows.length) {
              const byId = new Map(rows.map((r) => [r.id, r]));
              setWorkbook((prev) => {
                if (!prev) return prev;
                const sheets = prev.sheets.map((s) => {
                  if (s.kind !== "test-cases") return s;
                  return { ...s, rows: s.rows.map((r) => byId.get(r.id) || r) };
                });
                return { ...prev, sheets };
              });
            }
          } else if (event === "ticket_error") {
            setProgress((p) => ({
              ...p,
              [String(d.issueKey)]: { status: "error", count: 0, message: String(d.message || "error") },
            }));
          } else if (event === "workbook") {
            setWorkbook(d as unknown as SitWorkbook);
          } else if (event === "error") {
            setError(String(d.message || "Generation failed"));
          } else if (event === "done") {
            const ms = Number(d.ms) || Date.now() - started;
            console.info(`[sit-v2] generate done ok=${d.ok} total=${ms}ms firstRow=${firstRowAt.current}ms`);
          }
        },
        ac.signal,
      );
      await load();
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    } finally {
      setGenerating(false);
    }
  };

  const onClickGenerate = () => {
    if (!selected.length) return;
    if (!modelReady) {
      setError("Model is warming up. Generate is disabled until the model is Ready.");
      return;
    }
    const choices: TicketGenChoice[] = selected.map((t) => {
      const gen = t.generation;
      if (gen && gen.caseCount > 0) {
        return {
          issueKey: t.key,
          mode: "append" as const,
          workbookId: gen.workbookId,
          hasExisting: true,
          caseCount: gen.caseCount,
        };
      }
      return { issueKey: t.key, mode: "new" as const, hasExisting: false, caseCount: 0 };
    });
    if (choices.some((c) => c.hasExisting)) {
      setGenDialog(choices);
      return;
    }
    void startGenerate(choices);
  };

  const [saveRetry, setSaveRetry] = useState<{
    rowId: string;
    body: Parameters<AtlasClient["patchSitCase"]>[2];
    label: string;
  } | null>(null);

  const patchRow = async (
    rowId: string,
    body: Parameters<AtlasClient["patchSitCase"]>[2],
    opts?: { label?: string },
  ) => {
    if (!workbook || workbook.id === "pending") return;
    setSaveState("saving");
    const label =
      opts?.label ||
      (body.testType || body.cells?.testType
        ? "Scenario type"
        : body.priority
          ? "Priority"
          : body.severity
            ? "Severity"
            : body.executionStatus
              ? "Status"
              : body.cells
                ? Object.keys(body.cells)[0] || "field"
                : "case");
    try {
      const next = await client.patchSitCase(workbook.id, rowId, body);
      setWorkbook(next);
      setSaveState("saved");
      setSaveRetry(null);
      setError(null);
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("error");
      console.error("[sit-v2] patch failed", { rowId, body, err });
      setSaveRetry({ rowId, body, label });
      setError(`Could not save ${label}. Retry`);
    }
  };

  const softDelete = async (rowId: string) => {
    if (!workbook) return;
    await patchRow(rowId, { softDelete: true });
    setUndoRow({ workbookId: workbook.id, rowId });
  };

  const undoDelete = async () => {
    if (!undoRow) return;
    await client.patchSitCase(undoRow.workbookId, undoRow.rowId, { undelete: true }).then(setWorkbook);
    setUndoRow(null);
  };

  const addRow = async () => {
    if (!workbook || workbook.id === "pending") return;
    const ticketKey =
      ticketFilter !== "all" ? ticketFilter : workbook.sourceIssueKeys[0] || selected[0]?.key;
    if (!ticketKey) {
      setError("Select a ticket filter (or tickets) before adding a row.");
      return;
    }
    const res = await client.addSitCase(workbook.id, ticketKey);
    setWorkbook(res.workbook);
  };

  const duplicateRow = async (rowId: string) => {
    if (!workbook || workbook.id === "pending") return;
    const src = workbook.sheets
      .find((s) => s.kind === "test-cases")
      ?.rows.find((r) => r.id === rowId);
    if (!src) return;
    const ticketKey = src.cells.requirementId || src.cells.issueKey;
    if (!ticketKey) {
      setError("Cannot duplicate: row has no ticket key.");
      return;
    }
    try {
      const res = await client.addSitCase(workbook.id, ticketKey);
      const newId = res.row?.id;
      if (!newId) {
        setWorkbook(res.workbook);
        return;
      }
      const copyCells: Record<string, string> = {};
      for (const [k, v] of Object.entries(src.cells)) {
        if (["caseId", "tcId", "origin", "edited", "deleted", "executionStatus", "statusBy", "statusAt"].includes(k)) {
          continue;
        }
        if (typeof v === "string") copyCells[k] = v;
      }
      copyCells.scenario = `${src.cells.scenario || "Scenario"} (copy)`;
      const next = await client.patchSitCase(workbook.id, newId, { cells: copyCells });
      setWorkbook(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const displayWorkbook = useMemo(() => {
    if (!workbook || !deadFlag || !deadAudit) return workbook;
    return {
      ...workbook,
      sheets: workbook.sheets.map((s) =>
        s.kind !== "test-cases"
          ? s
          : { ...s, rows: filterRowsByDeadFlag(s.rows, deadAudit, deadFlag) },
      ),
    };
  }, [workbook, deadFlag, deadAudit]);

  /** R7-03: Showing N of M in toolbar (same filters as grid). */
  const toolbarTotalCount = useMemo(() => {
    return (
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1").length ?? 0
    );
  }, [workbook]);
  const toolbarShownCount = useMemo(() => {
    let list =
      displayWorkbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") ||
      [];
    if (ticketFilter !== "all") {
      list = list.filter((r) => r.cells.requirementId === ticketFilter || r.cells.issueKey === ticketFilter);
    }
    if (typeFilter) list = list.filter((r) => (r.cells.testType || "") === typeFilter);
    if (statusFilter) list = list.filter((r) => (r.cells.executionStatus || "Not run") === statusFilter);
    if (originFilter === "edited") list = list.filter((r) => r.cells.edited === "1" && r.cells.origin !== "human");
    else if (originFilter) list = list.filter((r) => (r.cells.origin || "ai") === originFilter);
    if (search.trim()) {
      const n = search.toLowerCase();
      list = list.filter((r) =>
        [r.cells.caseId, r.cells.scenario, r.cells.steps, r.cells.expected, r.cells.feature]
          .join(" ")
          .toLowerCase()
          .includes(n),
      );
    }
    return list.length;
  }, [displayWorkbook, ticketFilter, typeFilter, statusFilter, originFilter, search]);

  const counts = useMemo(() => {
    const rows =
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    let ai = 0;
    let human = 0;
    let edited = 0;
    let template = 0;
    const byStatus: Record<string, number> = {
      Draft: 0,
      "Not run": 0,
      Passed: 0,
      Failed: 0,
      Partial: 0,
      Blocked: 0,
      Skipped: 0,
      Stale: 0,
    };
    for (const r of rows) {
      if (r.cells.origin === "human") human++;
      else if (r.cells.origin === "template") template++;
      else ai++;
      // Edited = AI row changed by a person (never human / legacy template)
      if (
        r.cells.edited === "1" &&
        r.cells.origin !== "human" &&
        r.cells.origin !== "template"
      ) {
        edited++;
      }
      const st = r.cells.executionStatus || "Not run";
      if (st in byStatus) byStatus[st]!++;
      else byStatus["Not run"]!++;
    }
    return {
      total: rows.length,
      ai,
      human,
      edited,
      template,
      Draft: byStatus.Draft,
      Blocked: byStatus.Blocked,
      Skipped: byStatus.Skipped,
      Stale: byStatus.Stale,
      passed: byStatus.Passed,
      failed: byStatus.Failed,
      partial: byStatus.Partial,
      notRun: byStatus["Not run"],
    };
  }, [workbook]);

  const metaProject = projectName || projectKey || ", ";
  const metaModule = canvasName || ", ";
  const activeTicketKey = ticketFilter !== "all" ? ticketFilter : workbook?.sourceIssueKeys?.[0] || null;

  const activeAcs = useMemo(() => {
    if (!activeTicketKey) return [] as string[];
    const t = epics.flatMap((e) => e.tickets).find((x) => x.key === activeTicketKey);
    return t?.acceptanceCriteria || [];
  }, [activeTicketKey, epics]);

  const activeRows = useMemo(() => {
    const rows =
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    if (!activeTicketKey) return rows;
    return rows.filter((r) => r.cells.requirementId === activeTicketKey);
  }, [workbook, activeTicketKey]);

  const runExport = async (kind: "xlsx" | "csv" | "copy", scope: ExportScope) => {
    if (!workbook || workbook.id === "pending") return;
    setExportOpen(false);
    const acByTicket: Record<string, string[]> = {};
    for (const t of epics.flatMap((e) => e.tickets)) {
      if (t.acceptanceCriteria?.length) acByTicket[t.key] = t.acceptanceCriteria;
    }
    const viewRows =
      displayWorkbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") ||
      [];
    try {
      if (kind === "xlsx") {
        const { blob, filename } = await buildXlsxBlob(workbook, {
          scope,
          viewRows,
          selectedKeys: selected.map((s) => s.key),
          projectName: metaProject,
          canvasName: metaModule,
          acByTicket,
        });
        downloadBlob(blob, filename);
      } else if (kind === "csv") {
        const { casesForExport } = await import("@/app/lib/sit-export");
        const rows = casesForExport(workbook, {
          scope,
          viewRows,
          selectedKeys: selected.map((s) => s.key),
        });
        const csv = toCsv(rows);
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SIT_${metaProject}_${metaModule}.csv`);
      } else {
        const { casesForExport } = await import("@/app/lib/sit-export");
        const rows = casesForExport(workbook, {
          scope,
          viewRows,
          selectedKeys: selected.map((s) => s.key),
        });
        await navigator.clipboard.writeText(toCopyTable(rows));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fb] font-sans antialiased dark:bg-[#0a0a0a] [&_button]:font-[inherit] [&_input]:font-[inherit] [&_select]:font-[inherit] [&_textarea]:font-[inherit]">
      {/* Toolbar + meta only (matches designer mock) */}
      <div className="shrink-0 border-b border-[#EEE] bg-white px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">
              <TbClipboardList className="text-[#8664F2]" size={18} />
              SIT Testing
            </span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-[8px] border border-[#e2e6ef] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#1F1F1F] transition hover:bg-[#fafafa] dark:border-[#2a2a2a] dark:bg-[#141414] dark:text-[#ededed]"
            >
              Jira Tickets
              {selected.length ? ` (${selected.length})` : ""}
            </button>
            {!canEdit && (
              <span
                className="inline-flex items-center rounded-full border border-[#e2e6ef] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#6b7280]"
                title="You can view this canvas but only the owner can edit test cases."
                data-testid="sit-toolbar-view-only"
              >
                View only
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                if (!selected.length && !workbook) return;
                if (true) { // soft clear ,  no native confirm (U12)
                  setSelected([]);
                  setWorkbook(null);
                  setTicketFilter("all");
                }
              }}
              className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[12.5px] text-[#5b647a] dark:border-[#2a2a2a]"
            >
              Clear All
            </button>
            {workbook && workbook.id !== "pending" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportOpen((v) => !v)}
                  className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[12.5px] font-medium text-[#1F1F1F] dark:border-[#2a2a2a] dark:text-[#ededed]"
                >
                  Export
                </button>
                {exportOpen && (
                  <div className="absolute left-0 z-30 mt-1 w-56 rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[12px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase text-[#8a93a8]">Excel</div>
                    {(["view", "selected", "all"] as ExportScope[]).map((scope) => (
                      <button
                        key={`x-${scope}`}
                        type="button"
                        className="block w-full px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
                        onClick={() => void runExport("xlsx", scope)}
                      >
                        .xlsx ({scope})
                      </button>
                    ))}
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase text-[#8a93a8]">CSV</div>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
                      onClick={() => void runExport("csv", "view")}
                    >
                      CSV (current view)
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
                      onClick={() => void runExport("copy", "view")}
                    >
                      Copy as table
                    </button>
                  </div>
                )}
              </div>
            )}
            {workbook && workbook.id !== "pending" && (
              <DeadTestFinderToolbar
                audit={deadAudit}
                loading={deadLoading}
                activeFlag={deadFlag}
                onFlag={setDeadFlag}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              title={model?.detail}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                modelReady
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                  : "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
              }`}
            >
              Model · {modelLabel(model)}
            </span>
            <button
              type="button"
              disabled={!selected.length || generating || !modelReady}
              title={
                !selected.length
                  ? "Select tickets first"
                  : !modelReady
                    ? "Model is warming up"
                    : selected.map((t) => t.key).join(", ")
              }
              onClick={() => onClickGenerate()}
              className="rounded-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              data-testid="sit-generate-btn"
            >
              {generating ? (
                <span className="inline-flex items-center gap-1.5">
                  <TbLoader2 className="animate-spin" size={14} /> Generating…
                </span>
              ) : selected.length === 0 ? (
                "Generate"
              ) : selected.length === 1 ? (
                "Generate for 1 ticket"
              ) : (
                `Generate for ${selected.length} tickets`
              )}
            </button>
            {generating && (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-[8px] border border-[#f5c2c7] px-3 py-1.5 text-[12px] text-[#b91c1c]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#6b7280]">
          <span>
            Project Name: <strong className="text-[#1F1F1F] dark:text-[#ededed]">{metaProject}</strong>
          </span>
          <span>
            Module Tested: <strong className="text-[#1F1F1F] dark:text-[#ededed]">{metaModule}</strong>
          </span>
          <span>
            Testing Type: <strong className="text-[#1F1F1F] dark:text-[#ededed]">SIT</strong>
          </span>
          {generating && Object.keys(progress).length > 0 && (
            <span className="text-[#5b21b6]">
              {Object.entries(progress)
                .map(([k, v]) =>
                  v.status === "done"
                    ? `${k} done (${v.count})`
                    : v.status === "error"
                      ? `${k} error`
                      : `${k} ${v.count}…`,
                )
                .join(" · ")}
            </span>
          )}
          {saveState !== "idle" && (
            <span className="ml-auto text-[#8664F2]">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save failed ,  retry edit"}
            </span>
          )}
          {(error || note) && (
            <span
              className={`ml-auto inline-flex max-w-lg flex-wrap items-center gap-2 text-[12px] ${
                error ? "text-[#b42318]" : "text-[#92400e]"
              }`}
              data-testid="sit-error-banner"
              title={note || undefined}
            >
              <span>{error || note}</span>
              {error && saveRetry && (
                <button
                  type="button"
                  className="rounded-[6px] border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 font-semibold text-[#991b1b]"
                  data-testid="sit-save-retry"
                  onClick={() => {
                    const r = saveRetry;
                    setSaveRetry(null);
                    void patchRow(r.rowId, r.body, { label: r.label });
                  }}
                >
                  Retry
                </button>
              )}
              {error && (
                <button type="button" className="underline" onClick={() => { setError(null); setSaveRetry(null); }}>
                  dismiss
                </button>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#8a93a8]">
            <TbLoader2 className="animate-spin" /> Loading…
          </div>
        ) : displayWorkbook ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {/* Compact in-grid chrome: ticket chips + filters (not a Saved-runs list) */}
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTicketFilter("all")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  ticketFilter === "all" ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                }`}
              >
                All
              </button>
              {(displayWorkbook.sourceIssueKeys || []).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTicketFilter(k)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                    ticketFilter === k ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                  }`}
                >
                  {k}
                </button>
              ))}
              <QualityActiveChip audit={deadAudit} activeFlag={deadFlag} onClear={() => setDeadFlag(null)} />
              <SitV2Select
                value={typeFilter || ""}
                placeholder="Type"
                aria-label="Filter by type"
                data-testid="sit-type-filter"
                options={[
                  { value: "", label: "Type" },
                  ...["Positive", "Negative", "Boundary", "Business Rule", "Concurrency", "Security"].map((t) => ({
                    value: t,
                    label: t,
                  })),
                ]}
                onChange={(v) => setTypeFilter(v || null)}
              />
              <SitV2Select
                value={statusFilter || ""}
                placeholder="Status"
                aria-label="Filter by status"
                data-testid="sit-status-filter"
                options={[
                  { value: "", label: "Status" },
                  ...[
                    "Draft",
                    "Not run",
                    "Passed",
                    "Failed",
                    "Partial",
                    "Blocked",
                    "Skipped",
                    "Stale",
                  ].map((t) => ({ value: t, label: t })),
                ]}
                onChange={(v) => setStatusFilter(v || null)}
              />
              <div
                className="inline-flex flex-wrap items-center gap-0.5 rounded-[8px] border border-[#e2e6ef] bg-white p-0.5 dark:border-[#2a2a2a] dark:bg-[#141414]"
                role="group"
                aria-label="Origin filter with counts"
                data-testid="sit-origin-filter-chips"
              >
                {(
                  [
                    { id: null as string | null, label: "All", n: counts.total, always: true },
                    { id: "ai", label: "AI", n: counts.ai, always: false },
                    { id: "human", label: "Human", n: counts.human, always: false },
                    ...(counts.template
                      ? [{ id: "template" as const, label: "Legacy", n: counts.template, always: false }]
                      : []),
                    { id: "edited", label: "Edited", n: counts.edited, always: false },
                  ] as { id: string | null; label: string; n: number; always: boolean }[]
                )
                  .filter((o) => o.always || o.n > 0)
                  .map((o) => {
                    const active = (originFilter || null) === o.id;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        title={
                          o.id === "edited"
                            ? "Edited = an AI row changed by a person"
                            : o.id === "template"
                              ? "Legacy = old template rows"
                              : o.id === "ai"
                                ? "Generated by AI"
                                : o.id === "human"
                                  ? "Added by a person"
                                  : "All cases"
                        }
                        className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium transition ${
                          active
                            ? "bg-[#f3f0ff] text-[#5b21b6]"
                            : "text-[#5b647a] hover:bg-[#f8fafc]"
                        }`}
                        aria-pressed={active}
                        onClick={() => setOriginFilter(o.id)}
                      >
                        {o.label} {o.n}
                      </button>
                    );
                  })}
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-28 rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
              />
              {activeTicketKey && activeAcs.length > 0 && (
                <SitV2AcChip
                  acs={activeAcs}
                  rows={activeRows}
                  onGenerateMissing={() => {
                    const t = epics.flatMap((e) => e.tickets).find((x) => x.key === activeTicketKey);
                    if (!t) return;
                    void startGenerate([{ issueKey: t.key, mode: "append", workbookId: workbook?.id, hasExisting: true, caseCount: activeRows.length }]);
                  }}
                />
              )}
              {activeTicketKey &&
                (() => {
                  const missing = [
                    ...new Set(
                      activeRows
                        .map((r) => (r.cells.missingTypes || "").split(",").map((s) => s.trim()).filter(Boolean))
                        .flat(),
                    ),
                  ];
                  if (!missing.length) return null;
                  return (
                    <button
                      type="button"
                      data-testid="sit-missing-types-chip"
                      title={`Applicable types still missing: ${missing.join(", ")}`}
                      className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-2.5 py-0.5 text-[11px] font-medium text-[#92400e]"
                      onClick={() => {
                        const t = epics.flatMap((e) => e.tickets).find((x) => x.key === activeTicketKey);
                        if (!t) return;
                        void startGenerate([
                          {
                            issueKey: t.key,
                            mode: "append",
                            workbookId: workbook?.id,
                            hasExisting: true,
                            caseCount: activeRows.length,
                          },
                        ]);
                      }}
                    >
                      Missing: {missing.join(", ")} · Generate for missing
                    </button>
                  );
                })()}
              {activeTicketKey &&
                epics.flatMap((e) => e.tickets).find((x) => x.key === activeTicketKey)?.hasScreenContext ===
                  false && (
                  <span
                    className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-2.5 py-0.5 text-[11px] font-medium text-[#92400e]"
                    title="This ticket is not mapped to a canvas screen"
                    data-testid="sit-no-screen-chip"
                  >
                    No mapped screen: steps may be less specific
                  </span>
                )}
              {/* B2: counts live on the origin filter chips above ,  no second set */}
              {(() => {
                const runStatuses = [
                  { id: "Draft", n: counts.Draft || 0, color: "#6366f1" },
                  { id: "Not run", n: counts.notRun || 0, color: "#9ca3af" },
                  { id: "Passed", n: counts.passed || 0, color: "#059669" },
                  { id: "Failed", n: counts.failed || 0, color: "#dc2626" },
                  { id: "Partial", n: counts.partial || 0, color: "#ea580c" },
                  { id: "Blocked", n: counts.Blocked || 0, color: "#db2777" },
                  { id: "Skipped", n: counts.Skipped || 0, color: "#6b7280" },
                  { id: "Stale", n: counts.Stale || 0, color: "#ca8a04" },
                ];
                const runDone =
                  (counts.passed || 0) +
                  (counts.failed || 0) +
                  (counts.partial || 0) +
                  (counts.Blocked || 0) +
                  (counts.Skipped || 0);
                const total = counts.total || 0;
                return (
                  <div
                    className="inline-flex flex-wrap items-center gap-2 text-[11px]"
                    data-testid="sit-status-bar"
                    title="Draft = unfinished row. Edited = an AI row changed by a person."
                  >
                    <span className="font-medium text-[#374151]">
                      {runDone} of {total} run
                    </span>
                    <div className="flex h-2 w-28 overflow-hidden rounded-full bg-[#e5e7eb]" aria-hidden>
                      {runStatuses
                        .filter((s) => s.n > 0 && s.id !== "Draft" && s.id !== "Not run")
                        .map((s) => (
                          <div
                            key={s.id}
                            style={{ width: `${total ? (s.n / total) * 100 : 0}%`, background: s.color }}
                            title={`${s.id}: ${s.n}`}
                          />
                        ))}
                    </div>
                    {runStatuses
                      .filter((s) => s.n > 0)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className={`rounded-full border px-2 py-0.5 ${
                            statusFilter === s.id
                              ? "border-[#8664F2] bg-[#f3f0ff] text-[#5b21b6]"
                              : "border-[#e2e6ef] bg-white text-[#5b647a]"
                          }`}
                          title={
                            s.id === "Draft"
                              ? "Draft = unfinished row"
                              : s.id === "Not run"
                                ? "Not run yet"
                                : undefined
                          }
                          onClick={() => setStatusFilter(statusFilter === s.id ? null : s.id)}
                        >
                          {s.id} {s.n}
                        </button>
                      ))}
                  </div>
                );
              })()}
              <span
                className="text-[12px] text-[#5b647a]"
                data-testid="sit-toolbar-showing-count"
              >
                Showing {toolbarShownCount} of {toolbarTotalCount} cases
              </span>
              <div className="relative">
                <button
                  type="button"
                  className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[11px] dark:border-[#2a2a2a]"
                  onClick={() => setColumnsOpen((v) => !v)}
                  data-testid="sit-columns-menu"
                >
                  Columns
                </button>
                {columnsOpen && (
                  <div className="absolute right-0 z-30 mt-1 w-56 rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[11px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
                    <p className="px-3 py-1 text-[10px] text-[#9ca3af]">ID, Scenario, Status always visible</p>
                    {SIT_OPTIONAL_COLUMNS.map((c) => {
                      const hidden = columnLayout.hidden.includes(c.id);
                      return (
                        <div key={c.id} className="flex items-center gap-1 px-2 py-1 hover:bg-[#f3f0ff]">
                          <label className="flex flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!hidden}
                              onChange={() => {
                                const nextHidden = hidden
                                  ? columnLayout.hidden.filter((x) => x !== c.id)
                                  : [...columnLayout.hidden, c.id];
                                persistLayout({ ...columnLayout, hidden: nextHidden });
                              }}
                            />
                            {c.label}
                          </label>
                          {c.id !== "prioSev" && SIT_DEFAULT_ORDER.includes(c.id as SitOrderableColumnId) ? (
                            <span className="flex shrink-0 gap-0.5">
                              <button
                                type="button"
                                className="rounded px-1 text-[10px] text-[#8664F2]"
                                aria-label={`Move ${c.label} up`}
                                onClick={() =>
                                  persistLayout({
                                    ...columnLayout,
                                    order: moveColumnInOrder(columnLayout.order, c.id as SitOrderableColumnId, "up"),
                                  })
                                }
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="rounded px-1 text-[10px] text-[#8664F2]"
                                aria-label={`Move ${c.label} down`}
                                onClick={() =>
                                  persistLayout({
                                    ...columnLayout,
                                    order: moveColumnInOrder(columnLayout.order, c.id as SitOrderableColumnId, "down"),
                                  })
                                }
                              >
                                ↓
                              </button>
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                    <label className="flex cursor-pointer items-center gap-2 border-t border-[#eef0f5] px-3 py-1.5 hover:bg-[#f3f0ff]">
                      <input
                        type="checkbox"
                        checked={columnLayout.splitPrioSev}
                        onChange={(e) => persistLayout({ ...columnLayout, splitPrioSev: e.target.checked })}
                        data-testid="sit-split-prio-sev"
                      />
                      Split Priority / Severity
                    </label>
                    <button
                      type="button"
                      className="w-full border-t border-[#eef0f5] px-3 py-1.5 text-left font-medium text-[#8664F2] hover:bg-[#f3f0ff]"
                      data-testid="sit-reset-layout"
                      onClick={() => persistLayout(resetColumnLayout(canvasId))}
                    >
                      Reset layout
                    </button>
                  </div>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void addRow()}
                  data-testid="sit-add-test-case"
                  className="ml-auto inline-flex items-center gap-1 rounded-[8px] border border-[#e2e6ef] px-2 py-0.5 text-[11px] dark:border-[#2a2a2a]"
                >
                  <TbPlus size={12} /> Add test case
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col" data-testid="sit-grid-quality-shell">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <SitV2Grid
              workbook={displayWorkbook}
              epics={epics}
              canEdit={canEdit}
              ticketFilter={ticketFilter}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              originFilter={originFilter}
              search={search}
              generating={generating}
              layout={columnLayout}
              onLayoutChange={persistLayout}
              qualityFilterActive={deadFlag != null}
              onClearQualityFilter={() => setDeadFlag(null)}
              deadAudit={deadAudit}
              totalCaseCount={
                workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1")
                  .length
              }
              onPatch={(rowId, body) => {
                if (!canEdit) return;
                void patchRow(rowId, body);
              }}
              onDelete={(rowId) => {
                if (!canEdit) return;
                void softDelete(rowId);
              }}
              onAdd={() => {
                if (!canEdit) return;
                void addRow();
              }}
              onDuplicate={(rowId) => {
                if (!canEdit) return;
                void duplicateRow(rowId);
              }}
            />
            </div>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[#8a93a8]">
            Open <strong>Jira Tickets</strong>, select stories mapped to this canvas, then Generate.
          </p>
        )}
      </div>

      {undoRow && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-[#e2e6ef] bg-white px-4 py-2 text-[12.5px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
          Row deleted.{" "}
          <button type="button" className="font-semibold text-[#8664F2]" onClick={() => void undoDelete()}>
            Undo
          </button>
        </div>
      )}

      {pickerOpen && (
        <SitV2Picker
          epics={epics}
          selected={selected}
          clarifications={clarifications}
          activeTicketKey={activeTicketKey}
          onChange={setSelected}
          onClose={() => setPickerOpen(false)}
          onActivateTicket={(key) => {
            activateTicket(key);
            setPickerOpen(false);
          }}
          onSaveNote={async (issueKey, text) => {
            if (!canvasId) throw new Error("No canvas");
            const note = await client.saveTicketNote(canvasId, issueKey, text);
            setClarifications((prev) => {
              const hit = prev.find((c) => c.issueKey === issueKey);
              if (hit) {
                return prev.map((c) => (c.issueKey === issueKey ? { ...c, notes: note } : c));
              }
              // Notes can exist before a clarification row; keep a minimal local stub for the picker.
              const stub: CanvasClarification = {
                issueKey,
                summary: "",
                nodeIds: [],
                status: "ready",
                note: null,
                error: null,
                questions: [],
                confidence: null,
                model: null,
                attempts: 0,
                generatedAt: null,
                updatedAt: Date.now(),
                notes: note,
                notesOpen: true,
              };
              return [...prev, stub];
            });
            return note;
          }}
        />
      )}

      {genDialog && (
        <SitV2GenerateDialog
          choices={genDialog}
          history={history}
          onCancel={() => setGenDialog(null)}
          onConfirm={(choices) => void startGenerate(choices)}
        />
      )}
    </div>
  );
}
