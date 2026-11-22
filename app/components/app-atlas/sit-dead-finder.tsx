"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

/** R7-01: headline N = unique flagged cases (not sum of issue groups). Draft never flagged. Needs review excluded. */
function qualityCount(audit: SitDeadAudit | null): number {
  if (!audit) return 0;
  if (typeof audit.flaggedRows === "number") return audit.flaggedRows;
  let n = 0;
  for (const hits of Object.values(audit.flagsByRowId || {})) {
    if ((hits || []).some((h) => QUALITY_FLAGS.includes(h.flag))) n++;
  }
  return n;
}

/** Sum of quality group hits (issues). A multi-flag case contributes once per group. */
function qualityIssueCount(audit: SitDeadAudit | null): number {
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

export function highlightQualityRow(rowId: string) {
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
  if (filter === "all") return "All flagged";
  if (isNeedsReviewFlag(filter)) return "Needs review";
  return QUALITY_GROUP_LABEL[filter] || filter;
}

function uniqueCaseCount(items: { rowId: string }[]): number {
  return new Set(items.map((i) => i.rowId)).size;
}

/** Chip label for active quality / needs-review filter (R7-04). */
export function qualityChipText(filter: QualityFilter, audit: SitDeadAudit | null): string {
  if (!filter) return "";
  if (filter === "all") return `All flagged: ${qualityCount(audit)} cases`;
  if (isNeedsReviewFlag(filter)) {
    const n = audit?.needsReviewRows ?? audit?.summary?.needs_review ?? audit?.summary?.not_assessed ?? 0;
    return `Needs review: ${n} cases`;
  }
  const groups = audit ? groupHits(audit) : [];
  const g = groups.find((x) => x.flag === filter);
  const n = g ? uniqueCaseCount(g.items) : audit?.summary?.[filter] ?? 0;
  return `${QUALITY_GROUP_LABEL[filter] || filter}: ${n} cases`;
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
 * R7-04: Quality button opens a dropdown (no side drawer).
 */
export function DeadTestFinderToolbar({
  audit,
  loading,
  activeFlag,
  onFlag,
}: {
  audit: SitDeadAudit | null;
  loading?: boolean;
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
  /** @deprecated R7-04 ignored */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideOverlayPanel?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const flagged = qualityCount(audit);
  const issues = qualityIssueCount(audit);
  const needsReview = audit?.needsReviewRows ?? audit?.summary?.needs_review ?? audit?.summary?.not_assessed ?? 0;
  const groups = useMemo(() => (audit ? groupHits(audit) : []), [audit]);
  const filterOn =
    activeFlag != null && activeFlag !== "needs_review" && activeFlag !== "not_assessed";

  type Row = { id: string; label: string; count?: number; value: QualityFilter };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [
      { id: "all-cases", label: "All cases", value: null },
      { id: "all-flagged", label: "All flagged", count: flagged, value: "all" },
    ];
    for (const g of groups) {
      out.push({
        id: g.flag,
        label: g.label,
        count: uniqueCaseCount(g.items),
        value: g.flag,
      });
    }
    return out;
  }, [groups, flagged]);

  const placeMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 380) });
  };

  useEffect(() => {
    if (!menuOpen) return;
    placeMenu();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenuOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[focusIdx];
        if (row) {
          onFlag(row.value);
          setMenuOpen(false);
          btnRef.current?.focus();
        }
      }
    };
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
      btnRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", placeMenu);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", placeMenu);
    };
  }, [menuOpen, rows, focusIdx, onFlag]);

  const selectRow = (value: QualityFilter) => {
    onFlag(value);
    setMenuOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {needsReview > 0 && (
        <button
          type="button"
          className={`rounded-[8px] border px-2.5 py-1.5 text-[12.5px] font-medium ${
            activeFlag === "needs_review" || activeFlag === "not_assessed"
              ? "border-[#8664F2] bg-[#f3f0ff] text-[#5b21b6]"
              : "border-[#e2e6ef] bg-white text-[#5b647a]"
          }`}
          title="Priority and Severity not reviewed yet"
          data-testid="sit-needs-review-btn"
          onClick={() =>
            onFlag(activeFlag === "needs_review" || activeFlag === "not_assessed" ? null : "needs_review")
          }
        >
          Needs review {needsReview}
        </button>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setMenuOpen((v) => !v);
          setFocusIdx(0);
        }}
        className={`rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition ${
          filterOn
            ? "border-[#d97706] bg-[#d97706] text-white"
            : flagged > 0
              ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
              : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
        }`}
        title="Quality filters: duplicates, empty expected, unlinked ACs, thin cases, contradictions"
        data-testid="sit-quality-btn"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-pressed={filterOn}
      >
        {loading && !audit ? "Quality…" : `Quality ${flagged}`}
      </button>
      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] flex max-h-[60vh] w-[360px] flex-col overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515]"
            style={{ top: pos.top, left: pos.left }}
            data-testid="sit-quality-dropdown"
            role="listbox"
            aria-label="Quality filter"
          >
            <div
              className="border-b border-[#eef0f5] px-3 py-2 text-[12.5px] font-medium text-[#374151]"
              data-testid="sit-quality-dropdown-header"
            >
              {flagged === 0
                ? "No quality issues found"
                : `${flagged} cases need attention (${issues} issues)`}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {rows.map((row, idx) => {
                const isActive =
                  row.value === null
                    ? activeFlag == null
                    : activeFlag === row.value;
                return (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-testid={
                      row.value === null
                        ? "sit-quality-opt-all-cases"
                        : row.value === "all"
                          ? "sit-quality-filter-all"
                          : `sit-quality-group-${row.value}`
                    }
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] ${
                      idx === focusIdx ? "bg-[#f3f0ff]" : "hover:bg-[#f8fafc]"
                    } ${isActive ? "font-semibold text-[#5b21b6]" : "text-[#1F1F1F]"}`}
                    onMouseEnter={() => setFocusIdx(idx)}
                    onClick={() => selectRow(row.value)}
                  >
                    <span className="w-4 text-center text-[#8664F2]">{isActive ? "✓" : ""}</span>
                    <span className="flex-1">{row.label}</span>
                    {row.count != null ? (
                      <span className="text-[12px] text-[#6b7280]">{row.count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Single active quality / needs-review chip for the filter row (R7-04). */
export function QualityActiveChip({
  audit,
  activeFlag,
  onClear,
}: {
  audit: SitDeadAudit | null;
  activeFlag: QualityFilter;
  onClear: () => void;
}) {
  if (!activeFlag) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2.5 py-0.5 text-[12px] font-medium text-[#92400e]"
      data-testid="sit-quality-filter-chip"
    >
      {qualityChipText(activeFlag, audit)}
      <button
        type="button"
        className="ml-0.5 rounded px-1 hover:bg-[#fde68a]"
        aria-label="Clear quality filter"
        data-testid="sit-quality-filter-chip-clear"
        onClick={onClear}
      >
        ×
      </button>
    </span>
  );
}

/** @deprecated removed in R7-04 */
export function QualityDrawerPanel(_props: {
  audit: SitDeadAudit | null;
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
  onClose: () => void;
}) {
  return null;
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

export { qualityCount, qualityIssueCount, filterLabel };
