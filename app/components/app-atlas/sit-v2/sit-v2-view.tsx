"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  TbClipboardList,
  TbLoader2,
  TbPlus,
  TbChevronDown,
  TbX,
} from "react-icons/tb";
import type {
  CanvasClarification,
  SitEpic,
  SitModelStatus,
  SitSheetRow,
  SitTicket,
  SitWorkbook,
} from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import { SitV2Picker } from "./sit-v2-picker";
import { SitV2GenerateDialog, type TicketGenChoice } from "./sit-v2-generate-dialog";
import { SitV2Grid } from "./sit-v2-grid";

function modelLabel(model: SitModelStatus | null) {
  if (!model) return "Unknown";
  if (model.state === "up") return "Ready";
  if (model.state === "idle") return "Warming up";
  if (model.state === "unconfigured") return "Not configured";
  if (model.state === "down") return "Down";
  return model.label || "Unknown";
}

function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
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

  const counts = useMemo(() => {
    const rows = workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    let ai = 0;
    let human = 0;
    let edited = 0;
    let template = 0;
    for (const r of rows) {
      if (r.cells.origin === "human") human++;
      else if (r.cells.origin === "template") template++;
      else ai++;
      if (r.cells.edited === "1") edited++;
    }
    return { total: rows.length, ai, human, edited, template };
  }, [workbook]);

  const metaProject = projectName || projectKey || "—";
  const metaModule = canvasName || "—";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f7f8fb] dark:bg-[#0a0a0a]">
      {/* Toolbar */}
      <div className="border-b border-[#EEE] bg-white px-4 py-3 dark:border-[#1a1a1a] dark:bg-[#0a0a0a]">
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
                      : undefined
                }
                onClick={() => onClickGenerate(false)}
                className="rounded-l-[8px] bg-[#8664F2] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40"
              >
                {generating ? (
                  <span className="inline-flex items-center gap-1.5">
                    <TbLoader2 className="animate-spin" size={14} /> Generating…
                  </span>
                ) : (
                  `Generate${selected.length ? ` (${selected.length})` : ""}`
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

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selected.map((t) => (
              <span
                key={t.key}
                className="inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2.5 py-0.5 text-[11.5px] text-[#5b21b6]"
              >
                {t.key}
                <button type="button" aria-label={`Remove ${t.key}`} onClick={() => setSelected((s) => s.filter((x) => x.key !== t.key))}>
                  <TbX size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-[#6b7280]">
          <span>
            Project: <strong className="text-[#1F1F1F] dark:text-[#ededed]">{metaProject}</strong>
          </span>
          <span>
            Module tested: <strong className="text-[#1F1F1F] dark:text-[#ededed]">{metaModule}</strong>
          </span>
          <span>
            Testing type: <strong className="text-[#1F1F1F] dark:text-[#ededed]">SIT</strong>
          </span>
          {saveState !== "idle" && (
            <span className="ml-auto text-[#8664F2]">
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save failed — retry edit"}
            </span>
          )}
        </div>
      </div>

      {/* Progress strip */}
      {generating && Object.keys(progress).length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-[#e2e6ef] bg-[#fafafa] px-4 py-2 text-[11.5px] dark:border-[#1a1a1a] dark:bg-[#141414]">
          {Object.entries(progress).map(([k, v]) => (
            <span
              key={k}
              className={`rounded-full border px-2.5 py-0.5 ${
                v.status === "done"
                  ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
                  : v.status === "error"
                    ? "border-[#fecaca] bg-[#fff5f5] text-[#b91c1c]"
                    : "border-[#ddd6fe] bg-[#f5f3ff] text-[#5b21b6]"
              }`}
            >
              {k}: {v.status === "done" ? `done (${v.count})` : v.status === "error" ? v.message || "error" : `${v.count} of ~8 cases`}
            </span>
          ))}
        </div>
      )}

      {(error || note) && (
        <div
          className={`mx-4 mt-3 rounded-[8px] border px-3 py-2 text-[12.5px] ${
            error ? "border-[#f5c2c7] bg-[#fff5f5] text-[#b42318]" : "border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
          }`}
        >
          {error || note}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-[#8a93a8]">
            <TbLoader2 className="animate-spin" /> Loading…
          </div>
        ) : workbook ? (
          <>
            {/* Filters / counts */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTicketFilter("all")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  ticketFilter === "all" ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                }`}
              >
                All tickets
              </button>
              {(workbook.sourceIssueKeys || []).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTicketFilter(k)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    ticketFilter === k ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                  }`}
                >
                  {k}
                </button>
              ))}
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={typeFilter || ""}
                onChange={(e) => setTypeFilter(e.target.value || null)}
              >
                <option value="">All types</option>
                {["Positive", "Negative", "Boundary", "Business Rule", "Concurrency", "Security"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={statusFilter || ""}
                onChange={(e) => setStatusFilter(e.target.value || null)}
              >
                <option value="">All statuses</option>
                {["Not run", "Passed", "Failed", "Partial"].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                value={originFilter || ""}
                onChange={(e) => setOriginFilter(e.target.value || null)}
              >
                <option value="">All origins</option>
                <option value="ai">AI</option>
                <option value="human">Human</option>
                <option value="template">Template</option>
                <option value="edited">Edited</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1 text-[11px] dark:border-[#2a2a2a] dark:bg-[#141414]"
              />
              <span className="text-[11px] text-[#6b7280]">
                {counts.total} cases · {counts.ai} AI · {counts.edited} edited · {counts.human} human
                {counts.template ? ` · ${counts.template} template` : ""}
              </span>
              {editMode && (
                <button
                  type="button"
                  onClick={() => void addRow()}
                  className="ml-auto inline-flex items-center gap-1 rounded-[8px] border border-[#e2e6ef] px-2.5 py-1 text-[11.5px] dark:border-[#2a2a2a]"
                >
                  <TbPlus size={14} /> Add test case
                </button>
              )}
              {/* Per-ticket versions */}
              {history.length > 1 && ticketFilter !== "all" && (
                <select
                  className="rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1 text-[11px]"
                  defaultValue={workbook.id}
                  onChange={(e) => {
                    const wb = history.find((h) => h.id === e.target.value);
                    if (wb) setWorkbook(wb);
                  }}
                >
                  {history
                    .filter((h) => h.sourceIssueKeys.includes(ticketFilter))
                    .map((h) => (
                      <option key={h.id} value={h.id}>
                        Versions · {ago(h.createdAt)} · {h.generator} ·{" "}
                        {h.sheets.find((s) => s.kind === "test-cases")?.rows.length || 0} cases
                      </option>
                    ))}
                </select>
              )}
            </div>

            <SitV2Grid
              workbook={workbook}
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
          </>
        ) : (
          <p className="text-[13px] text-[#8a93a8]">
            Open <strong>Jira Tickets</strong>, select stories mapped to this canvas, then Generate. Existing suites appear after the first run.
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
          onChange={setSelected}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {genDialog && (
        <SitV2GenerateDialog
          choices={genDialog}
          onCancel={() => setGenDialog(null)}
          onConfirm={(choices) => void startGenerate(choices, false)}
        />
      )}
    </div>
  );
}
