"use client";

import { useState } from "react";
import type { DeadFlagHit, SitSheetRow } from "@/app/interfaces/appatlas";
import { OriginBadge } from "./sit-v2-bits";
import { renderBulletLines } from "./sit-v2-bullets";
import { listFieldEdits } from "./sit-v2-edit-dot";
import { SitQualityFlagChip, SitQualityReasons } from "./sit-quality-flag-chip";

function TestDataTable({ row }: { row: SitSheetRow }) {
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
    <div data-testid="sit-expand-testdata">
      <div className="mb-1 text-[12px] font-semibold text-[#7c3aed]">Test data</div>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k} className="border-b border-[#eef0f5]">
              <td className="py-0.5 pr-2 font-mono text-[12px] text-[#5b647a]">{k}</td>
              <td className="py-0.5 font-mono">{v || "(empty)"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ExpandTab = "history" | "ai";

/**
 * R7-06: sticky left panel as wide as visible grid; Covers / Test data / Activity.
 */
export function SitV2ExpandPanel({
  row,
  canEdit,
  onPatch,
  acTexts,
  qualityHits,
  initialTab = "history",
}: {
  row: SitSheetRow;
  canEdit: boolean;
  onPatch: (rowId: string, body: Record<string, unknown>) => void;
  acTexts?: Record<string, string>;
  qualityHits?: DeadFlagHit[];
  initialTab?: ExpandTab;
}) {
  const [tab, setTab] = useState<ExpandTab>(initialTab);
  const [showAllAc, setShowAllAc] = useState(false);
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
  const fieldEdits = listFieldEdits(row);
  const openQs = (row.cells.openQuestions || "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const version = row.cells.generationVersion || row.cells.version || "1";
  const status = row.cells.executionStatus || "Not run";
  const statusHuman = Boolean(row.cells.statusBy);
  const visibleAcs = showAllAc ? acIds : acIds.slice(0, 5);
  const hasTestData = Object.keys(row.cells).some((k) => k.startsWith("td_") && row.cells[k]);

  return (
    <div
      className="sticky left-0 border-t border-[#eef0f5] bg-[#fafafa] px-3 py-3 dark:border-[#1a1a1a] dark:bg-[#0c0c0c]"
      style={{ width: "100%", maxWidth: "100vw" }}
      data-testid="sit-row-expand-panel"
    >
      <div
        className="mb-3 flex flex-wrap items-center gap-2 text-[13px]"
        data-testid="sit-expand-header"
      >
        <OriginBadge origin={row.cells.origin} edited={row.cells.edited === "1"} />
        <span className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[12px]">
          Version {version}
        </span>
        <span className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[12px]">
          {statusHuman
            ? `${status} by ${row.cells.statusBy}${
                row.cells.statusAt ? `, ${new Date(Number(row.cells.statusAt)).toLocaleDateString()}` : ""
              }`
            : "Not run"}
        </span>
        {fieldEdits.length > 0 ? (
          <span className="rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[12px] text-[#5b21b6]">
            Edited: {fieldEdits.length} fields
          </span>
        ) : null}
        {openQs.length > 0 ? (
          <span className="rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2 py-0.5 text-[12px] text-[#92400e]">
            OPEN {openQs.length}
          </span>
        ) : null}
        <SitQualityFlagChip hits={qualityHits} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3" data-testid="sit-expand-columns">
        <div data-testid="sit-expand-covers">
          <div className="mb-1 text-[12px] font-semibold text-[#5b647a]">Covers</div>
          {acIds.length ? (
            <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
              {visibleAcs.map((id) => (
                <li key={id}>
                  <span className="font-mono font-bold">{id}</span>
                  {acTexts?.[id] ? (
                    <span className="text-[#374151]"> - {acTexts[id]}</span>
                  ) : (
                    <span className="text-[#9ca3af]"> - (AC text not available)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#9ca3af]">No AC ids on this case.</p>
          )}
          {acIds.length > 5 && !showAllAc ? (
            <button
              type="button"
              className="mt-1 text-[12px] font-medium text-[#8664F2]"
              onClick={() => setShowAllAc(true)}
            >
              Show all
            </button>
          ) : null}
          <div className="mt-3">
            <SitQualityReasons hits={qualityHits} />
          </div>
        </div>

        {hasTestData || Object.keys(row.cells).some((k) => k.startsWith("td_")) ? (
          <TestDataTable row={row} />
        ) : (
          <div className="hidden lg:block" />
        )}

        <div data-testid="sit-expand-activity">
          <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Activity">
            {(
              [
                ["history", "History"],
                ["ai", "AI original"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                data-testid={`sit-expand-tab-${id}`}
                className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${
                  tab === id ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "history" && (
            <div className="space-y-2 text-[13px] text-[#374151]" data-testid="sit-expand-edits">
              {fieldEdits.length === 0 ? (
                <p className="text-[#9ca3af]">No changes yet</p>
              ) : (
                <ul className="m-0 space-y-2 p-0">
                  {fieldEdits.map((ed) => (
                    <li
                      key={ed.field}
                      className="rounded border border-[#e2e6ef] bg-white px-2 py-1.5 dark:border-[#2a2a2a] dark:bg-[#141414]"
                    >
                      <div className="font-mono text-[12px] font-semibold text-[#5b21b6]">{ed.field}</div>
                      <div className="text-[#6b7280]">
                        Old: {ed.originalRecorded ? ed.from || "(empty)" : "changed (original not recorded)"}
                      </div>
                      <div>New: {ed.to || "(empty)"}</div>
                      <div className="text-[#9ca3af]">
                        {ed.by || "unknown"}
                        {ed.at ? `, ${new Date(Number(ed.at)).toLocaleString()}` : ""}
                      </div>
                      {canEdit && row.cells.origin !== "human" && (
                        <button
                          type="button"
                          className="mt-1 text-[12px] font-medium text-[#8664F2] underline-offset-2 hover:underline"
                          data-testid={`sit-revert-field-${ed.field}`}
                          onClick={() => onPatch(row.id, { revertField: ed.field })}
                        >
                          Revert this field to AI
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && row.cells.origin === "ai" && row.cells.edited === "1" && fieldEdits.length > 0 && (
                <button
                  type="button"
                  className="mt-2 rounded-[8px] border border-[#fecaca] px-2 py-1 text-[12px] text-[#991b1b]"
                  data-testid="sit-revert-all-ai"
                  onClick={() => onPatch(row.id, { revertAi: true })}
                >
                  Revert all to AI
                </button>
              )}
            </div>
          )}
          {tab === "ai" && (
            <div className="space-y-2 text-[13px]">
              {aiOriginal ? (
                <>
                  <p className="font-medium">{aiOriginal.scenario || ""}</p>
                  <div>
                    <div className="text-[12px] font-semibold text-[#5b647a]">Original steps</div>
                    <pre className="whitespace-pre-wrap font-[inherit] text-[13px]">{aiOriginal.steps || ""}</pre>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#5b647a]">Original expected</div>
                    {renderBulletLines(aiOriginal.expected || "")}
                  </div>
                  {canEdit && row.cells.origin === "ai" && row.cells.edited === "1" && (
                    <button
                      type="button"
                      className="rounded-[8px] border border-[#fecaca] px-2 py-1 text-[12px] text-[#991b1b]"
                      data-testid="sit-revert-all-ai"
                      onClick={() => onPatch(row.id, { revertAi: true })}
                    >
                      Revert all to AI
                    </button>
                  )}
                </>
              ) : (
                <p className="text-[#9ca3af]">No changes yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
