"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DeadFlag, DeadFlagHit, SitDeadAudit } from "@/app/interfaces/appatlas";
import { placePopover } from "./sit-v2/sit-popover-place";
import {
  DEFECT_FLAG_LABEL,
  DEFECT_FLAG_ORDER,
  DEFECT_TO_DEAD,
  migrateFlaggedFilter,
  type CaseDefectFlag,
  type FlagSummary,
  type FlaggedFilter,
} from "@/app/lib/sit-case-flags";

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

/** R10-01: short chip labels for the Scenario cell (long wording stays in QUALITY_GROUP_LABEL / tooltips / Issues). */
export const QUALITY_CHIP_SHORT_LABEL: Partial<Record<DeadFlag, string>> = {
  duplicate_case: "Duplicate",
  empty_oracle: "No expected",
  orphan_ticket: "No AC",
  thin_case: "Thin",
  contradiction: "Conflict",
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

/** Chip label for active Flagged filter (R7-04 / R11-02). */
export function qualityChipText(
  filter: QualityFilter | FlaggedFilter,
  audit: SitDeadAudit | null,
  summary?: FlagSummary | null,
): string {
  const f = migrateFlaggedFilter(filter);
  if (!f) return "";
  if (f === "all") {
    const n = summary?.defectCases ?? qualityCount(audit);
    return `All flagged: ${n} cases`;
  }
  if (f === "needs_review") {
    const n =
      summary?.reviewCases ??
      audit?.needsReviewRows ??
      audit?.summary?.needs_review ??
      audit?.summary?.not_assessed ??
      0;
    return `Needs review: ${n} cases`;
  }
  if (summary) {
    return `${DEFECT_FLAG_LABEL[f]}: ${summary.byDefect[f] ?? 0} cases`;
  }
  const dead = DEFECT_TO_DEAD[f] as DeadFlag;
  const groups = audit ? groupHits(audit) : [];
  const g = groups.find((x) => x.flag === dead);
  const n = g ? uniqueCaseCount(g.items) : audit?.summary?.[dead] ?? 0;
  return `${DEFECT_FLAG_LABEL[f]}: ${n} cases`;
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
 * R11-02: Flagged filter dropdown for the Cases filter row (replaces top-level Quality + Needs review).
 */
export function FlaggedFilterDropdown({
  summary,
  loading,
  activeFlag,
  onFlag,
  draftCount = 0,
  onOpenIssues,
}: {
  summary: FlagSummary | null;
  loading?: boolean;
  activeFlag: FlaggedFilter;
  onFlag: (flag: FlaggedFilter) => void;
  draftCount?: number;
  onOpenIssues?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number }>({
    top: 0,
    left: 0,
    maxHeight: 480,
  });
  const migrated = migrateFlaggedFilter(activeFlag);
  const defectN = summary?.defectCases ?? 0;
  const reviewN = summary?.reviewCases ?? 0;
  const attentionN = summary?.attentionCases ?? 0;
  const filterOn = migrated != null;

  type Row = { id: string; label: string; count?: number; value: FlaggedFilter };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [
      { id: "all-cases", label: "All cases", value: null },
      { id: "all-flagged", label: "All flagged", count: defectN, value: "all" },
    ];
    for (const flag of DEFECT_FLAG_ORDER) {
      const n = summary?.byDefect[flag] ?? 0;
      if (!n && migrated !== flag) continue;
      out.push({ id: flag, label: DEFECT_FLAG_LABEL[flag], count: n, value: flag });
    }
    if (reviewN > 0 || migrated === "needs_review") {
      out.push({ id: "needs_review", label: "Needs review", count: reviewN, value: "needs_review" });
    }
    return out;
  }, [summary, defectN, reviewN, migrated]);

  const placeMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const placed = placePopover({
      trigger: r,
      popWidth: 360,
      popHeight: Math.min(window.innerHeight * 0.6, 520),
    });
    setPos({ top: placed.top, left: placed.left, maxHeight: placed.maxHeight });
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

  // R11-02 / R10-03: mousedown+preventDefault so document mousedown cannot close before option registers.
  const selectRow = (value: FlaggedFilter) => {
    onFlag(migrateFlaggedFilter(value));
    setMenuOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className="relative flex flex-wrap items-center gap-2">
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
            : attentionN > 0
              ? "border-[#fcd34d] bg-[#fffbeb] text-[#92400e]"
              : "border-[#e2e6ef] text-[#5b647a] dark:border-[#2a2a2a]"
        }`}
        title="Flagged filters: defects and needs-review triage"
        data-testid="sit-flagged-btn"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-pressed={filterOn}
      >
        {/* Nested legacy testid so waitFor(sit-quality-btn) still finds a visible control */}
        <span data-testid="sit-quality-btn">{loading && !summary ? "Flagged…" : `Flagged ${attentionN}`}</span>
      </button>
      {menuOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[80] flex w-[360px] flex-col overflow-hidden rounded-[10px] border border-[#e2e6ef] bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#151515]"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
            data-testid="sit-flagged-dropdown"
            role="listbox"
            aria-label="Flagged filter"
          >
            <div
              className="border-b border-[#eef0f5] px-3 py-2 text-[12.5px] font-medium text-[#374151]"
              data-testid="sit-flagged-dropdown-header"
            >
              {attentionN === 0
                ? "No flagged cases"
                : `${attentionN} cases need attention: ${defectN} with defects, ${reviewN} awaiting review`}
              {draftCount > 0 ? (
                <div className="mt-1 text-[12px] font-normal text-[#9ca3af]" data-testid="sit-quality-draft-line">
                  {draftCount} Draft cases are not checked until they are set to Not run.
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {rows.map((row, idx) => {
                const isActive =
                  row.value === null ? migrated == null : migrated === migrateFlaggedFilter(row.value);
                const deadAlias =
                  row.value && row.value !== "all" && row.value !== "needs_review"
                    ? DEFECT_TO_DEAD[row.value as CaseDefectFlag]
                    : null;
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
                          : row.value === "needs_review"
                            ? "sit-flagged-opt-needs_review"
                            : `sit-quality-group-${deadAlias || row.value}`
                    }
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] ${
                      idx === focusIdx ? "bg-[#f3f0ff]" : "hover:bg-[#f8fafc]"
                    } ${isActive ? "font-semibold text-[#5b21b6]" : "text-[#1F1F1F]"}`}
                    onMouseEnter={() => setFocusIdx(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectRow(row.value);
                    }}
                  >
                    <span className="w-4 text-center text-[#8664F2]">{isActive ? "✓" : ""}</span>
                    <span className="flex-1">{row.label}</span>
                    {row.count != null ? <span className="text-[12px] text-[#6b7280]">{row.count}</span> : null}
                  </button>
                );
              })}
            </div>
            {onOpenIssues ? (
              <div className="border-t border-[#eef0f5] px-3 py-2">
                <button
                  type="button"
                  className="w-full text-left text-[13px] font-medium text-[#8664F2]"
                  data-testid="sit-quality-open-issues"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onOpenIssues();
                  }}
                >
                  Open Issues screen
                </button>
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** @deprecated R11-02: use FlaggedFilterDropdown in Cases row. */
export function DeadTestFinderToolbar(props: {
  audit: SitDeadAudit | null;
  loading?: boolean;
  activeFlag: QualityFilter;
  onFlag: (flag: QualityFilter) => void;
  draftCount?: number;
  onOpenIssues?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideOverlayPanel?: boolean;
  summary?: FlagSummary | null;
}) {
  const summary =
    props.summary ||
    ({
      flagsByRowId: {},
      defectCases: qualityCount(props.audit),
      reviewCases: props.audit?.needsReviewRows ?? props.audit?.summary?.needs_review ?? 0,
      attentionCases:
        (qualityCount(props.audit) || 0) +
        (props.audit?.needsReviewRows ?? props.audit?.summary?.needs_review ?? 0),
      byDefect: { duplicate: 0, noExpected: 0, noAC: 0, thin: 0, conflict: 0 },
    } satisfies FlagSummary);
  return (
    <FlaggedFilterDropdown
      summary={summary}
      loading={props.loading}
      activeFlag={migrateFlaggedFilter(props.activeFlag)}
      onFlag={(f) => props.onFlag(f as QualityFilter)}
      draftCount={props.draftCount}
      onOpenIssues={props.onOpenIssues}
    />
  );
}

