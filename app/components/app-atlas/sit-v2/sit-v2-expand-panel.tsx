"use client";

import { useState } from "react";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import { CopyField, OriginBadge } from "./sit-v2-bits";

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
    <div className="rounded-[6px] border border-dashed border-[#c4b5fd]/60 bg-[#faf5ff]/50 p-2 dark:bg-[#1c1530]/40">
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

export type ExpandTab = "details" | "testdata" | "coverage" | "history";

/** Inline under-row detail panel (U3) — Details | Test data | Coverage | History. */
export function SitV2ExpandPanel({
  row,
  canEdit,
  onPatch,
  initialTab = "details",
}: {
  row: SitSheetRow;
  canEdit: boolean;
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  initialTab?: ExpandTab;
}) {
  const [tab, setTab] = useState<ExpandTab>(initialTab);
  return (
    <div className="border-t border-[#eef0f5] bg-[#fafafa] px-3 py-2 dark:border-[#1a1a1a] dark:bg-[#0c0c0c]" data-testid="sit-row-expand-panel">
      <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Row detail tabs">
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
            aria-selected={tab === id}
            className={`rounded-[6px] px-2 py-0.5 text-[11px] font-medium ${
              tab === id ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "details" && (
        <div>
          <OriginBadge origin={row.cells.origin} edited={row.cells.edited === "1"} />
          {row.cells.thin === "1" || row.cells.thin === "true" ? (
            <span
              className="ml-2 inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[10px] font-semibold text-[#92400e]"
              title="Below detail thresholds after expand pass"
              data-testid="sit-thin-chip"
            >
              Thin
            </span>
          ) : null}
          <p className="mt-2 text-[12px] text-[#6b7280]">
            Status: <strong>{row.cells.executionStatus || "Not run"}</strong>
            {row.cells.statusBy
              ? ` · set by ${row.cells.statusBy}${
                  row.cells.statusAt ? ` at ${new Date(Number(row.cells.statusAt)).toLocaleString()}` : ""
                }`
              : " · not set by a human yet"}
          </p>
          <p className="mt-2 text-[13px] font-medium">{row.cells.scenario}</p>
          <p className="mt-1 text-[11px] text-[#6b7280]">Ticket {row.cells.requirementId}</p>
          <div className="mt-3 whitespace-pre-wrap text-[12px]">
            <StepsWithChips steps={row.cells.steps || ""} />
          </div>
          <div className="mt-2 whitespace-pre-wrap text-[12px] text-[#374151]">{row.cells.expected}</div>
          {canEdit && row.cells.origin === "ai" && row.cells.edited === "1" && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className="rounded-[8px] border border-[#e2e6ef] px-2 py-1 text-[11px] dark:border-[#2a2a2a]"
                onClick={() => onPatch(row.id, { showOriginal: true })}
              >
                Show original AI version
              </button>
              <button
                type="button"
                className="rounded-[8px] border border-[#fecaca] px-2 py-1 text-[11px] text-[#991b1b]"
                onClick={() => onPatch(row.id, { revertAi: true })}
              >
                Revert to AI version
              </button>
            </div>
          )}
        </div>
      )}
      {tab === "testdata" && (
        <div>
          <TestDataBlock row={row} />
          {!row.cells.steps?.includes("{{") && (
            <p className="text-[11px] text-[#9ca3af]">No placeholders in steps for this case.</p>
          )}
          {row.cells.dataIntent ? (
            <p className="mt-2 font-mono text-[10.5px] text-[#5b647a]">intent: {row.cells.dataIntent}</p>
          ) : null}
        </div>
      )}
      {tab === "coverage" && (
        <div className="space-y-2 text-[12px]">
          <p>
            ACs: <span className="font-mono">{row.cells.acIds || row.cells.ac || "—"}</span>
          </p>
          {row.cells.openQuestions ? (
            <p className="text-[#92400e]">
              OPEN: <span className="font-mono">{row.cells.openQuestions}</span>
            </p>
          ) : (
            <p className="text-[#9ca3af]">No open questions.</p>
          )}
        </div>
      )}
      {tab === "history" && (
        <div className="space-y-2 text-[11.5px] text-[#374151]">
          <p>
            Origin: <strong>{row.cells.origin || "ai"}</strong>
            {row.cells.edited === "1" && row.cells.origin !== "human" ? " · Edited" : ""}
          </p>
          {row.cells.editedBy ? (
            <p>
              Last edit: {row.cells.editedBy}
              {row.cells.editedAt ? ` · ${new Date(Number(row.cells.editedAt)).toLocaleString()}` : ""}
            </p>
          ) : (
            <p className="text-[#9ca3af]">No human edits recorded.</p>
          )}
          <p>
            Status: {row.cells.executionStatus || "Not run"}
            {row.cells.statusBy
              ? ` · ${row.cells.statusBy}${
                  row.cells.statusAt ? ` · ${new Date(Number(row.cells.statusAt)).toLocaleString()}` : ""
                }`
              : ""}
            {row.cells.statusSource ? ` · source ${row.cells.statusSource}` : ""}
          </p>
          {row.cells.generationVersion || row.cells.version ? (
            <p>Generation version: {row.cells.generationVersion || row.cells.version}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
