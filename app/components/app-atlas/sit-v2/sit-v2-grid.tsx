"use client";

import { Fragment, useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  TbChevronDown,
  TbChevronRight,
  TbDotsVertical,
  TbPlus,
  TbCopy,
  TbTrash,
} from "react-icons/tb";
import type { SitDeadAudit, SitEpic, SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import { displayModuleFeature } from "@/app/lib/sit-module-feature";
import { OriginGlyph, provenanceTooltip } from "./sit-v2-bits";
import { getCaseProvenance } from "@/app/lib/sit-case-provenance";
import { ticketKeyOf } from "@/app/lib/sit-scope";
import { SitV2EditableCell, type CellCoord } from "./sit-v2-editable-cell";
import { SitV2ListEditor } from "./sit-v2-list-editor";
import { SitV2Select } from "./sit-v2-select";
import { SitV2ExpandPanel } from "./sit-v2-expand-panel";
import { SitQualityFlagChip } from "./sit-quality-flag-chip";
import {
  SIT_CHECKBOX_COL_WIDTH,
  SIT_DEFAULT_WIDTHS,
  SIT_MIN_WIDTHS,
  colWidth,
  fitColumnWidthsToContainer,
  type SitColumnLayout,
  type SitOrderableColumnId,
} from "./sit-v2-prefs";
import { sanitizeUserText } from "@/app/lib/sit-sanitize-text";
import { bulletLines, normalizeBulletText, renderBulletLines } from "./sit-v2-bullets";
import { SitV2EditDot } from "./sit-v2-edit-dot";

function placeholdersForRow(row: SitSheetRow): string[] {
  const set = new Set<string>();
  for (const [k, v] of Object.entries(row.cells)) {
    if (k.startsWith("td_") && k.length > 3) set.add(k.slice(3));
    if (typeof v === "string") {
      for (const m of v.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) set.add(m[1]!);
    }
  }
  return [...set].sort();
}

const TYPE_STYLE: Record<string, string> = {
  Positive: "bg-[#E2EFDA] text-[#375623]",
  Negative: "bg-[#FCE4E4] text-[#9b1c1c]",
  Boundary: "bg-[#FFF2CC] text-[#7a5b00]",
  "Business Rule": "bg-[#E4DFEC] text-[#4a3a6b]",
  Security: "bg-[#F8CBAD] text-[#7a3e12]",
  Concurrency: "bg-[#dde7f5] text-[#1e3a5f]",
  Validation: "bg-[#DDEBF7] text-[#1e3a5f]",
};

const STATUS_STYLE: Record<string, string> = {
  Draft: "bg-[#e0e7ff] text-[#3730a3]",
  "Not run": "bg-[#f3f4f6] text-[#6b7280]",
  Passed: "bg-[#d1fae5] text-[#065f46]",
  Failed: "bg-[#fee2e2] text-[#991b1b]",
  Partial: "bg-[#ffedd5] text-[#9a3412]",
  Blocked: "bg-[#fce7f3] text-[#9d174d]",
  Skipped: "bg-[#e5e7eb] text-[#4b5563]",
  Stale: "bg-[#fef3c7] text-[#92400e]",
};

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft", group: "Authoring" },
  { value: "Not run", label: "Not run", group: "Results" },
  { value: "Passed", label: "Passed", group: "Results" },
  { value: "Failed", label: "Failed", group: "Results" },
  { value: "Partial", label: "Partial", group: "Results" },
  { value: "Blocked", label: "Blocked", group: "Results" },
  { value: "Skipped", label: "Skipped", group: "Results" },
];

const BULK_STATUSES = ["Draft", "Not run", "Passed", "Failed", "Partial", "Blocked", "Skipped"];
const EDITABLE_FIELDS = ["scenario", "preconditions", "steps", "expected"] as const;

