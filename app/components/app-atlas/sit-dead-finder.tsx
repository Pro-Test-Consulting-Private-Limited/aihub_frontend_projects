"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DeadFlag, DeadFlagHit, SitDeadAudit } from "@/app/interfaces/appatlas";

/** Plain-words labels for Quality groups (Round 5 A3 / Round 6 A1). */
export const QUALITY_GROUP_LABEL: Partial<Record<DeadFlag, string>> = {
  duplicate_case: "Duplicate",
  empty_oracle: "Empty expected result",
  orphan_ticket: "Not linked to an acceptance criterion",
  thin_case: "Thin (fewer than 4 steps)",
  contradiction: "Contradiction",
  generic_expected: "Needs review",
  template_case: "Needs review",
  needs_review: "Needs review",
  not_assessed: "Needs review",
};

export const QUALITY_GROUP_ORDER: DeadFlag[] = [
  "duplicate_case",
  "empty_oracle",
  "orphan_ticket",
  "thin_case",
  "contradiction",
];

/** @deprecated prefer QUALITY_GROUP_LABEL */
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

/** Round 6 A1: off | all flagged | one quality group | needs review. */
export type QualityFilter = null | "all" | DeadFlag;

const QUALITY_FLAGS: DeadFlag[] = [
  "duplicate_case",
  "empty_oracle",
  "orphan_ticket",
  "thin_case",
  "contradiction",
  "generic_expected",
];

function qualityCount(audit: SitDeadAudit | null): number {
  if (!audit) return 0;
  let n = 0;
  for (const f of QUALITY_GROUP_ORDER) n += audit.summary?.[f] ?? 0;
  return n;
}

function isNeedsReviewFlag(flag: DeadFlag): boolean {
  return flag === "needs_review" || flag === "not_assessed" || flag === "generic_expected" || flag === "template_case";
}

type DeadHitWithRow = DeadFlagHit & { rowId: string };

