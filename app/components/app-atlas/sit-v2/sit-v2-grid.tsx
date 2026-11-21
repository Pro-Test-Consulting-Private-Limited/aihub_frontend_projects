"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
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
import { CopyField, OriginBadge, OriginGlyph, originRowTint, provenanceTooltip } from "./sit-v2-bits";
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
  "Not run": "bg-[#f3f4f6] text-[#9ca3af]",
  Passed: "bg-[#d1fae5] text-[#065f46]",
  Failed: "bg-[#fee2e2] text-[#991b1b]",
  Partial: "bg-[#ffedd5] text-[#9a3412]",
};

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

function RowMenu({
  canEdit,
  onDuplicate,
  onDelete,
  onOpenDrawer,
}: {
  canEdit: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onOpenDrawer: () => void;
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
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="rounded p-0.5 text-[#6b7280] hover:bg-[#f3f4f6]"
        aria-label="Row menu"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <TbDotsVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-[8px] border border-[#e2e6ef] bg-white py-1 text-[11px] shadow-lg dark:border-[#2a2a2a] dark:bg-[#151515]">
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-[#f3f0ff]"
            onClick={() => {
              setOpen(false);
              onOpenDrawer();
            }}
          >
            Open drawer
          </button>
          {canEdit && (
            <>
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
              <button
                type="button"
                className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-[#b91c1c] hover:bg-[#fef2f2]"
                onClick={() => {
                  setOpen(false);
                  if (window.confirm("Delete this test case?")) onDelete();
                }}
              >
                <TbTrash size={12} /> Delete
              </button>
            </>
          )}
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
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  onDelete: (rowId: string) => void;
  onAdd: () => void;
  onDuplicate: (rowId: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CellCoord | null>(null);
  const [editing, setEditing] = useState<CellCoord | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
            {["Not run", "Passed", "Failed", "Partial"].map((s) => (
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
        <table className="min-w-[1100px] w-full border-collapse font-sans text-[12px]">
          <thead className="sticky top-0 z-[2] bg-[#1F4E78] text-white">
            <tr>
              <th className="sticky left-0 z-[3] w-8 bg-[#1F4E78] px-2 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th className="sticky left-8 z-[3] min-w-[100px] bg-[#1F4E78] px-2 py-2 text-left text-[10px] font-semibold">
                ID
              </th>
              <th className="min-w-[72px] px-2 py-2 text-left text-[10px] font-semibold">Module</th>
              <th className="min-w-[72px] px-2 py-2 text-left text-[10px] font-semibold">Feature</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-[10px] font-semibold">Prio / Sev</th>
              <th className="min-w-[180px] px-2 py-2 text-left text-[10px] font-semibold">Scenario</th>
              <th className="min-w-[140px] px-2 py-2 text-left text-[10px] font-semibold">Preconditions</th>
              <th className="min-w-[280px] px-2 py-2 text-left text-[10px] font-semibold">Test Steps</th>
              <th className="min-w-[160px] px-2 py-2 text-left text-[10px] font-semibold">Expected Result</th>
              <th className="min-w-[110px] px-2 py-2 text-left text-[10px] font-semibold">Status</th>
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
              const edited = row.cells.edited === "1";
              const mf = displayModuleFeature(row.cells, epics);
              const isSel = (f: string) => selected?.rowId === row.id && selected.field === f;
              const isEdit = (f: string) => editing?.rowId === row.id && editing.field === f;
              const tint = originRowTint(row.cells.origin, edited);
              const tip = provenanceTooltip(row.cells);
              return (
                <tr
                  key={row.id}
                  className={`group border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:border-[#1a1a1a] dark:hover:bg-[#141414] ${tint}`}
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
                    className="sticky left-8 z-[1] bg-white px-2 py-2 align-top font-mono text-[11px] font-semibold dark:bg-[#101010]"
                    title={tip}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-left"
                      onClick={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}
                    >
                      {open ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                      <OriginGlyph origin={row.cells.origin} edited={edited} title={tip} />
                      <span>{row.cells.caseId || row.cells.tcId}</span>
                    </button>
                  </td>
                  <td className="px-2 py-2 align-top" title="Derived from Jira epic (not editable)">
                    {mf.module}
                  </td>
                  <td className="px-2 py-2 align-top" title="Derived from ticket summary (not editable)">
                    {mf.feature}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {(["priority", "severity"] as const).map((field) => {
                        const val = row.cells[field] || "Medium";
                        const style =
                          val === "High"
                            ? "bg-[#fee2e2] text-[#991b1b]"
                            : val === "Low"
                              ? "bg-[#e0e7ff] text-[#3730a3]"
                              : "bg-[#fef3c7] text-[#92400e]";
                        return (
                          <SitV2Select
                            key={field}
                            pill
                            disabled={!canEdit}
                            value={val}
                            aria-label={field}
                            data-testid={`sit-${field}-select`}
                            buttonClassName={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold font-[inherit] ${style}`}
                            options={["High", "Medium", "Low"].map((v) => ({ value: v, label: v }))}
                            onChange={(v) => onPatch(row.id, { [field]: v })}
                          />
                        );
                      })}
                    </div>
                  </td>
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
                        <span className="line-clamp-2" title={row.cells.scenario}>
                          {row.cells.scenario}
                        </span>
                      </div>
                    }
                  />
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
                        <span className="line-clamp-2 whitespace-pre-wrap text-[#5b647a]" title={row.cells.preconditions}>
                          {row.cells.preconditions}
                        </span>
                      </span>
                    }
                  />
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
                        <div className={open ? "" : "max-h-[7.5rem] overflow-hidden"}>
                          <StepsWithChips steps={row.cells.steps || ""} />
                        </div>
                        {!open && (row.cells.steps || "").split("\n").length > 4 && (
                          <button
                            type="button"
                            className="mt-1 text-[10px] font-medium text-[#8664F2]"
                            onClick={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                          >
                            Expand
                          </button>
                        )}
                        {open && <TestDataBlock row={row} />}
                      </div>
                    }
                  />
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
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-1">
                      <SitV2Select
                        pill
                        disabled={!canEdit}
                        value={row.cells.executionStatus || "Not run"}
                        aria-label="Status"
                        data-testid="sit-status-select"
                        buttonClassName={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold font-[inherit] disabled:opacity-80 ${
                          STATUS_STYLE[row.cells.executionStatus || "Not run"] || STATUS_STYLE["Not run"]
                        }`}
                        options={["Not run", "Passed", "Failed", "Partial"].map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        onChange={(v) => onPatch(row.id, { executionStatus: v })}
                      />
                      <RowMenu
                        canEdit={canEdit}
                        onDuplicate={() => onDuplicate(row.id)}
                        onDelete={() => onDelete(row.id)}
                        onOpenDrawer={() => setDrawer(row.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            data-testid="sit-add-test-case"
            className="m-3 inline-flex items-center gap-1 rounded-[8px] border border-dashed border-[#c4b5fd] px-3 py-2 text-[12px] text-[#5b21b6] hover:bg-[#f5f3ff]"
          >
            <TbPlus size={14} /> Add test case
          </button>
        )}
      </div>

      {drawerRow && (
        <aside className="w-[320px] shrink-0 overflow-y-auto border-l border-[#eef0f5] bg-[#fafafa] p-3 dark:border-[#1a1a1a] dark:bg-[#0c0c0c]">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-[#1F1F1F] dark:text-[#ededed]">{drawerRow.cells.caseId}</div>
            <button type="button" className="text-[12px] text-[#6b7280]" onClick={() => setDrawer(null)}>
              Close
            </button>
          </div>
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
          <p className="mt-1 text-[11px] text-[#6b7280]">
            Ticket {drawerRow.cells.requirementId}
            {drawerRow.cells.acIds || drawerRow.cells.ac
              ? ` · AC: ${drawerRow.cells.acIds || drawerRow.cells.ac}`
              : ""}
          </p>
          {drawerRow.cells.openQuestions ? (
            <p className="mt-1 text-[11px] text-[#92400e]">
              OPEN: <span className="font-mono">{drawerRow.cells.openQuestions}</span>
            </p>
          ) : null}
          {drawerRow.cells.dataIntent ? (
            <p className="mt-1 font-mono text-[10.5px] text-[#5b647a]">intent: {drawerRow.cells.dataIntent}</p>
          ) : null}
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
                  if (window.confirm("Revert this case to the original AI version?")) {
                    onPatch(drawerRow.id, { revertAi: true });
                  }
                }}
              >
                Revert to AI version
              </button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