/** Single active Flagged filter chip for the Cases filter row (R7-04 / R11-02). */
export function QualityActiveChip({
  audit,
  activeFlag,
  onClear,
  summary = null,
}: {
  audit: SitDeadAudit | null;
  activeFlag: QualityFilter | FlaggedFilter;
  onClear: () => void;
  summary?: FlagSummary | null;
}) {
  if (!migrateFlaggedFilter(activeFlag)) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fffbeb] px-2.5 py-0.5 text-[12px] font-medium text-[#92400e]"
      data-testid="sit-quality-filter-chip"
    >
      {qualityChipText(activeFlag, audit, summary)}
      <button
        type="button"
        className="ml-0.5 rounded px-1 hover:bg-[#fde68a]"
        aria-label="Clear flagged filter"
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

export function filterRowsByDeadFlag<T extends { id: string; cells?: Record<string, string> }>(
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
    // R11-03: BE audit increments needsReviewRows but does not push needs_review into
    // flagsByRowId. Prefer audit hits when present; otherwise fall back to cells.
    return rows.filter((r) => {
      const hits = audit.flagsByRowId[r.id] || [];
      if (hits.some((h) => isNeedsReviewFlag(h.flag))) return true;
      const cells = r.cells;
      if (!cells) return false;
      if ((cells.executionStatus || "").trim() === "Draft" || cells.deleted === "1") return false;
      if ((cells.origin || "ai").toLowerCase() === "human") return false;
      const src = (cells.assessmentSource || "").trim();
      return src === "Not assessed" || !src;
    });
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