function StepsWithChips({ steps }: { steps: string }) {
  // Round 6 A6: display scrub (no DB rewrite) — arrows / dangling "to" cleaned here.
  const scrubbed = sanitizeUserText(steps || "");
  const parts = scrubbed.split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
  return (
    <span className="whitespace-pre-wrap text-[12px]">
      {parts.map((p, i) => {
        const m = p.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
        if (m) {
          return (
            <span
              key={i}
              className="mx-0.5 inline-flex rounded bg-[#ede9fe] px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#5b21b6]"
              title="Filled from Test data"
              data-testid="sit-testdata-token"
            >
              {m[1]}
            </span>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </span>
  );
}

function TestDataBlockInline({ row }: { row: SitSheetRow }) {
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(row.cells)) {
    if (k.startsWith("td_") && v) entries.push([k.slice(3), v]);
  }
  const ph = [...(row.cells.steps || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!);
  for (const p of ph) {
    if (!entries.some(([k]) => k === p)) entries.push([p, row.cells[`td_${p}`] || ""]);
  }
  if (!entries.length) return null;
  return (
    <div className="mt-2 rounded-[6px] border border-dashed border-[#c4b5fd]/60 bg-[#faf5ff]/50 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7c3aed]">Test data</span>
      <div className="mt-1 space-y-0.5 font-mono text-[10.5px]">
        {entries.map(([k, v]) => (
          <div key={k}>
            {k}={v || "(empty)"}
          </div>
        ))}
      </div>
    </div>
  );
}

/** R7-07: clamp by whole items (children already sliced); never mid-line cut via maxHeight. */
function StepsClamp({
  open,
  onShowMore,
  children,
  lines = 4,
  empty,
  itemCount,
}: {
  open: boolean;
  onShowMore: () => void;
  children: ReactNode;
  lines?: number;
  empty?: boolean;
  itemCount?: number;
}) {
  if (empty) return <>{children}</>;
  if (open) return <>{children}</>;
  const needsMore = (itemCount ?? lines + 1) > lines;
  if (!needsMore) return <>{children}</>;
  return (
    <div className="relative" data-testid="sit-steps-clamp">
      <div data-testid="sit-steps-clamp-body">{children}</div>
      <button
        type="button"
        className="mt-1 text-[12px] font-medium text-[#8664F2]"
        onClick={onShowMore}
        data-testid="sit-show-more"
      >
        Show more
      </button>
    </div>
  );
}

function EmptyPlaceholder({ text }: { text: string }) {
  return <span className="text-[12px] italic text-[#9ca3af]">{text}</span>;
}

function RowMenu({
  canEdit,
  onDuplicate,
  onDelete,
  onInsertBelow,
  open: controlledOpen,
  onOpenChange,
}: {
  canEdit: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertBelow?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = controlledOpen ?? openLocal;
  const setOpen = onOpenChange ?? setOpenLocal;
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [setOpen]);
  if (!canEdit) return null;
  return (
    <div className="relative opacity-0 group-hover:opacity-100 focus-within:opacity-100" ref={ref} data-testid="sit-row-menu-wrap">
      <button
        type="button"
        className="rounded p-0.5 text-[#6b7280] hover:bg-[#f3f4f6]"
        aria-label="Row menu"
        data-testid="sit-row-menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <TbDotsVertical size={14} />
      </button>
      {open && (
        <div
          className="absolute left-0 z-20 mt-1 w-36 rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[11px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]"
          data-testid="sit-row-context-menu"
        >
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
          >
            <TbCopy size={12} /> Duplicate
          </button>
          {onInsertBelow ? (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
              onClick={() => {
                setOpen(false);
                onInsertBelow();
              }}
            >
              <TbPlus size={12} /> Insert below
            </button>
          ) : null}
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[#b91c1c] hover:bg-[#fef2f2]"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <TbTrash size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function ColResizeHandle({
  colId,
  onResize,
}: {
  colId: string;
  onResize: (colId: string, width: number) => void;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      data-testid={`sit-col-resize-${colId}`}
      className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize hover:bg-white/40"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const th = (e.target as HTMLElement).closest("th");
        const w = th?.getBoundingClientRect().width ?? SIT_MIN_WIDTHS[colId] ?? 100;
        start.current = { x: e.clientX, w };
        const onMove = (ev: MouseEvent) => {
          if (!start.current) return;
          const next = Math.max(SIT_MIN_WIDTHS[colId] ?? 72, start.current.w + (ev.clientX - start.current.x));
          onResize(colId, next);
        };
        const onUp = () => {
          start.current = null;
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onResize(colId, SIT_MIN_WIDTHS[colId] ?? 100);
      }}
    />
  );
}

function resolveOrder(layout: SitColumnLayout): SitOrderableColumnId[] {
  let order = [...layout.order];
  if (layout.splitPrioSev) {
    order = order.flatMap((id) => (id === "prioSev" ? (["priority", "severity"] as SitOrderableColumnId[]) : [id]));
    order = order.filter((id) => id !== "prioSev");
  } else {
    order = order.filter((id) => id !== "priority" && id !== "severity");
    if (!order.includes("prioSev")) {
      const i = order.indexOf("feature");
      order.splice(i >= 0 ? i + 1 : 0, 0, "prioSev");
    }
  }
  return order;
}

export function SitV2Grid({
  workbook,
  epics,
  canEdit,
  ticketFilter,
  typeFilter,
  statusFilter,
  originFilter,
  editedOnly = false,
  search,
  generating,
  layout,
  onLayoutChange,
  onPatch,
  onDelete,
  onBulkDeleted,
  onAdd,
  onDuplicate,
  qualityFilterActive = false,
  onClearQualityFilter,
  totalCaseCount,
  deadAudit = null,
  acTexts,
}: {
  workbook: SitWorkbook;
  epics: SitEpic[];
  canEdit: boolean;
  ticketFilter: string | "all";
  typeFilter: string | null;
  statusFilter: string | null;
  originFilter: "all" | "ai" | "human";
  editedOnly?: boolean;
  search: string;
  generating?: boolean;
  layout: SitColumnLayout;
  onLayoutChange: (next: SitColumnLayout) => void;
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  onDelete: (rowId: string) => void;
  /** R10-03: after confirmed bulk delete, parent shows undo toast. */
  onBulkDeleted?: (rowIds: string[]) => void;
  onAdd: () => void;
  onDuplicate: (rowId: string) => void;
  qualityFilterActive?: boolean;
  onClearQualityFilter?: () => void;
  /** Unfiltered live case count (before quality filter). */
  totalCaseCount?: number;
  deadAudit?: SitDeadAudit | null;
  acTexts?: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [ctxMenuRow, setCtxMenuRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    if (!bulkDeleteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setBulkDeleteOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bulkDeleteOpen]);
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [editing, setEditing] = useState<CellCoord | null>(null);
  const [dragCol, setDragCol] = useState<SitOrderableColumnId | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const gridRootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const userResizedRef = useRef<Set<string>>(new Set());

  const clearCellSelection = useCallback(() => {
    setSelected(null);
    setEditing(null);
  }, []);

  // A1: clear cell selection on click outside the grid (not when focus moves into editor/popover)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const root = gridRootRef.current;
      if (!root) return;
      const t = e.target as Node | null;
      if (!t) return;
      if (root.contains(t)) return;
      // Portaled popovers (type/status selects) live outside the grid DOM
      if ((t as HTMLElement).closest?.("[data-sit-select-popover='1']")) return;
      clearCellSelection();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // If an editor or popover is open, let them handle Escape first; still clear selection
      if ((e.target as HTMLElement)?.closest?.("[data-sit-select-popover='1']")) return;
      clearCellSelection();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [clearCellSelection]);
  const hide = (id: string) => layout.hidden.includes(id as never);
  const cellPad = "px-2 py-2";
  const tableText = "text-[12px]";
  const order = useMemo(() => resolveOrder(layout), [layout]);
  // R8-01: re-fit when the grid container width changes (Explorer open/close).
  useEffect(() => {
    const el = scrollRef.current || gridRootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.clientWidth;
      setContainerWidth(Math.floor(w));
    });
    ro.observe(el);
    setContainerWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // Clear user-resize locks after "Reset layout" restores defaults.
  useEffect(() => {
    const restored = Object.keys(SIT_DEFAULT_WIDTHS).every(
      (id) => (layout.widths[id] ?? SIT_DEFAULT_WIDTHS[id]) === SIT_DEFAULT_WIDTHS[id],
    );
    if (restored) userResizedRef.current.clear();
  }, [layout.widths]);

  const visibleCols = useMemo(
    () =>
      order.filter((id) => {
        if (id === "scenario") return true;
        if (id === "priority" || id === "severity") return layout.splitPrioSev;
        if (id === "prioSev") return !layout.splitPrioSev && !hide("prioSev");
        return !hide(id);
      }),
    [order, layout, hide],
  );

  /** Columns included in the fit (ID + visible + Status). */
  const fitColIds = useMemo(
    () => ["id", ...visibleCols, "status"] as string[],
    [visibleCols],
  );

  const fittedWidths = useMemo(() => {
    const preferred: Record<string, number> = {};
    for (const id of fitColIds) preferred[id] = colWidth(layout, id);
    const available = Math.max(0, containerWidth - SIT_CHECKBOX_COL_WIDTH);
    if (!containerWidth) return preferred;
    return fitColumnWidthsToContainer(preferred, fitColIds, available, {
      userResized: userResizedRef.current,
    });
  }, [layout, fitColIds, containerWidth]);

  const displayWidth = useCallback(
    (colId: string) =>
      Math.max(SIT_MIN_WIDTHS[colId] ?? 72, fittedWidths[colId] ?? colWidth(layout, colId)),
    [fittedWidths, layout],
  );

  const colCount = 2 + visibleCols.length + 1; // checkbox+ID + cols + status

  const allLiveCount = useMemo(() => {
    const tc = workbook.sheets.find((s) => s.kind === "test-cases");
    return (tc?.rows || []).filter((r) => r.cells.deleted !== "1").length;
  }, [workbook]);

  const rows = useMemo(() => {
    const tc = workbook.sheets.find((s) => s.kind === "test-cases");
    let list = (tc?.rows || []).filter((r) => r.cells.deleted !== "1");
    if (ticketFilter === "__unassigned__") {
      const keys = new Set((workbook.sourceIssueKeys || []).map((k) => ticketKeyOf({ cells: { requirementId: k } })));
      list = list.filter((r) => {
        const k = ticketKeyOf(r);
        return !k || !keys.has(k);
      });
    } else if (ticketFilter !== "all") {
      list = list.filter((r) => ticketKeyOf(r) === ticketKeyOf({ cells: { requirementId: ticketFilter } }));
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
    return list;
  }, [workbook, ticketFilter, typeFilter, statusFilter, originFilter, editedOnly, search]);

  const schedulePatch = (rowId: string, cells: Record<string, string>) => {
    const key = `${rowId}:${Object.keys(cells).join(",")}`;
    clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      onPatch(rowId, { cells });
    }, 400);
  };

  useEffect(
    () => () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const bulkSetStatus = (status: string) => {
    if (!canEdit) return;
    for (const id of selectedRows) onPatch(id, { executionStatus: status });
  };

  const moveCell = useCallback(
    (dir: "tab" | "shift-tab" | "up" | "down" | "left" | "right") => {
      if (!selected) return;
      const ri = rows.findIndex((r) => r.id === selected.rowId);
      if (ri < 0) return;
      let fi = EDITABLE_FIELDS.indexOf(selected.field as (typeof EDITABLE_FIELDS)[number]);
      if (fi < 0) fi = 0;
      let nri = ri;
      let nfi = fi;
      if (dir === "tab" || dir === "right") {
        nfi++;
        if (nfi >= EDITABLE_FIELDS.length) {
          nfi = 0;
          nri++;
        }
      } else if (dir === "shift-tab" || dir === "left") {
        nfi--;
        if (nfi < 0) {
          nfi = EDITABLE_FIELDS.length - 1;
          nri--;
        }
      } else if (dir === "up") nri--;
      else if (dir === "down") nri++;
      if (nri < 0 || nri >= rows.length) return;
      setSelected({ rowId: rows[nri]!.id, field: EDITABLE_FIELDS[nfi]! });
      setEditing(null);
    },
    [rows, selected],
  );

  const commitCell = (rowId: string, field: string, value: string) => {
    schedulePatch(rowId, { [field]: value });
    setEditing(null);
  };

  /** R10-06: Actual result / Notes — top-level PATCH, never markEdited. */
  const commitExecutionData = (rowId: string, field: string, value: string) => {
    if (field === "actualResult") onPatch(rowId, { actualResult: value });
    else if (field === "userNote") onPatch(rowId, { userNote: value });
    setEditing(null);
  };

  const toggleExpand = (rowId: string) => {
    setExpanded((e) => ({ ...e, [rowId]: !e[rowId] }));
  };

  const setWidth = (colId: string, width: number) => {
    userResizedRef.current.add(colId);
    onLayoutChange({
      ...layout,
      widths: { ...layout.widths, [colId]: width },
    });
  };

  const reorderCols = (from: SitOrderableColumnId, to: SitOrderableColumnId) => {
    if (from === to) return;
    const next = [...layout.order];
    const fi = next.indexOf(from === "priority" || from === "severity" ? "prioSev" : from);
    const ti = next.indexOf(to === "priority" || to === "severity" ? "prioSev" : to);
    if (fi < 0 || ti < 0) return;
    const [item] = next.splice(fi, 1);
    next.splice(ti, 0, item!);
    onLayoutChange({ ...layout, order: next });
  };

  const headerLabel = (id: SitOrderableColumnId): string => {
    switch (id) {
      case "module":
        return "Module";
      case "feature":
        return "Feature";
      case "prioSev":
        return "Priority / Severity";
      case "priority":
        return "Priority";
      case "severity":
        return "Severity";
      case "scenario":
        return "Scenario";
      case "preconditions":
        return "Preconditions";
      case "steps":
        return "Test Steps";
      case "expected":
        return "Expected Result";
      case "notes":
        return "Notes";
      default:
        return id;
    }
  };

  const renderPrioSev = (row: SitSheetRow, field: "priority" | "severity" | "both") => {
    const fields: ("priority" | "severity")[] =
      field === "both" ? ["priority", "severity"] : [field];
    return (
      <div className={`flex ${field === "both" ? "flex-row flex-wrap items-center" : "flex-col"} gap-1`}>
        {fields.map((f) => {
          const val = row.cells[f] || "Medium";
          const style =
            val === "High"
              ? "bg-[#fee2e2] text-[#991b1b]"
              : val === "Low"
                ? "bg-[#dcfce7] text-[#166534]"
                : "bg-[#fef3c7] text-[#92400e]";
          const short = `${f === "priority" ? "P" : "S"} ${val === "Medium" ? "Med" : val}`;
          const full = f === "priority" ? `Priority ${val}` : `Severity ${val}`;
          return (
            <SitV2Select
              key={f}
              pill
              disabled={!canEdit}
              value={val}
              aria-label={f === "priority" ? "Priority" : "Severity"}
              data-testid={`sit-${f}-select`}
              buttonClassName={`inline-flex shrink-0 whitespace-nowrap items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold font-[inherit] ${style}`}
              options={["High", "Medium", "Low"].map((v) => ({
                value: v,
                label: f === "priority" ? `Priority ${v}` : `Severity ${v}`,
              }))}
              triggerLabel={
                <span className="inline-flex whitespace-nowrap items-center gap-1">
                  <span className="hidden min-[1440px]:inline">{full}</span>
                  <span className="min-[1440px]:hidden">{short}</span>
                  {row.cells[`${f}Override`] === "1" ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8664F2]" title="Manual override" />
                  ) : null}
                </span>
              }
              onChange={(v) => onPatch(row.id, { [f]: v })}
            />
          );
        })}
      </div>
    );
  };

  const renderBodyCell = (row: SitSheetRow, colId: SitOrderableColumnId, open: boolean) => {
    const mf = displayModuleFeature(row.cells, epics);
    const isSel = (f: string) => selected?.rowId === row.id && selected.field === f;
    const isEdit = (f: string) => editing?.rowId === row.id && editing.field === f;
    const w = displayWidth(colId);
    const style = { width: w, minWidth: SIT_MIN_WIDTHS[colId] ?? 72 };

    if (colId === "module") {
      return (
        <td key={colId} className={`${cellPad} align-top`} style={style} title="Derived from Jira epic">
          {mf.module}
        </td>
      );
    }
    if (colId === "feature") {
      return (
        <td key={colId} className={`${cellPad} align-top`} style={style} title="Derived from ticket summary">
          {mf.feature}
        </td>
      );
    }
    if (colId === "prioSev") {
      return (
        <td key={colId} className={`${cellPad} align-top`} style={style}>
          {renderPrioSev(row, "both")}
        </td>
      );
    }
    if (colId === "priority" || colId === "severity") {
      return (
        <td key={colId} className={`${cellPad} align-top`} style={style}>
          {renderPrioSev(row, colId)}
        </td>
      );
    }
    if (colId === "scenario") {
      const typeBtn = `shrink-0 max-w-[9.5rem] rounded px-1.5 py-0.5 text-[12px] font-semibold font-[inherit] ${
        TYPE_STYLE[row.cells.testType || ""] || "bg-[#eee] text-[#444]"
      }`;
      const patchType = (t: string) => onPatch(row.id, { cells: { testType: t }, testType: t });
      return (
        <SitV2EditableCell
          key={colId}
          rowId={row.id}
          field="scenario"
          value={row.cells.scenario || ""}
          canEdit={canEdit}
          selected={isSel("scenario")}
          editing={isEdit("scenario")}
          onSelect={setSelected}
          onStartEdit={setEditing}
          onCancelEdit={clearCellSelection}
          onCommit={commitCell}
          onMove={moveCell}
          renderEditor={({ value, commit, cancel }) => (
            <div className="flex min-w-[12rem] items-start gap-1.5" data-testid="sit-scenario-type-editor">
              <SitV2Select
                value={row.cells.testType || "Positive"}
                aria-label="Scenario type"
                data-testid="sit-scenario-type-select"
                options={Object.keys(TYPE_STYLE).map((t) => ({ value: t, label: t }))}
                onChange={patchType}
                buttonClassName={typeBtn}
              />
              <textarea
                autoFocus
                rows={2}
                className="min-h-[2.5rem] min-w-0 flex-1 resize-y rounded border border-[#8664F2] bg-white px-1.5 py-1 text-[12px] font-[inherit] leading-snug outline-none dark:bg-[#141414]"
                defaultValue={value}
                data-testid="sit-scenario-title-editor"
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancel();
                    clearCellSelection();
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    commit((e.target as HTMLTextAreaElement).value);
                  }
                }}
                onBlur={(e) => {
                  // Delay so portal type-option click can land first.
                  const v = e.target.value;
                  requestAnimationFrame(() => {
                    if (document.querySelector("[data-sit-select-popover='1']")) return;
                    commit(v);
                  });
                }}
              />
            </div>
          )}
          display={
            <div className="flex min-w-0 flex-col gap-0.5" data-testid="sit-scenario-cell">
              <div className="flex min-w-0 items-start gap-1.5">
                <SitV2Select
                  value={row.cells.testType || "Positive"}
                  aria-label="Scenario type"
                  data-testid="sit-scenario-type-chip"
                  disabled={!canEdit}
                  options={Object.keys(TYPE_STYLE).map((t) => ({ value: t, label: t }))}
                  onChange={patchType}
                  buttonClassName={typeBtn}
                />
              </div>
              {(deadAudit?.flagsByRowId?.[row.id]?.length ?? 0) > 0 ? (
                <div className="flex max-w-full flex-wrap gap-1" data-testid="sit-scenario-flag-row">
                  <SitQualityFlagChip hits={deadAudit?.flagsByRowId?.[row.id]} />
                </div>
              ) : null}
              <span
                className="min-w-0 w-full whitespace-pre-wrap break-words text-[12px]"
                data-testid="sit-scenario-title"
              >
                {row.cells.scenario}
                <SitV2EditDot row={row} field="scenario" />
                <SitV2EditDot row={row} field="testType" />
              </span>
            </div>
          }
        />
      );
    }
    if (colId === "preconditions") {
      return (
        <SitV2EditableCell
          key={colId}
          rowId={row.id}
          field="preconditions"
          value={row.cells.preconditions || ""}
          canEdit={canEdit}
          selected={isSel("preconditions")}
          editing={isEdit("preconditions")}
          onSelect={setSelected}
          onStartEdit={setEditing}
          onCancelEdit={clearCellSelection}
          onCommit={commitCell}
          onMove={moveCell}
          renderEditor={({ value, commit, cancel }) => (
            <SitV2ListEditor
              kind="bullets"
              initialValue={value}
              placeholders={placeholdersForRow(row)}
              onSave={commit}
              onCancel={cancel}
            />
          )}
                      display={
                        <span>
                          <span className="mr-1 rounded bg-[#ede9fe] px-1.5 py-0.5 text-[12px] font-semibold text-[#5b21b6]">
                            {row.cells.requirementId || ", "}
                          </span>
                          <SitV2EditDot row={row} field="preconditions" />
                          {!normalizeBulletText(row.cells.preconditions || "") ? (
                            <EmptyPlaceholder text="Add preconditions" />
                          ) : (
                            <StepsClamp
                              open={open}
                              empty={false}
                              lines={3}
                              itemCount={bulletLines(row.cells.preconditions || "").length}
                              onShowMore={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                            >
                              {renderBulletLines(row.cells.preconditions || "", { max: open ? undefined : 3 })}
                            </StepsClamp>
                          )}
                        </span>
                      }
        />
      );
    }
    if (colId === "steps") {
      return (
        <SitV2EditableCell
          key={colId}
          rowId={row.id}
          field="steps"
          value={row.cells.steps || ""}
          canEdit={canEdit}
          selected={isSel("steps")}
          editing={isEdit("steps")}
          onSelect={setSelected}
          onStartEdit={setEditing}
          onCancelEdit={clearCellSelection}
          onCommit={commitCell}
          onMove={moveCell}
          renderEditor={({ value, commit, cancel }) => (
            <SitV2ListEditor
              kind="steps"
              initialValue={value}
              placeholders={placeholdersForRow(row)}
              onSave={commit}
              onCancel={cancel}
            />
          )}
                      display={
                        <div>
                          <SitV2EditDot row={row} field="steps" />
                          {!((row.cells.steps || "").trim()) ? (
                            <EmptyPlaceholder text="Add steps" />
                          ) : (
                            <StepsClamp
                              open={open}
                              lines={4}
                              itemCount={(row.cells.steps || "").split(/\n/).filter((l) => l.trim()).length}
                              onShowMore={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                            >
                              <StepsWithChips
                                steps={
                                  open
                                    ? row.cells.steps || ""
                                    : (row.cells.steps || "")
                                        .split(/\n/)
                                        .filter((l) => l.trim())
                                        .slice(0, 4)
                                        .join("\n")
                                }
                              />
                            </StepsClamp>
                          )}
                          {open && <TestDataBlockInline row={row} />}
                        </div>
                      }
        />
      );
    }
    if (colId === "expected") {
      return (
        <SitV2EditableCell
          key={colId}
          rowId={row.id}
          field="expected"
          value={row.cells.expected || ""}
          canEdit={canEdit}
          selected={isSel("expected")}
          editing={isEdit("expected")}
          onSelect={setSelected}
          onStartEdit={setEditing}
          onCancelEdit={clearCellSelection}
          onCommit={commitCell}
          onMove={moveCell}
          renderEditor={({ value, commit, cancel }) => (
            <SitV2ListEditor
              kind="bullets"
              initialValue={value}
              placeholders={placeholdersForRow(row)}
              onSave={commit}
              onCancel={cancel}
            />
          )}
          display={
            <div>
              <SitV2EditDot row={row} field="expected" />
              {!normalizeBulletText(row.cells.expected || "") ? (
                <EmptyPlaceholder text="Add expected result" />
              ) : (
                <StepsClamp
                  open={open}
                  lines={3}
                  itemCount={bulletLines(row.cells.expected || "").length}
                  onShowMore={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                >
                  {renderBulletLines(row.cells.expected || "", { max: open ? undefined : 3 })}
                </StepsClamp>
              )}
            </div>
          }
        />
      );
    }
    if (colId === "notes") {
      const note = row.cells.userNote || "";
      const noteTip = row.cells.executionDataBy
        ? `Updated by ${row.cells.executionDataBy}${
            row.cells.executionDataAt
              ? `, ${new Date(Number(row.cells.executionDataAt)).toLocaleString()}`
              : ""
          }`
        : undefined;
      const noteLines = note.split(/\n/).filter(Boolean);
      return (
        <SitV2EditableCell
          key={colId}
          rowId={row.id}
          field="userNote"
          value={note}
          canEdit={canEdit}
          multiline
          selected={isSel("userNote")}
          editing={isEdit("userNote")}
          onSelect={setSelected}
          onStartEdit={setEditing}
          onCancelEdit={clearCellSelection}
          onCommit={commitExecutionData}
          onMove={moveCell}
          className="align-top"
          display={
            <div title={noteTip} data-testid="sit-notes-cell">
              {!note ? (
                <EmptyPlaceholder text="Add a note" />
              ) : (
                <StepsClamp
                  open={open}
                  lines={3}
                  itemCount={noteLines.length}
                  onShowMore={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                >
                  <span className="whitespace-pre-wrap text-[12px]">
                    {(open ? noteLines : noteLines.slice(0, 3)).join("\n")}
                  </span>
                </StepsClamp>
              )}
            </div>
          }
        />
      );
    }
    return null;
  };

  return (
    <div
      ref={gridRootRef}
      className="flex h-full min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]"
      data-testid="sit-v2-grid-root"
      onBlur={(e) => {
        // A1: grid lost focus (not to a child editor/popover)
        const next = e.relatedTarget as Node | null;
        if (next && e.currentTarget.contains(next)) return;
        if (next && (next as HTMLElement).closest?.("[data-sit-select-popover='1']")) return;
        // Defer so click-to-select on another cell wins
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (gridRootRef.current?.contains(active)) return;
          if ((active as HTMLElement | null)?.closest?.("[data-sit-select-popover='1']")) return;
          clearCellSelection();
        });
      }}
    >
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-auto" data-testid="sit-v2-grid-scroll">
        {!canEdit && (
          <div className="sticky top-0 z-[5] flex items-center gap-2 border-b border-[#e2e6ef] bg-[#f8fafc] px-3 py-1.5">
            <span
              className="inline-flex items-center rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6b7280]"
              data-testid="sit-view-only-chip"
            >
              View only
            </span>
          </div>
        )}
        {selectedRows.size > 0 && canEdit && (
          <div
            className="sticky top-0 z-[4] flex flex-wrap items-center gap-2 border-b border-[#e2e6ef] bg-[#f8fafc] px-3 py-1.5 text-[11px]"
            data-testid="sit-bulk-bar"
          >
            <span className="font-medium text-[#5b647a]">{selectedRows.size} selected</span>
            <span className="text-[#9ca3af]">Set status:</span>
            {BULK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 font-medium hover:border-[#8664F2]"
                onClick={() => bulkSetStatus(s)}
              >
                {s}
              </button>
            ))}
            <button type="button" className="text-[#8664F2]" onClick={() => setSelectedRows(new Set())}>
              Clear selection
            </button>
            <span className="ml-auto hidden h-4 w-px bg-[#d1d5db] sm:block" aria-hidden />
            <button
              type="button"
              className="rounded-full border border-[#fecaca] bg-[#fef2f2] px-2.5 py-0.5 font-semibold text-[#b91c1c] hover:bg-[#fee2e2]"
              data-testid="sit-bulk-delete"
              onClick={() => setBulkDeleteOpen(true)}
            >
              Delete {selectedRows.size}
            </button>
          </div>
        )}
        {bulkDeleteOpen && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 p-4"
            data-testid="sit-bulk-delete-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sit-bulk-delete-title"
          >
            <div className="w-full max-w-sm rounded-[12px] border border-[#e2e6ef] bg-white p-4 shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515]">
              <h2 id="sit-bulk-delete-title" className="text-[14px] font-semibold text-[#1F1F1F]">
                Delete {selectedRows.size} cases?
              </h2>
              <p className="mt-2 text-[12.5px] text-[#5b647a]">
                You can undo this for a short time.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-[#e2e6ef] px-3 py-1.5 text-[12px] font-medium"
                  data-testid="sit-bulk-delete-cancel"
                  onClick={() => setBulkDeleteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[#fecaca] bg-[#b91c1c] px-3 py-1.5 text-[12px] font-semibold text-white"
                  data-testid="sit-bulk-delete-confirm"
                  onClick={() => {
                    const ids = [...selectedRows];
                    setSelectedRows(new Set());
                    setBulkDeleteOpen(false);
                    if (onBulkDeleted) onBulkDeleted(ids);
                    else for (const id of ids) onDelete(id);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        <table className={`w-full table-fixed border-collapse font-sans ${tableText}`} data-testid="sit-v2-grid-table">
          <thead className="sticky top-0 z-[2] bg-[#1F4E78] text-white">
            <tr>
              <th className={`sticky left-0 z-[3] w-8 bg-[#1F4E78] ${cellPad}`}>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  className="accent-[#8664F2]"
                  checked={rows.length > 0 && rows.every((r) => selectedRows.has(r.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedRows(new Set(rows.map((r) => r.id)));
                    else setSelectedRows(new Set());
                  }}
                />
              </th>
              <th
                className={`sticky left-8 z-[3] relative bg-[#1F4E78] ${cellPad} pl-2 text-left text-[12px] font-semibold`}
                style={{
                  width: displayWidth("id"),
                  minWidth: SIT_MIN_WIDTHS.id,
                }}
                data-testid="sit-col-header-id"
              >
                ID
                <ColResizeHandle colId="id" onResize={setWidth} />
              </th>
              {visibleCols.map((colId) => (
                <th
                  key={colId}
                  draggable
                  onDragStart={() => setDragCol(colId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragCol) reorderCols(dragCol, colId);
                    setDragCol(null);
                  }}
                  className={`relative ${cellPad} text-left text-[12px] font-semibold`}
                  style={{
                    width: displayWidth(colId),
                    minWidth: SIT_MIN_WIDTHS[colId],
                  }}
                  title={
                    colId === "prioSev"
                      ? "Priority = how soon to test this. Severity = how bad it is if it fails."
                      : undefined
                  }
                  data-testid={`sit-col-header-${colId}`}
                >
                  {headerLabel(colId)}
                  <ColResizeHandle colId={colId} onResize={setWidth} />
                </th>
              ))}
              <th
                className={`sticky right-0 z-[3] relative bg-[#1F4E78] ${cellPad} text-left text-[12px] font-semibold`}
                style={{
                  minWidth: SIT_MIN_WIDTHS.status,
                  width: displayWidth("status"),
                }}
                data-testid="sit-col-header-status"
              >
                Result
                <ColResizeHandle colId="status" onResize={setWidth} />
              </th>
            </tr>
          </thead>
          <tbody>
            {generating && rows.length === 0 &&
              [0, 1, 2].map((i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td colSpan={colCount} className="border-b border-[#f3f4f6] px-3 py-4">
                    <div className="h-4 w-3/4 rounded bg-[#e5e7eb]" />
                  </td>
                </tr>
              ))}
            {rows.map((row) => {
              const open = !!expanded[row.id];
              const prov = getCaseProvenance(row.cells);
              const edited = prov.edited;
              const tip = provenanceTooltip(row.cells);
              return (
                <Fragment key={row.id}>
                  <tr
                    className="group border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:border-[#1a1a1a] dark:hover:bg-[#141414]"
                    data-origin={row.cells.origin || "ai"}
                    data-row-id={row.id}
                    data-case-id={row.cells.caseId || ""}
                    onContextMenu={(e) => {
                      if (!canEdit) return;
                      e.preventDefault();
                      setCtxMenuRow(row.id);
                    }}
                  >
                    <td className="sticky left-0 z-[1] bg-white px-2 py-2 dark:bg-[#101010]">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id)}
                        onChange={() => {
                          setSelectedRows((prev) => {
                            const n = new Set(prev);
                            if (n.has(row.id)) n.delete(row.id);
                            else n.add(row.id);
                            return n;
                          });
                        }}
                        className="accent-[#8664F2]"
                      />
                    </td>
                    <td
                      className="sticky left-8 z-[1] whitespace-nowrap bg-white px-2 py-2 align-top font-mono text-[11px] font-semibold dark:bg-[#101010]"
                      title={tip}
                      data-testid="sit-id-cell"
                      style={{
                        width: displayWidth("id"),
                        minWidth: SIT_MIN_WIDTHS.id,
                      }}
                    >
                      <div className="inline-flex max-w-full items-center gap-0.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-left"
                          aria-expanded={open}
                          aria-label={open ? "Collapse row detail" : "Expand row detail"}
                          data-testid="sit-row-chevron"
                          onClick={() => toggleExpand(row.id)}
                          onDoubleClick={() => toggleExpand(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              toggleExpand(row.id);
                            }
                          }}
                        >
                          {open ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                          <OriginGlyph origin={prov.origin} edited={edited} title={tip} />
                          <span className="whitespace-nowrap">
                            {row.cells.caseId || row.cells.tcId || (
                              <span className="text-[#9ca3af]" title="ID pending">
                                —
                              </span>
                            )}
                          </span>
                        </button>
                        <RowMenu
                          canEdit={canEdit}
                          open={ctxMenuRow === row.id}
                          onOpenChange={(v) => setCtxMenuRow(v ? row.id : null)}
                          onDuplicate={() => onDuplicate(row.id)}
                          onDelete={() => onDelete(row.id)}
                          onInsertBelow={onAdd}
                        />
                      </div>
                    </td>
                    {visibleCols.map((colId) => renderBodyCell(row, colId, open))}
                    <td
                      className="sticky right-0 z-[1] bg-white px-2 py-2 align-top dark:bg-[#101010]"
                      style={{
                        width: displayWidth("status"),
                        minWidth: SIT_MIN_WIDTHS.status,
                      }}
                      data-testid="sit-result-cell"
                    >
                      {(() => {
                        const st = row.cells.executionStatus || "Not run";
                        const actual = row.cells.actualResult || "";
                        const needsActualHint = ["Failed", "Partial", "Blocked"].includes(st) && !actual;
                        const showActualArea = !["Draft", "Not run"].includes(st);
                        const actualTip = row.cells.executionDataBy
                          ? `Updated by ${row.cells.executionDataBy}${
                              row.cells.executionDataAt
                                ? `, ${new Date(Number(row.cells.executionDataAt)).toLocaleString()}`
                                : ""
                            }`
                          : undefined;
                        const editingActual = editing?.rowId === row.id && editing.field === "actualResult";
                        return (
                          <div className="flex flex-col items-start gap-0.5">
                            <SitV2Select
                              pill
                              disabled={!canEdit}
                              value={st}
                              aria-label="Status"
                              data-testid="sit-status-select"
                              listClassName="max-h-none overflow-visible"
                              buttonClassName={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold font-[inherit] disabled:opacity-80 ${
                                STATUS_STYLE[st] || STATUS_STYLE["Not run"]
                              }`}
                              options={
                                st === "Stale"
                                  ? [
                                      { value: "Stale", label: "Stale (system)", group: "System", disabled: true },
                                      ...STATUS_OPTIONS,
                                    ]
                                  : STATUS_OPTIONS
                              }
                              onChange={(v) => {
                                if (v === "Stale") return;
                                onPatch(row.id, { executionStatus: v });
                              }}
                            />
                            {st === "Draft" && row.cells.draftMissing ? (
                              <span
                                className="mt-0.5 block text-[12px] leading-snug text-[#3730a3]"
                                title={`Draft ,  unfinished. Missing: ${row.cells.draftMissing}`}
                              >
                                Draft ,  missing: {row.cells.draftMissing}
                              </span>
                            ) : null}
                            {editingActual && canEdit ? (
                              <textarea
                                className="mt-1 w-full min-h-[56px] rounded border border-[#8664F2] bg-white p-1 text-[12px] font-[inherit] outline-none"
                                defaultValue={actual}
                                autoFocus
                                data-testid="sit-cell-editor-actualResult"
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    clearCellSelection();
                                  } else if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    commitExecutionData(row.id, "actualResult", (e.target as HTMLTextAreaElement).value);
                                  }
                                }}
                                onBlur={(e) => commitExecutionData(row.id, "actualResult", e.target.value)}
                              />
                            ) : showActualArea ? (
                              <button
                                type="button"
                                className={`mt-0.5 w-full text-left text-[12px] leading-snug ${
                                  actual
                                    ? "text-[#374151]"
                                    : needsActualHint
                                      ? "text-[#92400e] underline decoration-dotted decoration-[#f59e0b]"
                                      : "text-[#9ca3af]"
                                }`}
                                title={actualTip}
                                data-testid="sit-actual-result"
                                onClick={() => canEdit && setEditing({ rowId: row.id, field: "actualResult" })}
                                onDoubleClick={() => canEdit && setEditing({ rowId: row.id, field: "actualResult" })}
                              >
                                {actual || "Add actual result"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="mt-0.5 hidden text-[12px] text-[#8664F2] group-hover:inline"
                                data-testid="sit-add-actual-result"
                                onClick={() => canEdit && setEditing({ rowId: row.id, field: "actualResult" })}
                              >
                                Add actual result
                              </button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-[#eef0f5] dark:border-[#1a1a1a]">
                      <td colSpan={colCount} className="p-0">
                        <SitV2ExpandPanel
                          row={row}
                          canEdit={canEdit}
                          onPatch={onPatch}
                          qualityHits={deadAudit?.flagsByRowId?.[row.id]}
                          acTexts={acTexts}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center text-[13px] text-[#5b647a]"
            data-testid="sit-grid-empty"
          >
            <p>No cases match the current filters.</p>
            {qualityFilterActive && onClearQualityFilter ? (
              <button
                type="button"
                className="rounded-[8px] border border-[#fcd34d] bg-[#fffbeb] px-3 py-1.5 text-[12.5px] font-medium text-[#92400e]"
                data-testid="sit-grid-empty-show-all"
                onClick={onClearQualityFilter}
              >
                Show all cases
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
