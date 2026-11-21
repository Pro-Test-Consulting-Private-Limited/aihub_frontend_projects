"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TbClipboardList,
  TbLoader2,
  TbPlus,
  TbChevronDown,
} from "react-icons/tb";
import type {
  CanvasClarification,
  DeadFlag,
  SitDeadAudit,
  SitEpic,
  SitModelStatus,
  SitSheetRow,
  SitTicket,
  SitWorkbook,
} from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { DeadTestFinderToolbar, filterRowsByDeadFlag } from "../sit-dead-finder";
import { SitV2Picker } from "./sit-v2-picker";
import { SitV2GenerateDialog, type TicketGenChoice } from "./sit-v2-generate-dialog";
import { SitV2Grid } from "./sit-v2-grid";
import { SitV2AcChip } from "./sit-v2-ac-chip";
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
}: {
  client: AtlasClient;
  canvasId: string | null;
  canvasName?: string;
  projectName?: string;
}) {
  const [epics, setEpics] = useState<SitEpic[]>([]);
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [model, setModel] = useState<SitModelStatus | null>(null);
  const [selected, setSelected] = useState<SitTicket[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [workbook, setWorkbook] = useState<SitWorkbook | null>(null);
  const [history, setHistory] = useState<SitWorkbook[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [genMenuOpen, setGenMenuOpen] = useState(false);
  const [genDialog, setGenDialog] = useState<TicketGenChoice[] | null>(null);
  const [clarifications, setClarifications] = useState<CanvasClarification[]>([]);
  const [ticketFilter, setTicketFilter] = useState<string | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [undoRow, setUndoRow] = useState<{ workbookId: string; rowId: string } | null>(null);
  const [deadFlag, setDeadFlag] = useState<DeadFlag | null>(null);
  const [deadAudit, setDeadAudit] = useState<SitDeadAudit | null>(null);
  const [deadLoading, setDeadLoading] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
  const modelInactive = model?.state === "idle" || model?.state === "unconfigured" || model?.state === "down";

  const startGenerate = async (
    choices: TicketGenChoice[],
    useTemplate = false,
  ) => {
    if (!canvasId) {
      setError("Select a Jira-connected canvas first.");
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
            generator: useTemplate ? "stub" : "huggingface",
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
            mode: c.mode,
            workbookId: c.workbookId,
          })),
          useTemplate,
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

  const onClickGenerate = (useTemplate = false) => {
    setGenMenuOpen(false);
    if (!selected.length) return;
    if (!useTemplate && modelInactive) {
      setError(`Model is ${modelLabel(model)}. Use template from the menu, or wait until Ready.`);
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
    if (choices.some((c) => c.hasExisting) && !useTemplate) {
      setGenDialog(choices);
      return;
    }
    void startGenerate(
      choices.map((c) => ({ ...c, mode: useTemplate ? "template" : c.mode })),
      useTemplate,
    );
  };

  const patchRow = async (rowId: string, body: Parameters<AtlasClient["patchSitCase"]>[2]) => {
    if (!workbook || workbook.id === "pending") return;
    setSaveState("saving");
    try {
      const next = await client.patchSitCase(workbook.id, rowId, body);
      setWorkbook(next);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Save failed");
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

  const counts = useMemo(() => {
    const rows =
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    let ai = 0;
    let human = 0;
    let edited = 0;
    let template = 0;
    let passed = 0;
    let failed = 0;
    let partial = 0;
    let notRun = 0;
    for (const r of rows) {
      if (r.cells.origin === "human") human++;
      else if (r.cells.origin === "template") template++;
      else ai++;
      if (r.cells.edited === "1") edited++;
      const st = r.cells.executionStatus || "Not run";
      if (st === "Passed") passed++;
      else if (st === "Failed") failed++;
      else if (st === "Partial") partial++;
      else notRun++;
    }
    return { total: rows.length, ai, human, edited, template, passed, failed, partial, notRun };
  }, [workbook]);

  const metaProject = projectName || projectKey || "—";
  const metaModule = canvasName || "—";
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
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition ${
                editMode
                  ? "border-[#8664F2] bg-[#f3f0ff] text-[#5b21b6]"
                  : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
              }`}
            >
              {editMode ? "Editing" : "Edit"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!selected.length && !workbook) return;
                if (window.confirm("Clear the current selection and hide results? Saved data is kept.")) {
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
            <div className="relative flex">
              <button
                type="button"
                disabled={!selected.length || generating || !modelReady}
                title={
                  !selected.length
                    ? "Select tickets first"
                    : !modelReady
                      ? `Model is ${modelLabel(model)} — use template from the menu`
                      : selected.map((t) => t.key).join(", ")
                }
                onClick={() => onClickGenerate(false)}
                className="rounded-l-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
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
              <button
                type="button"
                disabled={generating}
                onClick={() => setGenMenuOpen((v) => !v)}
                className="rounded-r-[8px] border-l border-white/20 bg-[#8664F2] px-2 text-white disabled:opacity-40"
                aria-label="More generate options"
              >
                <TbChevronDown size={16} />
              </button>
              {genMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-[8px] border border-[#e2e6ef] bg-white py-1 shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-[#f3f0ff]"
                    onClick={() => onClickGenerate(true)}
                    disabled={!selected.length}
                  >
                    Use template
                  </button>
                </div>
              )}
            </div>
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
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save failed — retry edit"}
            </span>
          )}
          {(error || note) && (
            <span className={`ml-auto max-w-md truncate ${error ? "text-[#b42318]" : "text-[#92400e]"}`} title={error || note || ""}>
              {error || note}
              {error && (
                <button type="button" className="ml-1 underline" onClick={() => setError(null)}>
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
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={typeFilter || ""}
                onChange={(e) => setTypeFilter(e.target.value || null)}
              >
                <option value="">Type</option>
                {["Positive", "Negative", "Boundary", "Business Rule", "Concurrency", "Security"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={statusFilter || ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
              >
                <option value="">Status</option>
                {["Not run", "Passed", "Failed", "Partial"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={originFilter || ""}
                onChange={(e) => setOriginFilter(e.target.value || null)}
              >
                <option value="">Origin</option>
                <option value="ai">AI</option>
                <option value="human">Human</option>
                <option value="template">Template</option>
                <option value="edited">Edited</option>
              </select>
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
                    void startGenerate([{ issueKey: t.key, mode: "append", workbookId: workbook?.id, hasExisting: true, caseCount: activeRows.length }], false);
                  }}
                />
              )}
              <span className="relative inline-flex items-center gap-1 text-[11px] text-[#6b7280]">
                {counts.total} · {counts.ai} AI · {counts.edited} edited
                {counts.human ? ` · ${counts.human} human` : ""}
                {counts.template ? ` · ${counts.template} template` : ""}
                {" · "}
                {counts.passed} passed · {counts.failed} failed · {counts.partial} partial · {counts.notRun} not
                run
                <button
                  type="button"
                  className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#d1d5db] text-[10px] font-bold text-[#6b7280] hover:bg-[#f3f4f6]"
                  aria-label="Origin legend"
                  title="What AI / Human / Template / Edited mean"
                  onClick={() => setLegendOpen((v) => !v)}
                >
                  ?
                </button>
                {legendOpen && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-[320px] rounded-[8px] border border-[#e2e6ef] bg-white p-3 text-left text-[11.5px] leading-snug text-[#374151] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515] dark:text-[#d1d5db]">
                    <div className="mb-1 font-semibold text-[#1F1F1F] dark:text-[#ededed]">Origin legend</div>
                    <p>
                      <strong>AI</strong> — written by the model.
                    </p>
                    <p>
                      <strong>Human</strong> — added by a person.
                    </p>
                    <p>
                      <strong>Template</strong> — rule-based skeleton without the AI model (Use template, or model
                      down).
                    </p>
                    <p>
                      <strong>Edited</strong> — a person changed an AI or Template row.
                    </p>
                    <button
                      type="button"
                      className="mt-2 text-[#8664F2]"
                      onClick={() => setLegendOpen(false)}
                    >
                      Close
                    </button>
                  </div>
                )}
              </span>
              {editMode && (
                <button
                  type="button"
                  onClick={() => void addRow()}
                  className="ml-auto inline-flex items-center gap-1 rounded-[8px] border border-[#e2e6ef] px-2 py-0.5 text-[11px] dark:border-[#2a2a2a]"
                >
                  <TbPlus size={12} /> Add
                </button>
              )}
            </div>

            <SitV2Grid
              workbook={displayWorkbook}
              epics={epics}
              editMode={editMode}
              ticketFilter={ticketFilter}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              originFilter={originFilter}
              search={search}
              generating={generating}
              onPatch={(rowId, body) => void patchRow(rowId, body)}
              onDelete={(rowId) => void softDelete(rowId)}
              onAdd={() => void addRow()}
            />
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
              return [
                ...prev,
                {
                  issueKey,
                  summary: "",
                  questions: [],
                  notes: note,
                } as CanvasClarification,
              ];
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
          onConfirm={(choices) => void startGenerate(choices, false)}
        />
      )}
    </div>
  );
}
