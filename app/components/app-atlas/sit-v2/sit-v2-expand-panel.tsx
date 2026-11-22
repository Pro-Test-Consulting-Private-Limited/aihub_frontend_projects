"use client";

import { useState } from "react";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import { CopyField, OriginBadge } from "./sit-v2-bits";
import { renderBulletLines } from "./sit-v2-bullets";

function TestDataBlock({ row }: { row: SitSheetRow }) {
  const entries: [string, string][] = [];
  for (const [k, v] of Object.entries(row.cells)) {
    if (k.startsWith("td_") && v) entries.push([k.slice(3), v]);
  }
  const ph = [...(row.cells.steps || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]!);
  for (const p of ph) {
    if (!entries.some(([k]) => k === p)) entries.push([p, row.cells[`td_${p}`] || ""]);
  }
  if (!entries.length) {
    return <p className="text-[12px] text-[#9ca3af]">No test data placeholders on this case.</p>;
  }
  return (
    <div className="rounded-[6px] border border-dashed border-[#c4b5fd]/60 bg-[#faf5ff]/50 p-2 dark:bg-[#1c1530]/40">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#7c3aed]">Test data</span>
        <button
          type="button"
          className="text-[12px] font-medium text-[#8664F2]"
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

export type ExpandTab = "testdata" | "coverage" | "history" | "ai";

/**
 * Round 4 B4: expanded panel does NOT repeat Preconditions/Steps/Expected.
 * Left = metadata; right = Test data | Coverage | History | AI original.
 */
export function SitV2ExpandPanel({
  row,
  canEdit,
  onPatch,
  acTexts,
  initialTab = "testdata",
}: {
  row: SitSheetRow;
  canEdit: boolean;
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  /** Optional AC id → text for Coverage/metadata. */
  acTexts?: Record<string, string>;
  initialTab?: ExpandTab;
}) {
  const [tab, setTab] = useState<ExpandTab>(initialTab);
  const acIds = (row.cells.acIds || row.cells.ac || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  let aiOriginal: Record<string, string> | null = null;
  if (row.cells.aiOriginal) {
    try {
      aiOriginal = JSON.parse(row.cells.aiOriginal) as Record<string, string>;
    } catch {
      aiOriginal = null;
    }
  }

  return (
    <div
      className="border-t border-[#eef0f5] bg-[#fafafa] px-3 py-3 dark:border-[#1a1a1a] dark:bg-[#0c0c0c]"
      data-testid="sit-row-expand-panel"
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 text-[12px] text-[#374151]" data-testid="sit-expand-meta">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge origin={row.cells.origin} edited={row.cells.edited === "1"} />
            {(row.cells.thin === "1" || row.cells.thin === "true") && (
              <span
                className="inline-flex rounded-full border border-[#fde68a] bg-[#fffbeb] px-2 py-0.5 text-[12px] font-semibold text-[#92400e]"
                title="Thin — fewer than 4 steps, 3 precondition bullets, or 2 expected bullets after expand"
                data-testid="sit-thin-chip"
              >
                Thin
              </span>
            )}
          </div>
          <p>
            Status: <strong>{row.cells.executionStatus || "Not run"}</strong>
            {row.cells.statusBy
              ? ` · set by ${row.cells.statusBy}${
                  row.cells.statusAt ? ` at ${new Date(Number(row.cells.statusAt)).toLocaleString()}` : ""
                }`
              : " · not set by a human yet"}
          </p>
          {row.cells.editedBy ? (
            <p>
              Edited by {row.cells.editedBy}
              {row.cells.editedAt ? ` · ${new Date(Number(row.cells.editedAt)).toLocaleString()}` : ""}
            </p>
          ) : (
            <p className="text-[#9ca3af]">No human content edits recorded.</p>
          )}
          {(row.cells.generationVersion || row.cells.version) && (
            <p>Version: {row.cells.generationVersion || row.cells.version}</p>
          )}
          <div>
            <div className="mb-1 font-semibold text-[#5b647a]">Acceptance criteria covered</div>
            {acIds.length ? (
              <ul className="m-0 list-disc space-y-1 pl-4">
                {acIds.map((id) => (
                  <li key={id}>
                    <span className="font-mono font-semibold">{id}</span>
                    {acTexts?.[id] ? <span className="text-[#5b647a]"> — {acTexts[id]}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[#9ca3af]">No AC ids on this case.</p>
            )}
          </div>
          {row.cells.openQuestions ? (
            <p className="text-[#92400e]">
              OPEN: <span className="font-mono">{row.cells.openQuestions}</span>
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Row detail tabs">
            {(
              [
                ["testdata", "Test data"],
                ["coverage", "Coverage"],
                ["history", "History"],
                ["ai", "AI original"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${
                  tab === id ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "testdata" && <TestDataBlock row={row} />}
          {tab === "coverage" && (
            <div className="space-y-2 text-[12px]">
              <p>
                ACs: <span className="font-mono">{row.cells.acIds || row.cells.ac || "—"}</span>
              </p>
              {acIds.map((id) =>
                acTexts?.[id] ? (
                  <p key={id} className="text-[#5b647a]">
                    <span className="font-mono font-semibold text-[#374151]">{id}:</span> {acTexts[id]}
                  </p>
                ) : null,
              )}
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
            <div className="space-y-2 text-[12px] text-[#374151]">
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
              </p>
            </div>
          )}
          {tab === "ai" && (
            <div className="space-y-2 text-[12px]">
              {aiOriginal ? (
                <>
                  <p className="font-medium">{aiOriginal.scenario || "—"}</p>
                  <div>
                    <div className="text-[12px] font-semibold text-[#5b647a]">Original steps</div>
                    <pre className="whitespace-pre-wrap font-[inherit] text-[12px]">{aiOriginal.steps || "—"}</pre>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#5b647a]">Original expected</div>
                    {renderBulletLines(aiOriginal.expected || "") || (
                      <span className="text-[#9ca3af]">—</span>
                    )}
                  </div>
                  {canEdit && row.cells.origin === "ai" && row.cells.edited === "1" && (
                    <button
                      type="button"
                      className="rounded-[8px] border border-[#fecaca] px-2 py-1 text-[12px] text-[#991b1b]"
                      onClick={() => onPatch(row.id, { revertAi: true })}
                    >
                      Revert to AI version
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[#9ca3af]">No AI original snapshot stored for this row.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
