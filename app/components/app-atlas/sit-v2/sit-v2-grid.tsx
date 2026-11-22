"use client";

import { useMemo, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  TbChevronDown,
  TbChevronRight,
  TbDotsVertical,
  TbPlus,
  TbCopy,
  TbTrash,
} from "react-icons/tb";
import type { SitEpic, SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import { displayModuleFeature } from "@/app/lib/sit-module-feature";
import { CopyField, OriginBadge, OriginGlyph, provenanceTooltip } from "./sit-v2-bits";
import { SitV2EditableCell, type CellCoord } from "./sit-v2-editable-cell";
import { SitV2ListEditor } from "./sit-v2-list-editor";
import { SitV2Select } from "./sit-v2-select";

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
  const parts = (steps || "").split(/(\{\{\s*[a-zA-Z0-9_]+\s*\}\})/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => {
        const m = p.match(/^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/);
        if (m) {
          return (
            <span
              key={i}
              className="mx-0.5 inline-flex rounded bg-[#ede9fe] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[#5b21b6]"
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

function TestDataBlock({ row }: { row: SitSheetRow }) {
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
    <div className="mt-2 rounded-[6px] border border-dashed border-[#c4b5fd]/60 bg-[#faf5ff]/50 p-2 dark:bg-[#1c1530]/40">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#7c3aed]">Test data</span>
        <button
          type="button"
          className="text-[10px] font-medium text-[#8664F2]"
          onClick={async () => {
            const text = entries.map(([k, v]) => `${k}=${v}`).join("\n");
            try {
              await navigator.clipboard.writeText(text);
            } catch {
              /* ignore */
            }
          }}
        >
          Copy all
        </button>
      </div>
      <div className="space-y-1">
        {entries.map(([k, v]) => (
          <CopyField key={k} label={k} value={v} />
        ))}
      </div>
    </div>
  );
}

/** Clamp long cell text at a line boundary (~12 lines) with explicit Show more — never mid-line CSS cut. */
function StepsClamp({
  open,
  onShowMore,
  children,
  lines = 12,
}: {
  open: boolean;
  onShowMore: () => void;
  children: ReactNode;
  lines?: number;
}) {
  if (open) return <>{children}</>;
  return (
    <div className="relative">
      <div
        className="overflow-hidden"
        style={{ maxHeight: `${lines * 1.35}em`, WebkitMaskImage: "linear-gradient(180deg,#000 85%,transparent)" }}
      >
        {children}
      </div>
      <button
        type="button"
        className="mt-1 text-[10px] font-medium text-[#8664F2]"
        onClick={onShowMore}
        data-testid="sit-show-more"
      >
        Show more
      </button>
    </div>
  );
}

function RowMenu({
  canEdit,
  onDuplicate,
  onDelete,
  onInsertBelow,
}: {
  canEdit: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertBelow?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  if (!canEdit) return null;
  return (
    <div className="relative opacity-0 group-hover:opacity-100 focus-within:opacity-100" ref={ref}>
      <button
        type="button"
        className="rounded p-0.5 text-[#6b7280] hover:bg-[#f3f4f6]"
        aria-label="Row menu"
        data-testid="sit-row-menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <TbDotsVertical size={14} />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-36 rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[11px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
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

export function SitV2Grid({
  workbook,
  epics,
  canEdit,
  ticketFilter,
  typeFilter,
  statusFilter,
  originFilter,
  search,
  generating,
  density = "comfortable",
  hiddenColumns = [],
  onPatch,
  onDelete,
  onAdd,
  onDuplicate,
}: {
  workbook: SitWorkbook;
  epics: SitEpic[];
  canEdit: boolean;
  ticketFilter: string | "all";
  typeFilter: string | null;
  statusFilter: string | null;
  originFilter: string | null;
  search: string;
  generating?: boolean;
  density?: "comfortable" | "compact";
  hiddenColumns?: string[];
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  onDelete: (rowId: string) => void;
  onAdd: () => void;
  onDuplicate: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"details" | "testdata" | "coverage" | "history">("details");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [editing, setEditing] = useState<CellCoord | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hide = (id: string) => hiddenColumns.includes(id);
  const cellPad = density === "compact" ? "px-1.5 py-1" : "px-2 py-2";
  const tableText = density === "compact" ? "text-[11px]" : "text-[12px]";

  const rows = useMemo(() => {
    const tc = workbook.sheets.find((s) => s.kind === "test-cases");
    let list = (tc?.rows || []).filter((r) => r.cells.deleted !== "1");
    if (ticketFilter !== "all") {
      list = list.filter((r) => r.cells.requirementId === ticketFilter || r.cells.issueKey === ticketFilter);
    }
    if (typeFilter) list = list.filter((r) => (r.cells.testType || "") === typeFilter);
    if (statusFilter) list = list.filter((r) => (r.cells.executionStatus || "Not run") === statusFilter);
    if (originFilter === "edited") list = list.filter((r) => r.cells.edited === "1");
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
    return list;
  }, [workbook, ticketFilter, typeFilter, statusFilter, originFilter, search]);

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

  const drawerRow = rows.find((r) => r.id === drawer);

  const bulkSetStatus = (status: string) => {
    if (!canEdit) return;
    for (const id of selectedRows) {
      onPatch(id, { executionStatus: status });
    }
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
      const next = { rowId: rows[nri]!.id, field: EDITABLE_FIELDS[nfi]! };
      setSelected(next);
      setEditing(null);
    },
    [rows, selected],
  );

  const commitCell = (rowId: string, field: string, value: string) => {
    schedulePatch(rowId, { [field]: value });
    setEditing(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
      <div className="min-w-0 flex-1 overflow-auto">
        {!canEdit && (
          <div className="sticky top-0 z-[5] flex items-center gap-2 border-b border-[#e2e6ef] bg-[#f8fafc] px-3 py-1.5 dark:border-[#1a1a1a] dark:bg-[#141414]">
            <span
              className="inline-flex items-center rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6b7280] dark:border-[#2a2a2a] dark:bg-[#101010]"
              title="You can view this canvas but only the owner can edit test cases."
              data-testid="sit-view-only-chip"
            >
              View only
            </span>
          </div>
        )}
        {selectedRows.size > 0 && canEdit && (
          <div className="sticky top-0 z-[4] flex flex-wrap items-center gap-2 border-b border-[#e2e6ef] bg-[#f8fafc] px-3 py-1.5 text-[11px] dark:border-[#1a1a1a] dark:bg-[#141414]">
            <span className="font-medium text-[#5b647a]">{selectedRows.size} selected</span>
            <span className="text-[#9ca3af]">Set status:</span>
            {BULK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 font-medium hover:border-[#8664F2] dark:border-[#2a2a2a] dark:bg-[#101010]"
                onClick={() => bulkSetStatus(s)}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto text-[#8664F2]"
              onClick={() => setSelectedRows(new Set())}
            >
              Clear selection
            </button>
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
                className={`sticky left-8 z-[3] w-[7.5rem] bg-[#1F4E78] ${cellPad} pl-2 text-left text-[10px] font-semibold`}
              >
                ID
              </th>
              {!hide("module") && (
                <th className={`min-w-[72px] ${cellPad} text-left text-[10px] font-semibold`}>Module</th>
              )}
              {!hide("feature") && (
                <th className={`min-w-[72px] ${cellPad} text-left text-[10px] font-semibold`}>Feature</th>
              )}
              {!hide("prioSev") && (
                <th
                  className={`min-w-[120px] ${cellPad} text-left text-[10px] font-semibold`}
                  title="Priority = how soon to test this. Severity = how bad it is if it fails."
                >
                  Priority / Severity
                </th>
              )}
              <th className={`min-w-[180px] ${cellPad} text-left text-[10px] font-semibold`}>Scenario</th>
              {!hide("preconditions") && (
                <th className={`min-w-[140px] ${cellPad} text-left text-[10px] font-semibold`}>Preconditions</th>
              )}
              {!hide("steps") && (
                <th className={`min-w-[280px] ${cellPad} text-left text-[10px] font-semibold`}>Test Steps</th>
              )}
              {!hide("expected") && (
                <th className={`min-w-[160px] ${cellPad} text-left text-[10px] font-semibold`}>Expected Result</th>
              )}
              <th className={`min-w-[120px] ${cellPad} text-left text-[10px] font-semibold`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {generating && rows.length === 0 &&
              [0, 1, 2].map((i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td colSpan={10} className="border-b border-[#f3f4f6] px-3 py-4">
                    <div className="h-4 w-3/4 rounded bg-[#e5e7eb]" />
                  </td>
                </tr>
              ))}
            {rows.map((row) => {
              const open = !!expanded[row.id];
              const edited = row.cells.edited === "1" && row.cells.origin !== "human";
              const mf = displayModuleFeature(row.cells, epics);
              const isSel = (f: string) => selected?.rowId === row.id && selected.field === f;
              const isEdit = (f: string) => editing?.rowId === row.id && editing.field === f;
              const tip = provenanceTooltip(row.cells);
              return (
                <tr
                  key={row.id}
                  className="group border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:border-[#1a1a1a] dark:hover:bg-[#141414]"
                  data-origin={row.cells.origin || "ai"}
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
                  >
                    <div className="inline-flex max-w-full items-center gap-0.5">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-left"
                        aria-expanded={open}
                        aria-label={open ? "Collapse row detail" : "Expand row detail"}
                        onClick={() => {
                          setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }));
                          setDrawer((d) => (d === row.id ? null : row.id));
                        }}
                        onDoubleClick={() => {
                          setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }));
                          setDrawer((d) => (d === row.id ? null : row.id));
                        }}
                      >
                        {open ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                        <OriginGlyph origin={row.cells.origin} edited={edited} title={tip} />
                        <span className="whitespace-nowrap">{row.cells.caseId || row.cells.tcId}</span>
                      </button>
                      <RowMenu
                        canEdit={canEdit}
                        onDuplicate={() => onDuplicate(row.id)}
                        onDelete={() => onDelete(row.id)}
                        onInsertBelow={onAdd}
                      />
                    </div>
                  </td>
                  {!hide("module") && (
                    <td className={`${cellPad} align-top`} title="Derived from Jira epic (not editable)">
                      {mf.module}
                    </td>
                  )}
                  {!hide("feature") && (
                    <td className={`${cellPad} align-top`} title="Derived from ticket summary (not editable)">
                      {mf.feature}
                    </td>
                  )}
                  {!hide("prioSev") && (
                    <td className={`${cellPad} align-top`}>
                      <div className="flex flex-col gap-1">
                        {(["priority", "severity"] as const).map((field) => {
                          const val = row.cells[field] || "Medium";
                          const style =
                            val === "High"
                              ? "bg-[#fee2e2] text-[#991b1b]"
                              : val === "Low"
                                ? "bg-[#dcfce7] text-[#166534]"
                                : "bg-[#fef3c7] text-[#92400e]";
                          const short =
                            field === "priority"
                              ? `P ${val === "Medium" ? "Med" : val}`
                              : `S ${val === "Medium" ? "Med" : val}`;
                          const full = field === "priority" ? `Priority ${val}` : `Severity ${val}`;
                          return (
                            <SitV2Select
                              key={field}
                              pill
                              disabled={!canEdit}
                              value={val}
                              aria-label={field === "priority" ? "Priority" : "Severity"}
                              data-testid={`sit-${field}-select`}
                              buttonClassName={`inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold font-[inherit] ${style}`}
                              options={["High", "Medium", "Low"].map((v) => ({
                                value: v,
                                label: field === "priority" ? `Priority ${v}` : `Severity ${v}`,
                              }))}
                              triggerLabel={
                                <span className="inline-flex items-center gap-1">
                                  <span className="hidden min-[1440px]:inline">{full}</span>
                                  <span className="min-[1440px]:hidden">{short}</span>
                                </span>
                              }
                              onChange={(v) => onPatch(row.id, { [field]: v })}
                            />
                          );
                        })}
                      </div>
                    </td>
                  )}
                  <SitV2EditableCell
                    rowId={row.id}
                    field="scenario"
                    value={row.cells.scenario || ""}
                    canEdit={canEdit}
                    selected={isSel("scenario")}
                    editing={isEdit("scenario")}
                    onSelect={setSelected}
                    onStartEdit={setEditing}
                    onCancelEdit={() => setEditing(null)}
                    onCommit={commitCell}
                    onMove={moveCell}
                    display={
                      <div className="flex items-start gap-1.5">
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            TYPE_STYLE[row.cells.testType || ""] || "bg-[#eee] text-[#444]"
                          }`}
                        >
                          {row.cells.testType || "—"}
                        </span>
                        <span className="whitespace-pre-wrap" title={row.cells.scenario}>
                          {row.cells.scenario}
                        </span>
                      </div>
                    }
                  />
                  {!hide("preconditions") && (
                    <SitV2EditableCell
                      rowId={row.id}
                      field="preconditions"
                      value={row.cells.preconditions || ""}
                      canEdit={canEdit}
                      selected={isSel("preconditions")}
                      editing={isEdit("preconditions")}
                      onSelect={setSelected}
                      onStartEdit={setEditing}
                      onCancelEdit={() => setEditing(null)}
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
                          <span className="mr-1 rounded bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-semibold text-[#5b21b6]">
                            {row.cells.requirementId || "—"}
                          </span>
                          <span className="whitespace-pre-wrap text-[#5b647a]" title={row.cells.preconditions}>
                            {row.cells.preconditions}
                          </span>
                        </span>
                      }
                    />
                  )}
                  {!hide("steps") && (
                    <SitV2EditableCell
                      rowId={row.id}
                      field="steps"
                      value={row.cells.steps || ""}
                      canEdit={canEdit}
                      selected={isSel("steps")}
                      editing={isEdit("steps")}
                      onSelect={setSelected}
                      onStartEdit={setEditing}
                      onCancelEdit={() => setEditing(null)}
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
                          <StepsClamp
                            open={open}
                            onShowMore={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                          >
                            <StepsWithChips steps={row.cells.steps || ""} />
                          </StepsClamp>
                          {open && <TestDataBlock row={row} />}
                        </div>
                      }
                    />
                  )}
                  {!hide("expected") && (
                    <SitV2EditableCell
                      rowId={row.id}
                      field="expected"
                      value={row.cells.expected || ""}
                      canEdit={canEdit}
                      selected={isSel("expected")}
                      editing={isEdit("expected")}
                      onSelect={setSelected}
                      onStartEdit={setEditing}
                      onCancelEdit={() => setEditing(null)}
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
                    />
                  )}
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-col items-start gap-0.5">
                      <SitV2Select
                        pill
                        disabled={!canEdit}
                        value={row.cells.executionStatus || "Not run"}
                        aria-label="Status"
                        data-testid="sit-status-select"
                        listClassName="max-h-none overflow-visible"
                        buttonClassName={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold font-[inherit] disabled:opacity-80 ${
                          STATUS_STYLE[row.cells.executionStatus || "Not run"] || STATUS_STYLE["Not run"]
                        }`}
                        options={
                          row.cells.executionStatus === "Stale"
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
                      {row.cells.executionStatus === "Draft" && row.cells.draftMissing ? (
                        <span
                          className="mt-0.5 block text-[9px] text-[#3730a3]"
                          title={`Draft — unfinished row. Missing: ${row.cells.draftMissing}`}
                        >
                          Draft — missing: {row.cells.draftMissing}
                        </span>
                      ) : null}
                      {row.cells.executionStatus === "Stale" ? (
                        <span
                          className="mt-0.5 block text-[9px] text-[#92400e]"
                          title={row.cells.statusReason || "Case content or ticket changed after a result"}
                        >
                          Stale
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {drawerRow && (
        <aside
          className="w-[340px] shrink-0 overflow-y-auto border-l border-[#eef0f5] bg-[#fafafa] p-3 dark:border-[#1a1a1a] dark:bg-[#0c0c0c]"
          data-testid="sit-row-drawer"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">{drawerRow.cells.caseId}</div>
            <button type="button" className="text-[12px] text-[#6b7280]" onClick={() => setDrawer(null)}>
              Close
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Drawer tabs">
            {(
              [
                ["details", "Details"],
                ["testdata", "Test data"],
                ["coverage", "Coverage"],
                ["history", "History"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={drawerTab === id}
                className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${
                  drawerTab === id ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
                }`}
                onClick={() => setDrawerTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {drawerTab === "details" && (
            <div>
              <OriginBadge origin={drawerRow.cells.origin} edited={drawerRow.cells.edited === "1"} />
              <p className="mt-2 text-[12px] text-[#6b7280]">
                Status: <strong>{drawerRow.cells.executionStatus || "Not run"}</strong>
                {drawerRow.cells.statusBy
                  ? ` · set by ${drawerRow.cells.statusBy}${
                      drawerRow.cells.statusAt
                        ? ` at ${new Date(Number(drawerRow.cells.statusAt)).toLocaleString()}`
                        : ""
                    }`
                  : " · not set by a human yet"}
              </p>
              <p className="mt-2 text-[13px] font-medium">{drawerRow.cells.scenario}</p>
              <p className="mt-1 text-[11px] text-[#6b7280]">Ticket {drawerRow.cells.requirementId}</p>
              <div className="mt-3 whitespace-pre-wrap text-[12px]">
                <StepsWithChips steps={drawerRow.cells.steps || ""} />
              </div>
              <div className="mt-2 whitespace-pre-wrap text-[12px] text-[#374151]">{drawerRow.cells.expected}</div>
              {canEdit && drawerRow.cells.origin === "ai" && drawerRow.cells.edited === "1" && (
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#e2e6ef] px-2 py-1 text-[11px] dark:border-[#2a2a2a]"
                    onClick={() => onPatch(drawerRow.id, { showOriginal: true })}
                  >
                    Show original AI version
                  </button>
                  <button
                    type="button"
                    className="rounded-[8px] border border-[#fecaca] px-2 py-1 text-[11px] text-[#991b1b]"
                    onClick={() => {
                      if (true) { // soft revert — no native confirm (U12)
                        onPatch(drawerRow.id, { revertAi: true });
                      }
                    }}
                  >
                    Revert to AI version
                  </button>
                </div>
              )}
            </div>
          )}
          {drawerTab === "testdata" && (
            <div>
              <TestDataBlock row={drawerRow} />
              {!drawerRow.cells.steps?.includes("{{") && (
                <p className="text-[11px] text-[#9ca3af]">No placeholders in steps for this case.</p>
              )}
              {drawerRow.cells.dataIntent ? (
                <p className="mt-2 font-mono text-[10.5px] text-[#5b647a]">intent: {drawerRow.cells.dataIntent}</p>
              ) : null}
            </div>
          )}
          {drawerTab === "coverage" && (
            <div className="space-y-2 text-[12px]">
              <p>
                ACs:{" "}
                <span className="font-mono">{drawerRow.cells.acIds || drawerRow.cells.ac || "—"}</span>
              </p>
              {drawerRow.cells.openQuestions ? (
                <p className="text-[#92400e]">
                  OPEN: <span className="font-mono">{drawerRow.cells.openQuestions}</span>
                </p>
              ) : (
                <p className="text-[#9ca3af]">No open questions.</p>
              )}
            </div>
          )}
          {drawerTab === "history" && (
            <div className="space-y-2 text-[11.5px] text-[#374151]">
              <p>
                Origin: <strong>{drawerRow.cells.origin || "ai"}</strong>
                {drawerRow.cells.edited === "1" ? " · Edited" : ""}
              </p>
              {drawerRow.cells.editedBy ? (
                <p>
                  Last edit: {drawerRow.cells.editedBy}
                  {drawerRow.cells.editedAt
                    ? ` · ${new Date(Number(drawerRow.cells.editedAt)).toLocaleString()}`
                    : ""}
                </p>
              ) : (
                <p className="text-[#9ca3af]">No human edits recorded.</p>
              )}
              <p>
                Status: {drawerRow.cells.executionStatus || "Not run"}
                {drawerRow.cells.statusBy
                  ? ` · ${drawerRow.cells.statusBy}${
                      drawerRow.cells.statusAt
                        ? ` · ${new Date(Number(drawerRow.cells.statusAt)).toLocaleString()}`
                        : ""
                    }`
                  : ""}
                {drawerRow.cells.statusSource ? ` · source ${drawerRow.cells.statusSource}` : ""}
              </p>
              {drawerRow.cells.generationVersion || drawerRow.cells.version ? (
                <p>Generation version: {drawerRow.cells.generationVersion || drawerRow.cells.version}</p>
              ) : null}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
