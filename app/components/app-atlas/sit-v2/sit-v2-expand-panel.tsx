"use client";

import { useState } from "react";
import type { DeadFlagHit, SitSheetRow } from "@/app/interfaces/appatlas";
import { OriginBadge } from "./sit-v2-bits";
import { renderBulletLines } from "./sit-v2-bullets";
import { listFieldEdits } from "./sit-v2-edit-dot";
import { SitQualityFlagChip, SitQualityReasons } from "./sit-quality-flag-chip";
import { getCaseProvenance } from "@/app/lib/sit-case-provenance";

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
    <div data-testid="sit-expand-testdata" className="mt-3">
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
 * R10-05: left-aligned Covers / Quality / Activity (max-width columns, no stretch gap).
 * Header chips use short labels; long reasons only in Quality.
 * AI original tab only for AI origin.
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
  const prov = getCaseProvenance(row.cells);
  const isAi = prov.origin === "ai";
  const [tab, setTab] = useState<ExpandTab>(initialTab === "ai" && !isAi ? "history" : initialTab);
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
    .split(/[,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/^(OPEN:\s*)+/i, "").replace(/^OPEN\s+/i, "").trim())
    .filter(Boolean)
    .map((s) => (/^Q\d+/i.test(s) ? s.toUpperCase().replace(/^q/i, "Q") : s));
  const openChipLabel =
    openQs.length === 0
      ? ""
      : openQs.length === 1
        ? `OPEN ${openQs[0]!.replace(/^OPEN\s+/i, "")}`
        : `OPEN ${openQs.length}`;
  const version = row.cells.generationVersion || row.cells.version || "1";
  const status = row.cells.executionStatus || "Not run";
  const statusHuman = Boolean(row.cells.statusBy);
  const visibleAcs = showAllAc ? acIds : acIds.slice(0, 5);
  const hasTestData = Object.keys(row.cells).some((k) => k.startsWith("td_") && row.cells[k]);
  const statusLabel = statusHuman
    ? `Set to ${status} by ${row.cells.statusBy}${
        row.cells.statusAt ? `, ${new Date(Number(row.cells.statusAt)).toLocaleDateString()}` : ""
      }`
    : status;

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
        <OriginBadge origin={prov.origin} edited={prov.edited} />
        <span className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[12px]">
          Version {version}
        </span>
        <span className="rounded-full border border-[#e2e6ef] bg-white px-2 py-0.5 text-[12px]" data-testid="sit-expand-status">
          {statusLabel}
        </span>
        {fieldEdits.length > 0 ? (
          <span className="rounded-full border border-[#ddd6fe] bg-[#f5f3ff] px-2 py-0.5 text-[12px] text-[#5b21b6]">
            Edited: {fieldEdits.length} fields
          </span>
        ) : null}
        {openQs.length > 0 ? (
          <span
            className="rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2 py-0.5 text-[12px] text-[#92400e]"
            data-testid="sit-expand-open-chip"
            title={openQs.map((q) => `OPEN ${q.replace(/^OPEN\s+/i, "")}`).join(", ")}
          >
            {openChipLabel}
          </span>
        ) : null}
        <SitQualityFlagChip hits={qualityHits} />
      </div>

      <div
        className="flex flex-wrap items-start gap-6"
        data-testid="sit-expand-columns"
      >
        <div data-testid="sit-expand-covers" className="w-full max-w-[320px] shrink-0">
          <div className="mb-1 text-[12px] font-semibold text-[#5b647a]">Covers</div>
          {acIds.length ? (
            <ul className="m-0 list-none space-y-1 p-0 text-[13px]">
              {visibleAcs.map((id) => (
                <li key={id}>
                  <span className="font-mono font-bold">{id}</span>
                  {acTexts?.[id] ? (
                    <span className="text-[#374151]">: {acTexts[id]}</span>
                  ) : (
                    <span className="text-[#9ca3af]">: (AC text not available)</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#9ca3af]">No acceptance criteria linked</p>
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
          {hasTestData ? <TestDataTable row={row} /> : null}
        </div>

        <div data-testid="sit-expand-quality-col" className="w-full max-w-[360px] shrink-0">
          {qualityHits && qualityHits.length > 0 ? (
            <SitQualityReasons hits={qualityHits} />
          ) : (
            <>
              <div className="mb-1 text-[12px] font-semibold text-[#5b647a]">Quality</div>
              <p className="text-[13px] text-[#9ca3af]">No quality issues</p>
            </>
          )}
        </div>

        <div data-testid="sit-expand-activity" className="w-full max-w-[420px] shrink-0">
          <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Activity">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "history"}
              data-testid="sit-expand-tab-history"
              className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${
                tab === "history" ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
              }`}
              onClick={() => setTab("history")}
            >
              History
            </button>
            {isAi ? (
              <button
                type="button"
                role="tab"
                aria-selected={tab === "ai"}
                data-testid="sit-expand-tab-ai"
                className={`rounded-[6px] px-2 py-0.5 text-[12px] font-medium ${
                  tab === "ai" ? "bg-[#8664F2] text-white" : "border border-[#e2e6ef] bg-white text-[#5b647a]"
                }`}
                onClick={() => setTab("ai")}
              >
                AI original
              </button>
            ) : null}
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
          {tab === "ai" && isAi && (
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
