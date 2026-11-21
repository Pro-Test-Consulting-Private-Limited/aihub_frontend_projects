"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { TbChevronDown, TbChevronRight, TbPlus } from "react-icons/tb";
import type { SitEpic, SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import { displayModuleFeature } from "@/app/lib/sit-module-feature";
import { CopyField, OriginBadge } from "./sit-v2-bits";

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

export function SitV2Grid({
  workbook,
  epics,
  editMode,
  ticketFilter,
  typeFilter,
  statusFilter,
  originFilter,
  search,
  generating,
  onPatch,
  onDelete,
  onAdd,
}: {
  workbook: SitWorkbook;
  epics: SitEpic[];
  editMode: boolean;
  ticketFilter: string | "all";
  typeFilter: string | null;
  statusFilter: string | null;
  originFilter: string | null;
  search: string;
  generating?: boolean;
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  onDelete: (rowId: string) => void;
  onAdd: () => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
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
    }, 800);
  };

  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach(clearTimeout);
  }, []);

  const drawerRow = rows.find((r) => r.id === drawer);

  const bulkSetStatus = (status: string) => {
    for (const id of selectedRows) {
      onPatch(id, { executionStatus: status });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white dark:border-[#1a1a1a] dark:bg-[#101010]">
      <div className="min-w-0 flex-1 overflow-auto">
        {selectedRows.size > 0 && (
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
              <th className="w-16 bg-[#1F4E78] px-2 py-2 text-left text-[10px] font-semibold">Origin</th>
              <th className="sticky left-8 z-[3] min-w-[88px] bg-[#1F4E78] px-2 py-2 text-left text-[10px] font-semibold">
                ID
              </th>
              <th className="min-w-[72px] px-2 py-2 text-left text-[10px] font-semibold">Module</th>
              <th className="min-w-[72px] px-2 py-2 text-left text-[10px] font-semibold">Feature</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-[10px] font-semibold">Prio / Sev</th>
              <th className="min-w-[180px] px-2 py-2 text-left text-[10px] font-semibold">Scenario</th>
              <th className="min-w-[140px] px-2 py-2 text-left text-[10px] font-semibold">Preconditions</th>
              <th className="min-w-[280px] px-2 py-2 text-left text-[10px] font-semibold">Test Steps</th>
              <th className="min-w-[160px] px-2 py-2 text-left text-[10px] font-semibold">Expected Result</th>
              <th className="min-w-[100px] px-2 py-2 text-left text-[10px] font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {generating && rows.length === 0 &&
              [0, 1, 2].map((i) => (
                <tr key={`sk-${i}`} className="animate-pulse">
                  <td colSpan={11} className="border-b border-[#f3f4f6] px-3 py-4">
                    <div className="h-4 w-3/4 rounded bg-[#e5e7eb]" />
                  </td>
                </tr>
              ))}
            {rows.map((row) => {
              const open = !!expanded[row.id];
              const edited = row.cells.edited === "1";
              const mf = displayModuleFeature(row.cells, epics);
              return (
                <tr
                  key={row.id}
                  className="group border-b border-[#f3f4f6] hover:bg-[#fafafa] dark:border-[#1a1a1a] dark:hover:bg-[#141414]"
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
                  <td className="px-2 py-2 align-top">
                    <OriginBadge origin={row.cells.origin} edited={edited} />
                  </td>
                  <td className="sticky left-8 z-[1] bg-white px-2 py-2 align-top font-mono text-[11px] font-semibold dark:bg-[#101010]">
                    <button type="button" className="inline-flex items-center gap-0.5 text-left" onClick={() => setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))}>
                      {open ? <TbChevronDown size={12} /> : <TbChevronRight size={12} />}
                      {row.cells.caseId || row.cells.tcId}
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
                      {(["priority", "severity"] as const).map((field) => (
                        <select
                          key={field}
                          disabled={!editMode}
                          className="rounded-full border border-[#e2e6ef] bg-white px-1.5 py-0.5 text-[10px] font-semibold disabled:border-0 dark:border-[#2a2a2a] dark:bg-[#141414]"
                          value={row.cells[field] || "Medium"}
                          onChange={(e) => onPatch(row.id, { [field]: e.target.value })}
                        >
                          {["High", "Medium", "Low"].map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex items-start gap-1.5">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          TYPE_STYLE[row.cells.testType || ""] || "bg-[#eee] text-[#444]"
                        }`}
                      >
                        {row.cells.testType || "—"}
                      </span>
                      <span className="line-clamp-1" title={row.cells.scenario}>
                        {editMode ? (
                          <input
                            className="w-full rounded border border-transparent px-1 hover:border-[#e2e6ef] focus:border-[#8664F2]"
                            defaultValue={row.cells.scenario}
                            onBlur={(e) => schedulePatch(row.id, { scenario: e.target.value })}
                          />
                        ) : (
                          row.cells.scenario
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <span className="mr-1 rounded bg-[#ede9fe] px-1.5 py-0.5 text-[10px] font-semibold text-[#5b21b6]">
                      {row.cells.requirementId || "—"}
                    </span>
                    <span className="line-clamp-1 text-[#5b647a]" title={row.cells.preconditions}>
                      {row.cells.preconditions}
                    </span>
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className={open ? "" : "max-h-[7.5rem] overflow-hidden"}>
                      {editMode ? (
                        <textarea
                          className="min-h-[72px] w-full rounded border border-[#e2e6ef] bg-white p-1 text-[11.5px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                          defaultValue={row.cells.steps}
                          onBlur={(e) => schedulePatch(row.id, { steps: e.target.value })}
                        />
                      ) : (
                        <StepsWithChips steps={row.cells.steps || ""} />
                      )}
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
                  </td>
                  <td className="px-2 py-2 align-top whitespace-pre-wrap">
                    {editMode ? (
                      <textarea
                        className="min-h-[56px] w-full rounded border border-[#e2e6ef] p-1 text-[11.5px] dark:border-[#2a2a2a] dark:bg-[#141414]"
                        defaultValue={row.cells.expected}
                        onBlur={(e) => schedulePatch(row.id, { expected: e.target.value })}
                      />
                    ) : (
                      row.cells.expected
                    )}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <select
                      className={`rounded-full border-0 px-2 py-0.5 text-[10.5px] font-semibold ${
                        STATUS_STYLE[row.cells.executionStatus || "Not run"] || STATUS_STYLE["Not run"]
                      }`}
                      value={row.cells.executionStatus || "Not run"}
                      title={
                        row.cells.statusBy
                          ? `Set by ${row.cells.statusBy}${
                              row.cells.statusAt
                                ? ` · ${new Date(Number(row.cells.statusAt)).toLocaleString()}`
                                : ""
                            }`
                          : "Status is set by a human (does not mark the row Edited)"
                      }
                      onChange={(e) => onPatch(row.id, { executionStatus: e.target.value })}
                    >
                      {["Not run", "Passed", "Failed", "Partial"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button type="button" className="text-[10px] text-[#8664F2]" onClick={() => setDrawer(row.id)}>
                        Drawer
                      </button>
                      {editMode && (
                        <button
                          type="button"
                          className="text-[10px] text-[#b91c1c]"
                          onClick={() => {
                            if (window.confirm("Delete this test case?")) onDelete(row.id);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {editMode && (
          <button
            type="button"
            onClick={onAdd}
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
            {drawerRow.cells.ac ? ` · AC: ${drawerRow.cells.ac}` : ""}
          </p>
          <div className="mt-3 whitespace-pre-wrap text-[12px]">
            <StepsWithChips steps={drawerRow.cells.steps || ""} />
          </div>
          <TestDataBlock row={drawerRow} />
          <div className="mt-3 text-[12px]">
            <div className="text-[10px] font-semibold uppercase text-[#8a93a8]">Expected</div>
            <p className="whitespace-pre-wrap">{drawerRow.cells.expected}</p>
          </div>
          {drawerRow.cells.aiOriginal && drawerRow.cells.edited === "1" && (
            <div className="mt-4 rounded-[8px] border border-[#fde68a] bg-[#fffbeb] p-2 text-[11px]">
              <div className="mb-1 font-semibold text-[#92400e]">Original AI version</div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-[#78350f]">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(drawerRow.cells.aiOriginal), null, 2);
                  } catch {
                    return drawerRow.cells.aiOriginal;
                  }
                })()}
              </pre>
              {editMode && (
                <button
                  type="button"
                  className="mt-2 rounded bg-[#92400e] px-2 py-1 text-[11px] text-white"
                  onClick={() => onPatch(drawerRow.id, { revertAi: true })}
                >
                  Revert to AI version
                </button>
              )}
            </div>
          )}
          {drawerRow.cells.editedBy && (
            <p className="mt-2 text-[10px] text-[#8a93a8]">
              Edited by {drawerRow.cells.editedBy}
              {drawerRow.cells.editedAt
                ? ` · ${new Date(Number(drawerRow.cells.editedAt)).toLocaleString()}`
                : ""}
            </p>
          )}
        </aside>
      )}
    </div>
  );
}
