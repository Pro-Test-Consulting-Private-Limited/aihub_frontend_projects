"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TbClipboardList, TbLoader2, TbPlus } from "react-icons/tb";
import type {
  CanvasClarification,
  SitDeadAudit,
  SitEpic,
  SitSheetRow,
  SitTicket,
  SitWorkbook,
} from "@/app/interfaces/appatlas";
import type { AtlasClient } from "@/app/services/appatlas";
import {
  FlaggedFilterDropdown,
  QualityActiveChip,
  highlightQualityRow,
} from "../sit-dead-finder";
import { SitV2Picker } from "./sit-v2-picker";
import { SitV2GenerateDialog, type TicketGenChoice } from "./sit-v2-generate-dialog";
import { SitV2Grid } from "./sit-v2-grid";
import { SitV2AcChip } from "./sit-v2-ac-chip";
import { SitV2Select } from "./sit-v2-select";
import { SitV2IssuesScreen } from "./sit-v2-issues-screen";
import { SitV2ImproveReview } from "./sit-v2-improve-review";
import {
  filterRowsByCaseFlags,
  migrateFlaggedFilter,
  summarizeCaseFlags,
  warnFlagCountMismatch,
  type FlaggedFilter,
} from "@/app/lib/sit-case-flags";
import {
  buildScopeSummary,
  loadPersistedMode,
  loadPersistedScope,
  loadPersistedSelectedKeys,
  mergeStreamIntoScope,
  mergeWorkbooksForKeys,
  normalizeTicketKey,
  reportScopeInvariantBreaks,
  rowsForTicket,
  savePersistedMode,
  savePersistedScope,
  savePersistedSelectedKeys,
  sortTicketKeys,
  ticketKeyOf,
  ticketsFromKeys,
  viewWorkingKeys,
  workbookWithMergedRows,
  workingSetKeys,
} from "@/app/lib/sit-scope";
import {
  EDITED_TOGGLE_TOOLTIP,
  SOURCE_GROUP_LABEL,
  getCaseProvenance,
  migrateOriginFilterPersist,
  type CaseOrigin,
} from "@/app/lib/sit-case-provenance";
import {
  defaultLayout,
  loadColumnLayout,
  saveColumnLayout,
  resetColumnLayout,
  moveColumnInOrder,
  SIT_OPTIONAL_COLUMNS,
  SIT_DEFAULT_ORDER,
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
import { useModelStatus } from "@/app/hooks/use-model-status";
import {
  ModelStatusPill,
  modelStatusPresentation,
} from "@/app/components/model-status-pill";

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
  const [sitNotConfigured, setSitNotConfigured] = useState(false);
  const { mapped: modelMapped } = useModelStatus({ notConfigured: sitNotConfigured });
  const [selected, setSelected] = useState<SitTicket[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [workbook, setWorkbook] = useState<SitWorkbook | null>(null);
  const [history, setHistory] = useState<SitWorkbook[]>([]);
  const [rowWorkbookId, setRowWorkbookId] = useState<Record<string, string>>({});
  const [pageError, setPageError] = useState<string | null>(null);
  /** R14-04: when All tickets is active, pick a key before Add. */
  const [addTicketPickerOpen, setAddTicketPickerOpen] = useState(false);
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<Progress>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [genDialog, setGenDialog] = useState<TicketGenChoice[] | null>(null);
  const [clarifications, setClarifications] = useState<CanvasClarification[]>([]);
  const [ticketFilter, setTicketFilter] = useState<string | "all" | "__unassigned__">("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [originFilter, setOriginFilter] = useState<CaseOrigin | "all">(() => {
    if (typeof window === "undefined") return "all";
    try {
      const raw = localStorage.getItem("sit_v2_origin_filter");
      const migrated = migrateOriginFilterPersist(raw);
      if (raw === "edited") {
        try {
          localStorage.setItem("sit_v2_origin_filter", "all");
          localStorage.setItem("sit_v2_edited_only", "1");
        } catch {
          /* ignore */
        }
      }
      return migrated.origin;
    } catch {
      return "all";
    }
  });
  /** R13: Edited is a modifier toggle, not an origin value. */
  const [editedOnly, setEditedOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("sit_v2_origin_filter");
      const migrated = migrateOriginFilterPersist(raw);
      if (migrated.editedOnly) {
        try {
          localStorage.setItem("sit_v2_origin_filter", "all");
          localStorage.setItem("sit_v2_edited_only", "1");
        } catch {
          /* ignore */
        }
        return true;
      }
      return localStorage.getItem("sit_v2_edited_only") === "1";
    } catch {
      return false;
    }
  });
  const [search, setSearch] = useState("");
  const [undoRow, setUndoRow] = useState<{
    workbookId: string;
    rowIds: string[];
    /** Per-row owning workbook when bulk spans workbooks (R16). */
    byRow?: Record<string, string>;
  } | null>(null);
  /** R16: stream workbook kept separate from the frozen base merged workbook. */
  const [streamWorkbook, setStreamWorkbook] = useState<SitWorkbook | null>(null);
  const [generatingKeys, setGeneratingKeys] = useState<string[]>([]);
  const [streamRowOwners, setStreamRowOwners] = useState<Record<string, string>>({});
  const baseKeysAtStreamRef = useRef<string[]>([]);
  const streamRafRef = useRef<number | null>(null);
  const pendingStreamWbRef = useRef<SitWorkbook | null>(null);
  const [deadFlag, setDeadFlag] = useState<FlaggedFilter>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("sit_v2_flagged_filter") || localStorage.getItem("sit_v2_quality_filter");
      return migrateFlaggedFilter(raw);
    } catch {
      return null;
    }
  });
  const [deadAudit, setDeadAudit] = useState<SitDeadAudit | null>(null);
  const [sitMode, setSitMode] = useState<"cases" | "issues">(() =>
    typeof window === "undefined" ? "cases" : loadPersistedMode(),
  );
  /** R10-07: mutually exclusive with quality chips: Show in Cases from Issues */
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[] | null>(null);
  const [improveReview, setImproveReview] = useState<{
    rowId: string;
    before: Record<string, string>;
    after: Record<string, string>;
    fixed: string[];
    remaining: string[];
  } | null>(null);
  const [deadLoading, setDeadLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [columnLayout, setColumnLayout] = useState<SitColumnLayout>(() => defaultLayout());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const firstRowAt = useRef<number | null>(null);

  const applyMergedScope = useCallback(
    (hist: SitWorkbook[], sel: SitTicket[]) => {
      // R17 D1/D2: grid view keys = selection UNION every live ticket key in canvas workbooks.
      // Selection alone must not shrink pills / All / M in Jira (N of M).
      const selectedKeys = sel.map((t) => t.key);
      const keys = viewWorkingKeys(selectedKeys, hist);
      const merged = mergeWorkbooksForKeys(hist, keys);
      const seed =
        hist.find((h) => merged.workbookIds.includes(h.id)) || hist[0] || null;
      const next = workbookWithMergedRows(seed, merged);
      setWorkbook(next);
      setRowWorkbookId(merged.rowWorkbookId);
      return merged;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPageError(null);
    try {
      const [tickets, saved] = await Promise.all([
        client.listSitTickets(canvasId),
        client.listSitWorkbooks(canvasId),
      ]);
      setEpics(tickets.epics);
      setProjectKey(tickets.projectKey);
      setNote(tickets.note ?? null);
      if (tickets.model?.state === "unconfigured") setSitNotConfigured(true);
      const items = saved.items || [];
      setHistory(items);
      const allTickets = tickets.epics.flatMap((e) => e.tickets);
      let persisted = loadPersistedSelectedKeys();
      if (!persisted.length) {
        persisted = workingSetKeys(
          [],
          items.flatMap((h) => h.sourceIssueKeys || []),
        );
      }
      const nextSelected = ticketsFromKeys(allTickets, persisted);
      setSelected(nextSelected);
      savePersistedSelectedKeys(nextSelected.map((t) => t.key));
      const scopeKeys = viewWorkingKeys(
        nextSelected.map((t) => t.key),
        items,
      );
      const scope = loadPersistedScope(scopeKeys);
      setTicketFilter(scope);
      savePersistedScope(scope);
      applyMergedScope(items, nextSelected);
      if (canvasId) {
        client.getClarifications(canvasId).then((c) => setClarifications(c.items || [])).catch(() => undefined);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setPageError(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [client, canvasId, applyMergedScope]);

  useEffect(() => {
    // R17B S11: drop in-flight stream/history merge from the previous canvas before load.
    abortRef.current?.abort();
    abortRef.current = null;
    clearStreamState();
    setGenerating(false);
    setProgress({});
    setError(null);
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
    let cancelled = false;
    void client
      .getSitModelStatus()
      .then((m) => {
        if (!cancelled && m.state === "unconfigured") setSitNotConfigured(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
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
    savePersistedScope(key);
    const all = epics.flatMap((e) => e.tickets);
    const t = all.find((x) => x.key === key);
    const nextSelected =
      t && !selected.some((s) => s.key === key) ? [...selected, t] : selected;
    if (t && nextSelected !== selected) {
      setSelected(nextSelected);
      savePersistedSelectedKeys(nextSelected.map((s) => s.key));
    }
    // R17: changing selection must not rebuild a smaller grid; view keys stay live∪selected.
    applyMergedScope(history, nextSelected);
  };

  const modelReady = modelMapped.ui === "ready";

  const flushStreamWorkbook = useCallback((next: SitWorkbook) => {
    pendingStreamWbRef.current = next;
    if (streamRafRef.current != null) return;
    streamRafRef.current = requestAnimationFrame(() => {
      streamRafRef.current = null;
      const pending = pendingStreamWbRef.current;
      if (pending) setStreamWorkbook(pending);
    });
  }, []);

  const clearStreamState = useCallback(() => {
    if (streamRafRef.current != null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    pendingStreamWbRef.current = null;
    setStreamWorkbook(null);
    setGeneratingKeys([]);
    setStreamRowOwners({});
    baseKeysAtStreamRef.current = [];
  }, []);

  const ownerWorkbookId = useCallback(
    (rowId: string, fallback?: string | null) =>
      streamRowOwners[rowId] || rowWorkbookId[rowId] || fallback || workbook?.id || "",
    [streamRowOwners, rowWorkbookId, workbook?.id],
  );

  const realignAfterStream = useCallback(async () => {
    clearStreamState();
    await load();
  }, [clearStreamState, load]);

  const startGenerate = async (choices: TicketGenChoice[]) => {
    if (!canvasId) {
      setError("Select a Jira-connected canvas first.");
      return;
    }
    if (!modelReady) {
      setError(modelStatusPresentation(modelMapped.ui).tooltip);
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

    const genKeys = sortTicketKeys(choices.map((c) => normalizeTicketKey(c.issueKey)).filter(Boolean));
    const baseRowsNow =
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    const baseKeysNow = viewWorkingKeys(
      selected.map((t) => t.key),
      history,
    );
    baseKeysAtStreamRef.current = baseKeysNow;
    setGeneratingKeys(genKeys);

    // Seed stream with current rows of generating tickets so append does not flash empty.
    const genSet = new Set(genKeys.map(normalizeTicketKey));
    const seedRows = baseRowsNow.filter((r) => genSet.has(ticketKeyOf(r)));
    const seedWb: SitWorkbook = {
      id: "pending",
      canvasId,
      confirmedId: "",
      sourceIssueKeys: genKeys,
      sourceSummaries: {},
      status: "running",
      error: null,
      generator: "huggingface",
      sheets: [
        {
          id: "test-cases",
          name: "Test Cases",
          kind: "test-cases",
          columns: workbook?.sheets.find((s) => s.kind === "test-cases")?.columns || [],
          rows: seedRows,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: { id: "", name: "" },
    } as SitWorkbook;
    setStreamWorkbook(seedWb);
    pendingStreamWbRef.current = seedWb;

    // Keep base workbook if present; only seed skeleton when nothing is loaded.
    setWorkbook((prev) =>
      prev
        ? prev
        : ({
            id: "pending",
            canvasId,
            confirmedId: "",
            sourceIssueKeys: genKeys,
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

    const patchStreamRows = (mutate: (rows: SitSheetRow[]) => SitSheetRow[]) => {
      const cur = pendingStreamWbRef.current || seedWb;
      const sheets = cur.sheets.map((s) => {
        if (s.kind !== "test-cases") return s;
        return { ...s, rows: mutate(s.rows) };
      });
      flushStreamWorkbook({ ...cur, sheets, status: "running" });
    };

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
            // R16: append into stream workbook only (never replace base).
            patchStreamRows((rows) => (rows.some((r) => r.id === row.id) ? rows : [...rows, row]));
          } else if (event === "ticket_done") {
            setProgress((p) => ({
              ...p,
              [String(d.issueKey)]: { status: "done", count: Number(d.caseCount) || 0 },
            }));
          } else if (event === "assessed") {
            const rows = Array.isArray(d.rows) ? (d.rows as SitSheetRow[]) : [];
            if (rows.length) {
              const byId = new Map(rows.map((r) => [r.id, r]));
              patchStreamRows((prevRows) => prevRows.map((r) => byId.get(r.id) || r));
            }
          } else if (event === "ticket_error") {
            setProgress((p) => ({
              ...p,
              [String(d.issueKey)]: { status: "error", count: 0, message: String(d.message || "error") },
            }));
          } else if (event === "workbook") {
            // Keep as stream state only; mergeStreamIntoScope filters to generating keys.
            flushStreamWorkbook(d as unknown as SitWorkbook);
          } else if (event === "error") {
            setError(String(d.message || "Generation failed"));
          } else if (event === "done") {
            const ms = Number(d.ms) || Date.now() - started;
            console.info(`[sit-v2] generate done ok=${d.ok} total=${ms}ms firstRow=${firstRowAt.current}ms`);
          }
        },
        ac.signal,
      );
      await realignAfterStream();
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        await realignAfterStream();
      } else {
        setError(err instanceof Error ? err.message : "Generation failed");
        await realignAfterStream();
      }
    } finally {
      setGenerating(false);
    }
  };

  const onClickGenerate = () => {
    if (!selected.length) return;
    if (!modelReady) {
      setError(modelStatusPresentation(modelMapped.ui).tooltip);
      return;
    }
    const genRows =
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [];
    const genKeys = viewWorkingKeys(
      selected.map((t) => t.key),
      history,
    );
    const genByTicket = buildScopeSummary(genRows, genKeys).byTicket;
    const choices: TicketGenChoice[] = selected.map((t) => {
      const gen = t.generation;
      const live = genByTicket[t.key] ?? 0;
      const existing = live > 0 || (gen && gen.caseCount > 0);
      if (existing) {
        return {
          issueKey: t.key,
          mode: "append" as const,
          workbookId: gen?.workbookId || rowWorkbookId[Object.keys(rowWorkbookId)[0] || ""] || workbook?.id,
          hasExisting: true,
          caseCount: live || gen?.caseCount || 0,
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
    const wbId = ownerWorkbookId(rowId, workbook.id);
    if (!wbId || wbId === "pending") return;
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
              : body.actualResult !== undefined
                ? "Actual result"
                : body.userNote !== undefined
                  ? "Notes"
                  : body.cells
                    ? Object.keys(body.cells)[0] || "field"
                    : "case");
    try {
      const next = await client.patchSitCase(wbId, rowId, body);
      setHistory((prev) => {
        const hist = prev.some((h) => h.id === next.id)
          ? prev.map((h) => (h.id === next.id ? next : h))
          : [next, ...prev];
        applyMergedScope(hist, selected);
        return hist;
      });
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
    const wbId = ownerWorkbookId(rowId, workbook.id);
    await patchRow(rowId, { softDelete: true });
    setUndoRow({ workbookId: wbId, rowIds: [rowId], byRow: { [rowId]: wbId } });
  };

  const softDeleteMany = async (rowIds: string[]) => {
    if (!workbook || !rowIds.length) return;
    const byRow: Record<string, string> = {};
    for (const id of rowIds) {
      byRow[id] = ownerWorkbookId(id, workbook.id);
    }
    const firstWb = byRow[rowIds[0]!] || workbook.id;
    setUndoRow({ workbookId: firstWb, rowIds: [...rowIds], byRow });
    for (const id of rowIds) {
      await patchRow(id, { softDelete: true });
    }
  };

  const undoDelete = async () => {
    if (!undoRow) return;
    let wb = workbook;
    for (const id of undoRow.rowIds) {
      const wbId = undoRow.byRow?.[id] || undoRow.workbookId;
      wb = await client.patchSitCase(wbId, id, { undelete: true });
    }
    if (wb) commitWorkbook(wb);
    setUndoRow(null);
  };

  const commitWorkbook = (next: SitWorkbook) => {
    setWorkbook(next);
    setHistory((prev) => {
      const hist = prev.some((h) => h.id === next.id)
        ? prev.map((h) => (h.id === next.id ? next : h))
        : [next, ...prev];
      return hist;
    });
  };

  const createCaseForTicket = async (ticketKey: string) => {
    if (!workbook || workbook.id === "pending") return;
    const want = normalizeTicketKey(ticketKey);
    const peer = (
      workbook.sheets.find((s) => s.kind === "test-cases")?.rows || []
    ).find((r) => ticketKeyOf(r) === want && r.cells.deleted !== "1");
    const wbId = peer ? ownerWorkbookId(peer.id, workbook.id) : workbook.id;
    if (!wbId || wbId === "pending") return;
    const res = await client.addSitCase(wbId, ticketKey);
    commitWorkbook(res.workbook);
    const newId = res.row?.id || null;
    if (newId) {
      setHighlightRowId(newId);
      setTimeout(() => {
        try {
          document.querySelector(`[data-row-id="${newId}"]`)?.scrollIntoView({ block: "nearest" });
        } catch {
          /* ignore */
        }
      }, 50);
      setTimeout(() => setHighlightRowId(null), 2500);
    }
  };

  const addRow = async () => {
    if (!workbook || workbook.id === "pending") return;
    if (ticketFilter !== "all" && ticketFilter !== "__unassigned__") {
      await createCaseForTicket(ticketFilter);
      return;
    }
    const keys = viewWorkingKeys(
      selected.map((t) => t.key),
      history,
    );
    if (!keys.length) {
      setError("Select tickets before adding a row.");
      return;
    }
    if (keys.length === 1) {
      await createCaseForTicket(keys[0]!);
      return;
    }
    setAddTicketPickerOpen(true);
  };

  const duplicateRow = async (rowId: string) => {
    if (!workbook || workbook.id === "pending") return;
    const baseSrc = workbook.sheets.find((s) => s.kind === "test-cases")?.rows.find((r) => r.id === rowId);
    const streamSrc = streamWorkbook?.sheets
      .find((s) => s.kind === "test-cases")
      ?.rows.find((r) => r.id === rowId);
    const src = streamSrc || baseSrc;
    if (!src) return;
    const ticketKey = ticketKeyOf(src);
    if (!ticketKey) {
      setError("Cannot duplicate: row has no ticket key.");
      return;
    }
    const wbId = ownerWorkbookId(rowId, workbook.id);
    if (!wbId || wbId === "pending") return;
    try {
      const res = await client.addSitCase(wbId, ticketKey);
      const newId = res.row?.id;
      if (!newId) {
        commitWorkbook(res.workbook);
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
      const next = await client.patchSitCase(wbId, newId, { cells: copyCells });
      commitWorkbook(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duplicate failed");
    }
  };

  const baseWorkingKeys = useMemo(
    () => viewWorkingKeys(
      selected.map((t) => t.key),
      history,
    ),
    [selected, history],
  );

  const baseWorkingRows = useMemo(() => {
    return (
      workbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || []
    );
  }, [workbook]);

  const streamMerge = useMemo(() => {
    const frozenBaseKeys = generatingKeys.length
      ? baseKeysAtStreamRef.current.length
        ? baseKeysAtStreamRef.current
        : baseWorkingKeys
      : baseWorkingKeys;
    return mergeStreamIntoScope(baseWorkingRows, frozenBaseKeys, streamWorkbook, generatingKeys);
  }, [baseWorkingRows, baseWorkingKeys, streamWorkbook, generatingKeys]);

  /** All non-deleted rows in the working set (base ∪ filtered stream). */
  const allWorkingRows = streamMerge.rows;

  const workingKeys = streamMerge.workingKeys;

  /** Display shell: base workbook metadata with merged rows for grid/export. */
  const scopedWorkbook = useMemo(() => {
    if (!workbook) return workbook;
    const tc = workbook.sheets.find((s) => s.kind === "test-cases");
    const other = workbook.sheets.filter((s) => s.kind !== "test-cases");
    return {
      ...workbook,
      sourceIssueKeys: workingKeys.length ? workingKeys : workbook.sourceIssueKeys,
      sheets: [
        {
          id: tc?.id || "tc",
          name: tc?.name || "Test Cases",
          kind: "test-cases" as const,
          columns: tc?.columns || [],
          rows: allWorkingRows,
        },
        ...other,
      ],
    };
  }, [workbook, workingKeys, allWorkingRows]);

  useEffect(() => {
    if (!streamWorkbook?.id || streamWorkbook.id === "pending" || !generatingKeys.length) {
      return;
    }
    const gen = new Set(generatingKeys.map(normalizeTicketKey));
    const rows = streamWorkbook.sheets.find((s) => s.kind === "test-cases")?.rows || [];
    const next: Record<string, string> = {};
    for (const r of rows) {
      if (gen.has(ticketKeyOf(r))) next[r.id] = streamWorkbook.id;
    }
    setStreamRowOwners(next);
  }, [streamWorkbook, generatingKeys]);

  /** R14-01: single summary for All tickets, pills, Unassigned, popup loaded counts. */
  const workingSummary = useMemo(() => buildScopeSummary(allWorkingRows, workingKeys), [allWorkingRows, workingKeys]);

  /** Ticket-scope rows for flag / source / status counts (never search/type). */
  const scopeRows = useMemo(() => {
    if (ticketFilter === "all") return allWorkingRows;
    if (ticketFilter === "__unassigned__") {
      const keySet = new Set(workingKeys);
      return allWorkingRows.filter((r) => {
        const k = ticketKeyOf(r);
        return !k || !keySet.has(k);
      });
    }
    return rowsForTicket(allWorkingRows, ticketFilter);
  }, [allWorkingRows, ticketFilter, workingKeys]);

  const scopeSummary = useMemo(() => buildScopeSummary(scopeRows, workingKeys), [scopeRows, workingKeys]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    reportScopeInvariantBreaks(workingSummary, "sit-working");
    reportScopeInvariantBreaks(scopeSummary, "sit-scope");
  }, [workingSummary, scopeSummary]);

  const flagSummary = useMemo(() => summarizeCaseFlags(scopeRows, null), [scopeRows]);

  useEffect(() => {
    try {
      if (deadFlag) localStorage.setItem("sit_v2_flagged_filter", String(deadFlag));
      else {
        localStorage.removeItem("sit_v2_flagged_filter");
        localStorage.removeItem("sit_v2_quality_filter");
      }
    } catch {
      /* ignore */
    }
  }, [deadFlag]);

  const displayWorkbook = useMemo(() => {
    if (!scopedWorkbook) return scopedWorkbook;
    if (selectedIssueIds?.length) {
      const set = new Set(selectedIssueIds);
      return {
        ...scopedWorkbook,
        sheets: scopedWorkbook.sheets.map((s) =>
          s.kind !== "test-cases" ? s : { ...s, rows: s.rows.filter((r) => set.has(r.id)) },
        ),
      };
    }
    const flagged = migrateFlaggedFilter(deadFlag);
    if (!flagged) return scopedWorkbook;
    const filtered = filterRowsByCaseFlags(
      scopedWorkbook.sheets.find((s) => s.kind === "test-cases")?.rows || [],
      // Filter against full workbook flags so All-pill scope still filters correctly;
      // counts use flagSummary (ticket scope). Rebuild lightly for all rows.
      summarizeCaseFlags(
        scopedWorkbook.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") || [],
        null,
      ),
      flagged,
    );
    if (process.env.NODE_ENV !== "production") {
      const badge =
        flagged === "all"
          ? flagSummary.defectCases
          : flagged === "needs_review"
            ? flagSummary.reviewCases
            : flagSummary.byDefect[flagged] ?? 0;
      // Compare badge (ticket scope) vs filtered count also limited to ticket scope.
      const scopedFiltered = filtered.filter(
        (r) =>
          r.cells.deleted !== "1" &&
          (ticketFilter === "all" ||
            r.cells.requirementId === ticketFilter ||
            r.cells.issueKey === ticketFilter),
      );
      warnFlagCountMismatch(flagged, badge, scopedFiltered.length);
    }
    return {
      ...scopedWorkbook,
      sheets: scopedWorkbook.sheets.map((s) =>
        s.kind !== "test-cases" ? s : { ...s, rows: filtered },
      ),
    };
  }, [scopedWorkbook, deadFlag, selectedIssueIds, flagSummary, ticketFilter]);

  /** R7-03 / R12-01: Y in "Showing X of Y" is the current ticket scope (All or DW-x). */
  const toolbarTotalCount = useMemo(() => scopeRows.length, [scopeRows]);
  const toolbarShownCount = useMemo(() => {
    let list =
      displayWorkbook?.sheets.find((s) => s.kind === "test-cases")?.rows.filter((r) => r.cells.deleted !== "1") ||
      [];
    if (ticketFilter === "__unassigned__") {
      const keySet = new Set(workingKeys);
      list = list.filter((r) => {
        const k = ticketKeyOf(r);
        return !k || !keySet.has(k);
      });
    } else if (ticketFilter !== "all") {
      list = list.filter((r) => ticketKeyOf(r) === ticketFilter);
    }
    if (typeFilter) list = list.filter((r) => (r.cells.testType || "") === typeFilter);
    if (statusFilter) list = list.filter((r) => (r.cells.executionStatus || "Not run") === statusFilter);
    if (originFilter !== "all") {
      list = list.filter((r) => getCaseProvenance(r.cells).origin === originFilter);
    }
    if (editedOnly) {
      list = list.filter((r) => getCaseProvenance(r.cells).edited);
    }
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
  }, [displayWorkbook, ticketFilter, typeFilter, statusFilter, originFilter, editedOnly, search, workingKeys]);

  /** R13: origin chip counts over ticket scope only (not search/type/status/flagged/edited). */
  const counts = useMemo(() => {
    const s = scopeSummary;
    let edited = s.edited;
    if (originFilter !== "all") {
      edited = scopeRows.filter((r) => {
        const p = getCaseProvenance(r.cells);
        return p.origin === originFilter && p.edited;
      }).length;
    }
    return {
      total: s.bySource.total,
      ai: s.bySource.ai,
      human: s.bySource.human,
      edited,
      template: 0,
      Draft: s.byStatus.Draft,
      Blocked: s.byStatus.Blocked,
      Skipped: s.byStatus.Skipped,
      Stale: s.byStatus.Stale,
      passed: s.byStatus.Passed,
      failed: s.byStatus.Failed,
      partial: s.byStatus.Partial,
      notRun: s.byStatus["Not run"],
    };
  }, [scopeSummary, scopeRows, originFilter]);

  const metaProject = projectName || projectKey || ", ";
  const metaModule = canvasName || ", ";
  // R12-01: Active tab only when a single pill is active, never when All / Unassigned.
  const activeTicketKey =
    ticketFilter !== "all" && ticketFilter !== "__unassigned__" ? ticketFilter : null;

  const activeAcs = useMemo(() => {
    if (!activeTicketKey) return [] as string[];
    const t = epics.flatMap((e) => e.tickets).find((x) => x.key === activeTicketKey);
    return t?.acceptanceCriteria || [];
  }, [activeTicketKey, epics]);

  /** AC id → text from ticket.acceptanceCriteria (same AC1..n indexing as TicketBrief extractAcList). */
  const acTextsById = useMemo(() => {
    const out: Record<string, string> = {};
    for (const t of epics.flatMap((e) => e.tickets)) {
      const list = t.acceptanceCriteria || [];
      list.forEach((text, i) => {
        const id = `AC${i + 1}`;
        const trimmed = String(text || "").trim();
        if (!trimmed) return;
        // Prefer ticket-scoped text when ids collide across tickets: last write wins for global map;
        // also store ticket-prefixed keys.
        out[id] = trimmed;
        out[`${t.key}:${id}`] = trimmed;
      });
    }
    return out;
  }, [epics]);

  const activeRows = useMemo(() => {
    if (!activeTicketKey) return allWorkingRows;
    return allWorkingRows.filter((r) => ticketKeyOf(r) === activeTicketKey);
  }, [allWorkingRows, activeTicketKey]);

  const runExport = async (kind: "xlsx" | "csv" | "copy", scope: ExportScope) => {
    if (!scopedWorkbook || scopedWorkbook.id === "pending") return;
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
        const { blob, filename } = await buildXlsxBlob(scopedWorkbook, {
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
        const rows = casesForExport(scopedWorkbook, {
          scope,
          viewRows,
          selectedKeys: selected.map((s) => s.key),
        });
        const csv = toCsv(rows);
        downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SIT_${metaProject}_${metaModule}.csv`);
      } else {
        const { casesForExport } = await import("@/app/lib/sit-export");
        const rows = casesForExport(scopedWorkbook, {
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
              {workingKeys.length
                ? ` (${selected.length} of ${workingKeys.length})`
                : selected.length
                  ? ` (${selected.length})`
                  : ""}
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
                setSelected([]);
                setWorkbook(null);
                setRowWorkbookId({});
                setTicketFilter("all");
                savePersistedSelectedKeys([]);
                savePersistedScope("all");
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
            {(selected.length > 0 || (workbook && workbook.id !== "pending")) && (
              <>
                <div
                  className="inline-flex rounded-[8px] border border-[#e2e6ef] p-0.5 text-[12.5px]"
                  data-testid="sit-mode-switch"
                  role="tablist"
                  aria-label="SIT view"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sitMode === "cases"}
                    data-testid="sit-mode-cases"
                    className={`rounded-[6px] px-2.5 py-1 font-medium ${
                      sitMode === "cases" ? "bg-[#8664F2] text-white" : "text-[#5b647a]"
                    }`}
                    onClick={() => {
                      setSitMode("cases");
                      savePersistedMode("cases");
                    }}
                  >
                    Cases
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sitMode === "issues"}
                    data-testid="sit-mode-issues"
                    className={`rounded-[6px] px-2.5 py-1 font-medium ${
                      sitMode === "issues" ? "bg-[#8664F2] text-white" : "text-[#5b647a]"
                    }`}
                    onClick={() => {
                      setSitMode("issues");
                      savePersistedMode("issues");
                    }}
                  >
                    <span title="in this ticket scope">Issues {flagSummary.attentionCases}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ModelStatusPill
              status={modelMapped.ui}
              size="sm"
              testId="sit-model-status-pill"
              className="ml-0"
            />
            <button
              type="button"
              disabled={!selected.length || generating || modelMapped.generateDisabled}
              title={
                !selected.length
                  ? "Select tickets first"
                  : modelMapped.generateDisabled
                    ? modelStatusPresentation(modelMapped.ui).tooltip
                    : `Generate for: ${selected.map((t) => t.key).join(", ")}`
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
          <div className="flex items-center gap-2 text-[13px] text-[#8a93a8]" data-testid="sit-page-loading">
            <TbLoader2 className="animate-spin" /> Loading…
          </div>
        ) : pageError ? (
          <div className="flex flex-col gap-2 text-[13px]" data-testid="sit-page-error">
            <p className="text-[#b42318]">{pageError}</p>
            <button
              type="button"
              className="w-fit rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 font-medium"
              data-testid="sit-page-retry"
              onClick={() => void load()}
            >
              Retry
            </button>
          </div>
        ) : displayWorkbook && allWorkingRows.length > 0 ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {/* R14-06: deliberate two-row filter chrome */}
            <div className="flex shrink-0 flex-col gap-1.5" data-testid="sit-filter-chrome">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="sit-filter-row-a">
              <div
                className="inline-flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto"
                role="group"
                aria-label="Ticket scope"
                data-testid="sit-ticket-scope-group"
              >
                <button
                  type="button"
                  data-testid="sit-scope-pill-all"
                  title="All tickets in the working set"
                  onClick={() => {
                    setTicketFilter("all");
                    savePersistedScope("all");
                  }}
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                    ticketFilter === "all" ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                  }`}
                >
                  All tickets {workingSummary.total}
                </button>
                {workingKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    data-testid={`sit-scope-pill-${k}`}
                    onClick={() => {
                      setTicketFilter(k);
                      savePersistedScope(k);
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      ticketFilter === k ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white"
                    }`}
                  >
                    {k} {workingSummary.byTicket[k] ?? 0}
                  </button>
                ))}
                {workingSummary.unassigned > 0 ? (
                  <button
                    type="button"
                    data-testid="sit-scope-pill-unassigned"
                    title="Cases not linked to a Jira ticket"
                    onClick={() => {
                      setTicketFilter("__unassigned__");
                      savePersistedScope("all");
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
                      ticketFilter === "__unassigned__"
                        ? "bg-[#8664F2] text-white"
                        : "border border-[#fde68a] bg-[#fffbeb] text-[#92400e]"
                    }`}
                  >
                    Unassigned {workingSummary.unassigned}
                  </button>
                ) : null}
              </div>
              <QualityActiveChip
                audit={deadAudit}
                summary={flagSummary}
                activeFlag={deadFlag}
                onClear={() => {
                  setDeadFlag(null);
                  setSearch("");
                }}
              />
              {selectedIssueIds?.length ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[12px] font-medium text-[#5b21b6]"
                  data-testid="sit-selected-issues-chip"
                  onClick={() => setSelectedIssueIds(null)}
                  title="Clear selected issues filter"
                >
                  Selected issues: {selectedIssueIds.length} cases ×
                </button>
              ) : null}
              {sitMode === "cases" ? (
                <FlaggedFilterDropdown
                  summary={flagSummary}
                  loading={deadLoading}
                  activeFlag={deadFlag}
                  onFlag={(f) => {
                    setSelectedIssueIds(null);
                    setDeadFlag(f);
                  }}
                  onOpenIssues={() => setSitMode("issues")}
                  draftCount={
                    workbook?.sheets
                      .find((s) => s.kind === "test-cases")
                      ?.rows.filter(
                        (r) =>
                          r.cells.deleted !== "1" &&
                          (r.cells.executionStatus || "Not run") === "Draft",
                      ).length || 0
                  }
                />
              ) : null}
              {sitMode === "cases" ? (
              <>
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
                className="inline-flex flex-wrap items-center gap-1"
                data-testid="sit-source-group"
              >
                <span
                  className="text-[12px] font-medium text-[#8a93a8]"
                  title="Who created the case. All sources = AI + Human."
                >
                  {SOURCE_GROUP_LABEL}
                </span>
                <div
                  className="inline-flex flex-wrap items-center gap-0.5 rounded-[8px] border border-[#e2e6ef] bg-white p-0.5 dark:border-[#2a2a2a] dark:bg-[#141414]"
                  role="group"
                  aria-label="Source filter with counts"
                  data-testid="sit-origin-filter-chips"
                >
                  {(
                    [
                      { id: "all" as const, label: "All sources", n: counts.total },
                      { id: "ai" as const, label: "AI", n: counts.ai },
                      { id: "human" as const, label: "Human", n: counts.human },
                    ] as { id: CaseOrigin | "all"; label: string; n: number }[]
                  ).map((o) => {
                    const active = originFilter === o.id;
                    const muted = o.id === "human" && o.n === 0 && !active;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        data-testid={`sit-origin-chip-${o.id}`}
                        title={
                          o.id === "ai"
                            ? "Generated by AI"
                            : o.id === "human"
                              ? "Added by a person"
                              : "All sources = AI + Human"
                        }
                        className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium transition ${
                          active
                            ? "bg-[#f3f0ff] text-[#5b21b6]"
                            : muted
                              ? "text-[#c0c6d4]"
                              : "text-[#5b647a] hover:bg-[#f8fafc]"
                        }`}
                        aria-pressed={active}
                        onClick={() => {
                          setOriginFilter(o.id);
                          try {
                            localStorage.setItem("sit_v2_origin_filter", o.id);
                          } catch {
                            /* ignore */
                          }
                        }}
                      >
                        {o.label} {o.n}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  data-testid="sit-edited-toggle"
                  title={EDITED_TOGGLE_TOOLTIP}
                  aria-pressed={editedOnly}
                  onClick={() => {
                    setEditedOnly((v) => {
                      const next = !v;
                      try {
                        localStorage.setItem("sit_v2_edited_only", next ? "1" : "0");
                        // Clear legacy "edited" origin persist once migrated.
                        const raw = localStorage.getItem("sit_v2_origin_filter");
                        if (raw === "edited") localStorage.setItem("sit_v2_origin_filter", originFilter);
                      } catch {
                        /* ignore */
                      }
                      return next;
                    });
                  }}
                  className={`rounded-[6px] border px-2 py-0.5 text-[12px] font-medium transition ${
                    editedOnly
                      ? "border-[#f59e0b] bg-[#fffbeb] text-[#b45309]"
                      : "border-[#e2e6ef] bg-white text-[#5b647a] hover:bg-[#f8fafc]"
                  }`}
                >
                  Edited {counts.edited}
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-28 rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-0.5 text-[12px] dark:border-[#2a2a2a] dark:bg-[#141414]"
              />
              </>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5" data-testid="sit-filter-row-b">
              {sitMode === "cases" ? (
              <>
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
                    title="Draft = unfinished row. Edited = content changed by a person after creation."
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
                  className="ml-auto inline-flex items-center gap-1 rounded-[8px] border border-[#e2e6ef] px-2 py-0.5 text-[12px] dark:border-[#2a2a2a]"
                >
                  <TbPlus size={12} /> Add test case
                </button>
              )}
              </>
              ) : null}
            </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col" data-testid="sit-grid-quality-shell">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {sitMode === "issues" ? (
              <SitV2IssuesScreen
                audit={deadAudit}
                flagSummary={flagSummary}
                loading={deadLoading}
                rows={scopeRows}
                draftCount={
                  workbook?.sheets
                    .find((s) => s.kind === "test-cases")
                    ?.rows.filter(
                      (r) =>
                        r.cells.deleted !== "1" &&
                        (r.cells.executionStatus || "Not run") === "Draft",
                    ).length || 0
                }
                canEdit={canEdit}
                acTexts={acTextsById}
                onLinkAc={(rowId, acId) => {
                  if (!canEdit) return;
                  const row = workbook?.sheets
                    .find((s) => s.kind === "test-cases")
                    ?.rows.find((r) => r.id === rowId);
                  const existing = (row?.cells.acIds || row?.cells.ac || "")
                    .split(/[,\s]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (!existing.includes(acId)) existing.push(acId);
                  void patchRow(rowId, { cells: { acIds: existing.join(",") } }, { label: "AC link" });
                }}
                improveDisabledReason={
                  "Live Improve with AI is unavailable this round (returns 501). Use the mock path in tests only."
                }
                onImprove={undefined}
                onOpenInCases={(rowId) => {
                  setSitMode("cases");
                  setSelectedIssueIds(null);
                  setDeadFlag(null);
                  requestAnimationFrame(() => {
                    highlightQualityRow(rowId);
                    const el = document.querySelector(`[data-row-id="${rowId}"]`);
                    el?.scrollIntoView({ block: "center" });
                  });
                }}
                onEditInCases={(rowId) => {
                  setSitMode("cases");
                  setSelectedIssueIds(null);
                  highlightQualityRow(rowId);
                }}
                onShowInCases={(rowIds, filter) => {
                  setSelectedIssueIds(null);
                  if (filter) setDeadFlag(migrateFlaggedFilter(filter));
                  else setDeadFlag(null);
                  if (!filter && rowIds?.length) setSelectedIssueIds(rowIds);
                  setSitMode("cases");
                }}
                onApplyFlaggedFilter={(filter) => {
                  setSelectedIssueIds(null);
                  setDeadFlag(migrateFlaggedFilter(filter));
                  setSitMode("cases");
                }}
              />
            ) : (
            <SitV2Grid
              workbook={displayWorkbook}
              epics={epics}
              canEdit={canEdit}
              ticketFilter={ticketFilter}
              typeFilter={typeFilter}
              statusFilter={statusFilter}
              originFilter={originFilter}
              editedOnly={editedOnly}
              search={search}
              generating={generating}
              layout={columnLayout}
              onLayoutChange={persistLayout}
              qualityFilterActive={deadFlag != null || !!selectedIssueIds?.length}
              onClearQualityFilter={() => {
                setDeadFlag(null);
                setSelectedIssueIds(null);
                setSearch("");
              }}
              deadAudit={deadAudit}
              acTexts={acTextsById}
              totalCaseCount={allWorkingRows.length}
              onPatch={(rowId, body) => {
                if (!canEdit) return;
                void patchRow(rowId, body);
              }}
              onDelete={(rowId) => {
                if (!canEdit) return;
                void softDelete(rowId);
              }}
              onBulkDeleted={(rowIds) => {
                if (!canEdit) return;
                void softDeleteMany(rowIds);
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
            )}
            </div>
            </div>
          </div>
        ) : selected.length > 0 ? (
          <p className="text-[13px] text-[#8a93a8]" data-testid="sit-page-empty-no-cases">
            No cases generated yet for the selected tickets. Click Generate for {selected.length} ticket
            {selected.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="text-[13px] text-[#8a93a8]" data-testid="sit-page-empty-no-selection">
            Open <strong>Jira Tickets</strong>, select stories mapped to this canvas, then Generate.
          </p>
        )}
      </div>

      {improveReview ? (
        <SitV2ImproveReview
          before={improveReview.before}
          after={improveReview.after}
          fixed={improveReview.fixed}
          remaining={improveReview.remaining}
          onDiscard={() => setImproveReview(null)}
          onApply={(fields) => {
            const body: Record<string, string> = {};
            for (const f of fields) {
              if (improveReview.after[f] != null) body[f] = improveReview.after[f]!;
            }
            void patchRow(improveReview.rowId, { cells: body }, { label: "AI improve" });
            setImproveReview(null);
          }}
        />
      ) : null}

      {undoRow && (
        <div
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-[10px] border border-[#e2e6ef] bg-white px-4 py-2 text-[12.5px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]"
          data-testid="sit-bulk-delete-toast"
        >
          {undoRow.rowIds.length === 1
            ? "Row deleted. "
            : `${undoRow.rowIds.length} cases deleted. `}
          <button type="button" className="font-semibold text-[#8664F2]" onClick={() => void undoDelete()}>
            Undo
          </button>
        </div>
      )}

      {addTicketPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          data-testid="sit-add-ticket-picker"
          role="dialog"
          aria-label="Choose ticket for new case"
        >
          <div className="w-full max-w-sm rounded-[12px] border border-[#e2e6ef] bg-white p-4 shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515]">
            <p className="text-[13px] font-semibold text-[#1F1F1F] dark:text-[#ededed]">Add test case to which ticket?</p>
            <p className="mt-1 text-[12px] text-[#5b647a]">Pick a ticket in the working set. Cases are never created without a key.</p>
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {workingKeys.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    data-testid={`sit-add-ticket-option-${k}`}
                    className="w-full rounded-[8px] border border-[#e2e6ef] px-3 py-2 text-left text-[12px] hover:bg-[#f3f0ff] dark:border-[#2a2a2a]"
                    onClick={() => {
                      setAddTicketPickerOpen(false);
                      void createCaseForTicket(k);
                    }}
                  >
                    {k} ({workingSummary.byTicket[k] ?? 0} cases)
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 w-full rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[12px] text-[#5b647a]"
              onClick={() => setAddTicketPickerOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {pickerOpen && (
        <SitV2Picker
          epics={epics}
          selected={selected}
          clarifications={clarifications}
          activeTicketKey={activeTicketKey}
          loadedCounts={workingSummary.byTicket}
          onChange={(tickets) => {
            setSelected(tickets);
            savePersistedSelectedKeys(tickets.map((t) => t.key));
            // R17: selection drives Generate only; applyMergedScope keeps live∪selected view keys.
            applyMergedScope(history, tickets);
            const keys = viewWorkingKeys(
              tickets.map((t) => t.key),
              history,
            );
            if (ticketFilter !== "all" && ticketFilter !== "__unassigned__" && !keys.includes(ticketFilter)) {
              setTicketFilter("all");
              savePersistedScope("all");
            }
          }}
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
