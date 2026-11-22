"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeadFlag, DeadFlagHit, SitDeadAudit } from "@/app/interfaces/appatlas";

/** Plain-words labels for Quality groups (Round 5 A3). */
export const QUALITY_GROUP_LABEL: Partial<Record<DeadFlag, string>> = {
  duplicate_case: "Duplicate",
  empty_oracle: "Empty expected result",
  orphan_ticket: "No linked acceptance criterion",
  thin_case: "Thin (fewer than 4 steps)",
  contradiction: "Contradiction",
  generic_expected: "Needs review",
  template_case: "Needs review",
};

export const QUALITY_GROUP_ORDER: DeadFlag[] = [
  "duplicate_case",
  "empty_oracle",
  "orphan_ticket",
  "thin_case",
  "contradiction",
  "generic_expected",
];

/** @deprecated prefer QUALITY_GROUP_LABEL — kept for older strip UI */
export const DEAD_FLAG_LABEL: Record<DeadFlag, string> = {
  stub_workbook: "Placeholder suite",
  template_case: "Needs review",
  not_assessed: "Not assessed",
  needs_review: "Needs review",
  orphan_ticket: "Not linked to an acceptance criterion",
  empty_oracle: "Empty expected result",
  generic_expected: "Needs review",
  duplicate_case: "Duplicate",
  thin_case: "Thin (fewer than 4 steps)",
  contradiction: "Contradiction",
};

export const DEAD_FLAG_ORDER: DeadFlag[] = [
  "empty_oracle",
  "generic_expected",
  "orphan_ticket",
  "duplicate_case",
  "thin_case",
  "contradiction",
  "template_case",
  "not_assessed",
  "stub_workbook",
];

const CHIP =
  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors";

function qualityCount(audit: SitDeadAudit | null): number {
  if (!audit) return 0;
  let n = 0;
  for (const f of QUALITY_GROUP_ORDER) n += audit.summary?.[f] ?? 0;
  n += audit.summary?.template_case ?? 0;
  return n;
}

function groupHits(audit: SitDeadAudit): { flag: DeadFlag; label: string; items: DeadFlagHit & { rowId: string }[] }[] {
  const buckets = new Map<DeadFlag, (DeadFlagHit & { rowId: string })[]>();
  for (const [rowId, hits] of Object.entries(audit.flagsByRowId || {})) {
    for (const h of hits || []) {
      if (h.flag === "not_assessed" || h.flag === "needs_review" || h.flag === "stub_workbook") continue;
      const list = buckets.get(h.flag) || [];
      list.push({ ...h, rowId });
      buckets.set(h.flag, list);
    }
  }
  const out: { flag: DeadFlag; label: string; items: (DeadFlagHit & { rowId: string })[] }[] = [];
  for (const flag of QUALITY_GROUP_ORDER) {
    const items = buckets.get(flag) || [];
    if (!items.length) continue;
    out.push({ flag, label: QUALITY_GROUP_LABEL[flag] || flag, items });
  }
  const needs = buckets.get("generic_expected") || [];
  const tmpl = buckets.get("template_case") || [];
  // template already in needs review group via order; generic_expected listed
  if (tmpl.length && !out.some((g) => g.flag === "template_case")) {
    out.push({ flag: "template_case", label: "Needs review", items: tmpl });
  }
  void needs;
  return out;
}

function highlightRow(rowId: string) {
  const el = document.querySelector(`[data-row-id="${rowId}"]`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-[#8664F2]", "ring-offset-2");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-[#8664F2]", "ring-offset-2");
  }, 2000);
}