function groupHits(audit: SitDeadAudit): { flag: DeadFlag; label: string; items: DeadHitWithRow[] }[] {
  const buckets = new Map<DeadFlag, DeadHitWithRow[]>();
  for (const [rowId, hits] of Object.entries(audit.flagsByRowId || {})) {
    for (const h of hits || []) {
      if (h.flag === "not_assessed" || h.flag === "needs_review" || h.flag === "stub_workbook") continue;
      if (h.flag === "generic_expected" || h.flag === "template_case") continue;
      const list = buckets.get(h.flag) || [];
      list.push({ ...h, rowId });
      buckets.set(h.flag, list);
    }
  }
  const out: { flag: DeadFlag; label: string; items: DeadHitWithRow[] }[] = [];
  for (const flag of QUALITY_GROUP_ORDER) {
    const items = buckets.get(flag) || [];
    if (!items.length) continue;
    out.push({ flag, label: QUALITY_GROUP_LABEL[flag] || flag, items });
  }
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

function filterLabel(filter: QualityFilter): string {
  if (!filter) return "";
  if (filter === "all") return "all flagged";
  if (isNeedsReviewFlag(filter)) return "needs review";
  return (QUALITY_GROUP_LABEL[filter] || filter).toLowerCase();
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
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
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
            onClick={() => onFlag(activeFlag === "all" ? null : "all")}
            className={`${CHIP} ${
              activeFlag === "all"
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
 * Round 6 A1/A3: Quality button + toggleable filter + toolbar chip + push/overlay drawer.
 */
export function DeadTestFinderToolbar({
  audit,
  loading,
  activeFlag,
  onFlag,
  open: openControlled,
  onOpenChange,
  hideOverlayPanel = false,
}: {
  audit: SitDeadAudit | null;
  loading?: boolean;
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** When true, parent renders QualityDrawerPanel (push layout); toolbar only has controls + chip. */
  hideOverlayPanel?: boolean;
}) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = openControlled ?? openLocal;
  const setOpen = onOpenChange ?? setOpenLocal;
  const rootRef = useRef<HTMLDivElement>(null);
  const flagged = qualityCount(audit);
  const needsReview = audit?.needsReviewRows ?? audit?.summary?.needs_review ?? audit?.summary?.not_assessed ?? 0;
  const groups = useMemo(() => (audit ? groupHits(audit) : []), [audit]);
  const filterOn = activeFlag != null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open || hideOverlayPanel) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const drawer = document.querySelector('[data-testid="sit-quality-drawer"]');
      if (drawer?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, hideOverlayPanel, setOpen]);

  const clearFilter = () => onFlag(null);

  const onQualityButtonClick = () => {
    // Round 6 A1: first click → all-flagged filter + open panel; second click → filter OFF
    if (filterOn) {
      clearFilter();
      setOpen(false);
      return;
    }
    onFlag("all");
    setOpen(true);
  };

  const toggleGroup = (flag: DeadFlag) => {
    onFlag(activeFlag === flag ? null : flag);
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2" ref={rootRef}>
      {needsReview > 0 && (
        <button
          type="button"
          className={`rounded-[8px] border px-2.5 py-1.5 text-[12.5px] font-medium ${
            activeFlag === "needs_review" || activeFlag === "not_assessed"
              ? "border-[#8664F2] bg-[#f3f0ff] text-[#5b21b6]"
              : "border-[#e2e6ef] bg-white text-[#5b647a]"
          }`}
          title="Priority and Severity not reviewed yet"
          data-testid="sit-needs-review-chip"
          onClick={() =>
            onFlag(activeFlag === "needs_review" || activeFlag === "not_assessed" ? null : "needs_review")
          }
        >
          Needs review {needsReview}
        </button>
      )}
      <button
        type="button"
        onClick={onQualityButtonClick}
        className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition ${
          filterOn || flagged > 0
            ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
            : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
        }`}
        title={
          filterOn
            ? "Filter is on. Click again to show all cases."
            : "Counts duplicates, empty expected results, cases not linked to an acceptance criterion, thin cases, and contradictions. Draft rows are never flagged."
        }
        data-testid="sit-quality-btn"
        aria-pressed={filterOn}
      >
        {loading && !audit
          ? "Quality…"
          : `Quality: ${flagged} flagged${filterOn ? " · filter on" : ""}`}
      </button>
      {!open && (
        <button
          type="button"
          className="rounded-[8px] border border-[#e2e6ef] px-2 py-1.5 text-[12px] text-[#5b647a]"
          data-testid="sit-quality-open-panel"
          onClick={() => setOpen(true)}
        >
          Open panel
        </button>
      )}
      {filterOn && (
        <span
          className="inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2.5 py-1 text-[11.5px] font-medium text-[#92400e]"
          data-testid="sit-quality-filter-chip"
        >
          Showing {filterLabel(activeFlag)} cases
          <button
            type="button"
            className="ml-0.5 rounded px-1 text-[#92400e] hover:bg-[#fde68a]"
            aria-label="Show all cases"
            data-testid="sit-quality-filter-chip-clear"
            onClick={clearFilter}
          >
            × Show all
          </button>
        </span>
      )}
      {!hideOverlayPanel && open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20"
            data-testid="sit-quality-scrim"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed right-3 top-16 z-40 flex h-[min(70vh,640px)] w-[min(480px,92vw)] flex-col rounded-[12px] border border-[#fcd34d] bg-[#fffbeb] shadow-xl dark:border-[#78350f] dark:bg-[#2a2210]"
            data-testid="sit-quality-drawer"
            role="dialog"
            aria-label="Quality findings"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#fde68a] px-3 py-2">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-[#92400e]">Quality findings</div>
                {filterOn ? (
                  <div className="truncate text-[11px] text-[#a16207]" data-testid="sit-quality-active-filter">
                    Filter: {filterLabel(activeFlag)}
                  </div>
                ) : (
                  <div className="text-[11px] text-[#a16207]">No filter · browsing all cases</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  className="rounded-[6px] border border-[#fcd34d] bg-white px-2 py-1 text-[11.5px] font-medium text-[#92400e]"
                  data-testid="sit-quality-show-all"
                  onClick={clearFilter}
                >
                  Show all cases
                </button>
                <button
                  type="button"
                  className="text-[12px] text-[#92400e]"
                  data-testid="sit-quality-close"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" data-testid="sit-quality-case-list">
              {flagged === 0 ? (
                <p className="text-[12px] text-[#92400e]/80">No quality issues flagged. Suite looks live.</p>
              ) : (
                <>
                  <button
                    type="button"
                    className={`mb-3 w-full rounded-[8px] border px-2 py-1.5 text-left text-[12px] font-medium ${
                      activeFlag === "all"
                        ? "border-[#d97706] bg-[#d97706] text-white"
                        : "border-[#fde68a] bg-white text-[#78350f]"
                    }`}
                    data-testid="sit-quality-filter-all"
                    onClick={() => onFlag(activeFlag === "all" ? null : "all")}
                  >
                    All flagged · {flagged}
                  </button>
                  {groups.map((g) => (
                    <div key={g.flag} className="mb-3">
                      <button
                        type="button"
                        className={`mb-1 w-full rounded px-1 py-0.5 text-left text-[12px] font-semibold ${
                          activeFlag === g.flag ? "bg-[#fde68a] text-[#78350f]" : "text-[#92400e]"
                        }`}
                        data-testid={`sit-quality-group-${g.flag}`}
                        onClick={() => toggleGroup(g.flag)}
                        title={activeFlag === g.flag ? "Click to clear this filter" : "Filter to this group"}
                      >
                        {g.label} · {g.items.length}
                        {activeFlag === g.flag ? " · filter on (click to clear)" : ""}
                      </button>
                      <ul className="space-y-1">
                        {g.items.map((item, i) => (
                          <li key={`${item.rowId}-${g.flag}-${i}`}>
                            <button
                              type="button"
                              className="w-full rounded-[8px] border border-[#fde68a]/80 bg-white px-2 py-1.5 text-left text-[12px] text-[#78350f] hover:border-[#d97706] dark:bg-[#1a1408] dark:text-[#FCD34D]"
                              onClick={() => {
                                if (activeFlag !== g.flag) onFlag(g.flag);
                                highlightRow(item.rowId);
                              }}
                            >
                              <span className="font-mono font-semibold">
                                {item.caseId || item.rowId.slice(0, 8)}
                              </span>
                              {item.scenario ? (
                                <span className="text-[#92400e]/90"> · {item.scenario.slice(0, 80)}</span>
                              ) : null}
                              <div className="mt-0.5 text-[11.5px] text-[#a16207]">{item.reason}</div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )}
            </div>
            <p className="border-t border-[#fde68a] px-3 py-2 text-[11px] text-[#92400e]/70">
              Closing this panel keeps your filter chip visible. Use Show all cases or click Quality again to clear.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function QualityDrawerPanel({
  audit,
  activeFlag,
  onFlag,
  onClose,
}: {
  audit: SitDeadAudit | null;
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
  onClose: () => void;
}) {
  const flagged = qualityCount(audit);
  const groups = useMemo(() => (audit ? groupHits(audit) : []), [audit]);
  const filterOn = activeFlag != null;
  return (
    <div
      className="flex h-full w-[min(420px,40vw)] shrink-0 flex-col border-l border-[#fcd34d] bg-[#fffbeb] dark:border-[#78350f] dark:bg-[#2a2210]"
      data-testid="sit-quality-drawer"
      role="dialog"
      aria-label="Quality findings"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#fde68a] px-3 py-2">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-[#92400e]">Quality findings</div>
          {filterOn ? (
            <div className="truncate text-[11px] text-[#a16207]" data-testid="sit-quality-active-filter">
              Filter: {filterLabel(activeFlag)}
            </div>
          ) : (
            <div className="text-[11px] text-[#a16207]">No filter · browsing all cases</div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-[6px] border border-[#fcd34d] bg-white px-2 py-1 text-[11.5px] font-medium text-[#92400e]"
            data-testid="sit-quality-show-all"
            onClick={() => onFlag(null)}
          >
            Show all cases
          </button>
          <button type="button" className="text-[12px] text-[#92400e]" data-testid="sit-quality-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2" data-testid="sit-quality-case-list">
        {flagged === 0 ? (
          <p className="text-[12px] text-[#92400e]/80">No quality issues flagged. Suite looks live.</p>
        ) : (
          <>
            <button
              type="button"
              className={`mb-3 w-full rounded-[8px] border px-2 py-1.5 text-left text-[12px] font-medium ${
                activeFlag === "all"
                  ? "border-[#d97706] bg-[#d97706] text-white"
                  : "border-[#fde68a] bg-white text-[#78350f]"
              }`}
              data-testid="sit-quality-filter-all"
              onClick={() => onFlag(activeFlag === "all" ? null : "all")}
            >
              All flagged · {flagged}
            </button>
            {groups.map((g) => (
              <div key={g.flag} className="mb-3">
                <button
                  type="button"
                  className={`mb-1 w-full rounded px-1 py-0.5 text-left text-[12px] font-semibold ${
                    activeFlag === g.flag ? "bg-[#fde68a] text-[#78350f]" : "text-[#92400e]"
                  }`}
                  data-testid={`sit-quality-group-${g.flag}`}
                  onClick={() => onFlag(activeFlag === g.flag ? null : g.flag)}
                >
                  {g.label} · {g.items.length}
                  {activeFlag === g.flag ? " · filter on (click to clear)" : ""}
                </button>
                <ul className="space-y-1">
                  {g.items.map((item, i) => (
                    <li key={`${item.rowId}-${g.flag}-${i}`}>
                      <button
                        type="button"
                        className="w-full rounded-[8px] border border-[#fde68a]/80 bg-white px-2 py-1.5 text-left text-[12px] text-[#78350f] hover:border-[#d97706]"
                        onClick={() => {
                          if (activeFlag !== g.flag) onFlag(g.flag);
                          highlightRow(item.rowId);
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
            ))}
          </>
        )}
      </div>
      <p className="border-t border-[#fde68a] px-3 py-2 text-[11px] text-[#92400e]/70">
        Closing this panel keeps your filter chip visible. Use Show all cases to clear the filter.
      </p>
    </div>
  );
}

export function filterRowsByDeadFlag<T extends { id: string }>(
  rows: T[],
  audit: SitDeadAudit | null,
  flag: QualityFilter,
): T[] {
  if (!flag || !audit) return rows;
  if (flag === "all") {
    return rows.filter((r) =>
      (audit.flagsByRowId[r.id] || []).some((h) => QUALITY_FLAGS.includes(h.flag) || h.flag === "thin_case"),
    );
  }
  if (flag === "needs_review" || flag === "not_assessed") {
    return rows.filter((r) =>
      (audit.flagsByRowId[r.id] || []).some((h) => isNeedsReviewFlag(h.flag)),
    );
  }
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

export { qualityCount, filterLabel };
