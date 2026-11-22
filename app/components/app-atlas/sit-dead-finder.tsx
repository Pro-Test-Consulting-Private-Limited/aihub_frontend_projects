"use client";

import { useEffect, useRef, useState } from "react";
import type { DeadFlag, DeadFlagHit, SitDeadAudit } from "@/app/interfaces/appatlas";

export const DEAD_FLAG_LABEL: Record<DeadFlag, string> = {
  stub_workbook: "Placeholder suite",
  template_case: "Template case",
  not_assessed: "Not assessed",
  orphan_ticket: "Orphan ticket",
  empty_oracle: "Empty oracle",
  generic_expected: "Generic expected",
  duplicate_case: "Duplicate case",
};

export const DEAD_FLAG_ORDER: DeadFlag[] = [
  "empty_oracle",
  "generic_expected",
  "orphan_ticket",
  "duplicate_case",
  "template_case",
  "not_assessed",
  "stub_workbook",
];

const CHIP =
  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors";

/** Always-visible Dead Test Finder strip: summary + per-flag filters. */
export function DeadTestFinderStrip({
  audit,
  loading,
  activeFlag,
  onFlag,
}: {
  audit: SitDeadAudit | null;
  loading?: boolean;
  activeFlag: DeadFlag | null;
  onFlag: (flag: DeadFlag | null) => void;
}) {
  const flagged = audit?.flaggedRows ?? 0;
  const summary = audit?.summary;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#fde68a] bg-[#fffbeb] px-3 py-2 dark:border-[#78350f]/40 dark:bg-[#2a2210]">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#92400e] dark:text-[#FCD34D]">
        Dead Test Finder
      </span>
      {loading && !audit ? (
        <span className="text-[11px] text-[#92400e]/80">Checking suite…</span>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onFlag(null)}
            className={`${CHIP} ${
              activeFlag === null
                ? "border-[#d97706] bg-[#d97706] text-white"
                : "border-[#fcd34d] bg-white text-[#92400e] dark:bg-[#1a1408] dark:text-[#FCD34D]"
            }`}
            title="Show all cases (clear dead-flag filter)"
          >
            {flagged === 0 ? "0 flagged  -  suite looks live" : `${flagged} flagged`}
          </button>
          {DEAD_FLAG_ORDER.map((flag) => {
            const n = summary?.[flag] ?? 0;
            if (!n && activeFlag !== flag) return null;
            return (
              <button
                key={flag}
                type="button"
                onClick={() => onFlag(activeFlag === flag ? null : flag)}
                className={`${CHIP} ${
                  activeFlag === flag
                    ? "border-[#b45309] bg-[#b45309] text-white"
                    : "border-[#fcd34d] bg-white text-[#92400e] dark:bg-[#1a1408] dark:text-[#FCD34D]"
                }`}
                title={DEAD_FLAG_LABEL[flag]}
              >
                {DEAD_FLAG_LABEL[flag]} · {n}
              </button>
            );
          })}
        </>
      )}
      <span className="ml-auto text-[12px] text-[#92400e]/70 dark:text-[#FCD34D]/70">
        Empty oracle, orphan, duplicate — Draft rows are never flagged
      </span>
    </div>
  );
}

/**
 * Compact toolbar control: "Quality: N flagged" opens a popover with the same filters
 * as DeadTestFinderStrip (does not push the results grid down).
 */
export function DeadTestFinderToolbar({
  audit,
  loading,
  activeFlag,
  onFlag,
}: {
  audit: SitDeadAudit | null;
  loading?: boolean;
  activeFlag: DeadFlag | null;
  onFlag: (flag: DeadFlag | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const flagged = audit?.flaggedRows ?? 0;
  const summary = audit?.summary;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition ${
          activeFlag || flagged > 0
            ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
            : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
        }`}
        title="Dead Test Finder"
      >
        {loading && !audit
          ? "Quality…"
          : `Quality: ${flagged} flagged${activeFlag ? " · filter on" : ""}`}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-[min(420px,90vw)] rounded-[10px] border border-[#fcd34d] bg-[#fffbeb] p-3 shadow-lg dark:border-[#78350f] dark:bg-[#2a2210]">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#92400e] dark:text-[#FCD34D]">
            Dead Test Finder
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onFlag(null)}
              className={`${CHIP} ${
                activeFlag === null
                  ? "border-[#d97706] bg-[#d97706] text-white"
                  : "border-[#fcd34d] bg-white text-[#92400e] dark:bg-[#1a1408] dark:text-[#FCD34D]"
              }`}
            >
              {flagged === 0 ? "0 flagged — looks live" : `${flagged} flagged`}
            </button>
            {DEAD_FLAG_ORDER.map((flag) => {
              const n = summary?.[flag] ?? 0;
              if (!n && activeFlag !== flag) return null;
              return (
                <button
                  key={flag}
                  type="button"
                  onClick={() => onFlag(activeFlag === flag ? null : flag)}
                  className={`${CHIP} ${
                    activeFlag === flag
                      ? "border-[#b45309] bg-[#b45309] text-white"
                      : "border-[#fcd34d] bg-white text-[#92400e] dark:bg-[#1a1408] dark:text-[#FCD34D]"
                  }`}
                >
                  {DEAD_FLAG_LABEL[flag]} · {n}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-[#92400e]/70 dark:text-[#FCD34D]/70">
            Empty oracle, orphan, duplicate — Draft rows are never flagged. Not assessed = AI only.
          </p>
          {audit && flagged > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[12px]" data-testid="sit-quality-case-list">
              {Object.entries(audit.flagsByRowId || {})
                .flatMap(([rowId, hits]) =>
                  (hits || []).map((h) => ({
                    rowId,
                    flag: h.flag,
                    reason: h.reason,
                    caseId: (h as { caseId?: string }).caseId,
                  })),
                )
                .slice(0, 40)
                .map((item, i) => (
                  <li key={`${item.rowId}-${item.flag}-${i}`}>
                    <button
                      type="button"
                      className="text-left text-[#92400e] underline-offset-2 hover:underline"
                      onClick={() => {
                        document
                          .querySelector(`[data-row-id="${item.rowId}"]`)
                          ?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }}
                    >
                      <span className="font-semibold">{DEAD_FLAG_LABEL[item.flag]}</span>
                      {item.reason ? ` — ${item.reason}` : ""}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function DeadFlagPills({ hits }: { hits: DeadFlagHit[] | undefined }) {
  if (!hits?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {hits.map((h) => (
        <span
          key={`${h.flag}:${h.reason}`}
          title={h.reason}
          className="rounded border border-[#fcd34d] bg-[#fffbeb] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#92400e] dark:border-[#78350f] dark:bg-[#2a2210] dark:text-[#FCD34D]"
        >
          {DEAD_FLAG_LABEL[h.flag]}
        </span>
      ))}
    </div>
  );
}

/** Keep rows that carry the selected dead flag (and still match ticket/type filters upstream). */
export function filterRowsByDeadFlag<T extends { id: string }>(
  rows: T[],
  audit: SitDeadAudit | null,
  flag: DeadFlag | null,
): T[] {
  if (!flag || !audit) return rows;
  return rows.filter((r) => (audit.flagsByRowId[r.id] || []).some((h) => h.flag === flag));
}