/** Always-visible strip (legacy view). */
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
  const flagged = qualityCount(audit);
  const summary = audit?.summary;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[#fde68a] bg-[#fffbeb] px-3 py-2 dark:border-[#78350f]/40 dark:bg-[#2a2210]">
      <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#92400e] dark:text-[#FCD34D]">
        Quality
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
            title="Quality flags: duplicates, empty expected results, unlinked ACs, thin cases, contradictions"
          >
            {flagged === 0 ? "0 flagged, suite looks live" : `${flagged} flagged`}
          </button>
          {DEAD_FLAG_ORDER.filter((f) => f !== "not_assessed" && f !== "stub_workbook").map((flag) => {
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
    </div>
  );
}

/**
 * Round 5 A3: Quality button opens a wide right drawer grouped by category.
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
  const flagged = qualityCount(audit);
  const needsReview = audit?.needsReviewRows ?? audit?.summary?.needs_review ?? audit?.summary?.not_assessed ?? 0;
  const groups = useMemo(() => (audit ? groupHits(audit) : []), [audit]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative flex items-center gap-2" ref={rootRef}>
      {needsReview > 0 && (
        <span
          className="rounded-[8px] border border-[#e2e6ef] bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-[#5b647a]"
          title="Priority and Severity not reviewed yet"
          data-testid="sit-needs-review-chip"
        >
          Needs review {needsReview}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition ${
          activeFlag || flagged > 0
            ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
            : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
        }`}
        title="Counts duplicates, empty expected results, cases not linked to an acceptance criterion, thin cases, and contradictions. Draft rows are never flagged."
        data-testid="sit-quality-btn"
      >
        {loading && !audit ? "Quality…" : `Quality: ${flagged} flagged${activeFlag ? " · filter on" : ""}`}
      </button>
      {open && (
        <div
          className="fixed right-3 top-16 z-40 flex h-[min(70vh,640px)] w-[min(480px,92vw)] flex-col rounded-[12px] border border-[#fcd34d] bg-[#fffbeb] shadow-xl dark:border-[#78350f] dark:bg-[#2a2210]"
          data-testid="sit-quality-drawer"
        >
          <div className="flex items-center justify-between border-b border-[#fde68a] px-3 py-2">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-[#92400e]">Quality findings</div>
            <button type="button" className="text-[12px] text-[#92400e]" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" data-testid="sit-quality-case-list">
            {flagged === 0 ? (
              <p className="text-[12px] text-[#92400e]/80">No quality issues flagged. Suite looks live.</p>
            ) : (
              groups.map((g) => (
                <div key={g.flag} className="mb-3">
                  <div className="mb-1 text-[12px] font-semibold text-[#92400e]">
                    {g.label} · {g.items.length}
                  </div>
                  <ul className="space-y-1">
                    {g.items.map((item, i) => (
                      <li key={`${item.rowId}-${g.flag}-${i}`}>
                        <button
                          type="button"
                          className="w-full rounded-[8px] border border-[#fde68a]/80 bg-white px-2 py-1.5 text-left text-[12px] text-[#78350f] hover:border-[#d97706] dark:bg-[#1a1408] dark:text-[#FCD34D]"
                          onClick={() => {
                            onFlag(g.flag);
                            highlightRow(item.rowId);
                            setOpen(false);
                          }}
                        >
                          <span className="font-mono font-semibold">{item.caseId || item.rowId.slice(0, 8)}</span>
                          {item.scenario ? (
                            <span className="text-[#92400e]/90"> · {item.scenario.slice(0, 80)}</span>
                          ) : null}
                          <div className="mt-0.5 text-[11.5px] text-[#a16207]">{item.reason}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
          <p className="border-t border-[#fde68a] px-3 py-2 text-[11px] text-[#92400e]/70">
            Draft rows are never flagged. Human rows only for duplicates and empty expected results. Not assessed is
            shown as Needs review, not as a quality defect.
          </p>
        </div>
      )}
    </div>
  );
}

export function filterRowsByDeadFlag<T extends { id: string }>(
  rows: T[],
  audit: SitDeadAudit | null,
  flag: DeadFlag | null,
): T[] {
  if (!flag || !audit) return rows;
  return rows.filter((r) => (audit.flagsByRowId[r.id] || []).some((h) => h.flag === flag));
}

export function DeadFlagPills({ hits }: { hits: DeadFlagHit[] }) {
  if (!hits?.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-0.5">
      {hits.map((h, i) => (
        <span
          key={`${h.flag}-${i}`}
          className="rounded bg-[#fff7ed] px-1 text-[10px] font-medium text-[#9a3412]"
          title={h.reason}
        >
          {DEAD_FLAG_LABEL[h.flag] || h.flag}
        </span>
      ))}
    </span>
  );
}
