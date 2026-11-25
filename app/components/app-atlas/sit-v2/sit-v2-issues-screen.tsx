"use client";

import { useEffect, useMemo, useState } from "react";
import type { SitDeadAudit, SitSheetRow } from "@/app/interfaces/appatlas";
import {
  DEFECT_FLAG_LABEL,
  DEFECT_FLAG_ORDER,
  DEFECT_TO_DEAD,
  type CaseDefectFlag,
  type FlagSummary,
  type FlaggedFilter,
} from "@/app/lib/sit-case-flags";

const CATEGORY_MEANING: Record<CaseDefectFlag, string> = {
  duplicate: "Same steps and expected as another case",
  thin: "Fewer than 4 steps",
  conflict: "Preconditions conflict",
  noExpected: "Expected result missing or too short",
  noAC: "Not linked to an acceptance criterion",
};

function suggestedFix(flag: CaseDefectFlag): string {
  switch (flag) {
    case "duplicate":
      return "Compare with the peer case and keep one, or differentiate steps.";
    case "thin":
      return "Add steps until there are at least 4, naming real UI controls.";
    case "conflict":
      return "Remove conflicting precondition bullets so the setup is consistent.";
    case "noExpected":
      return "Add clear expected result bullets tied to Verify steps.";
    case "noAC":
      return "Link an acceptance criterion from this ticket.";
    default:
      return "Review and fix the flagged content.";
  }
}

export type IssuesScreenProps = {
  audit: SitDeadAudit | null;
  flagSummary: FlagSummary;
  loading?: boolean;
  rows: SitSheetRow[];
  draftCount: number;
  canEdit: boolean;
  onOpenInCases: (rowId: string) => void;
  onShowInCases: (rowIds: string[], filter?: FlaggedFilter) => void;
  onEditInCases: (rowId: string) => void;
  onApplyFlaggedFilter?: (filter: FlaggedFilter) => void;
  /** R10-08: map ACn → text for the focused ticket */
  acTexts?: Record<string, string>;
  onLinkAc?: (rowId: string, acId: string) => void;
  /** R10-09 hook — live path disabled in R11 */
  onImprove?: (rowIds: string[]) => void;
  improveDisabledReason?: string | null;
};

type CardFilter = CaseDefectFlag | "needs_review" | null;

export function SitV2IssuesScreen({
  flagSummary,
  loading,
  rows,
  draftCount,
  canEdit,
  onOpenInCases,
  onShowInCases,
  onEditInCases,
  onApplyFlaggedFilter,
  acTexts,
  onLinkAc,
  onImprove,
  improveDisabledReason,
}: IssuesScreenProps) {
  const [cardFilter, setCardFilter] = useState<CardFilter>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [narrowOverlay, setNarrowOverlay] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < 1280;
      setNarrowOverlay(narrow);
      if (narrow) setFocusId(null);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const rowById = useMemo(() => {
    const m = new Map<string, SitSheetRow>();
    for (const r of rows) m.set(r.id, r);
    return m;
  }, [rows]);

  const attentionEntries = useMemo(() => {
    const out: {
      rowId: string;
      defects: { flag: CaseDefectFlag; reason: string }[];
      needsReview: boolean;
      row: SitSheetRow;
    }[] = [];
    for (const [rowId, flags] of Object.entries(flagSummary.flagsByRowId || {})) {
      if (!flags.defects.length && !flags.needsReview) continue;
      const row = rowById.get(rowId);
      if (!row || row.cells.deleted === "1") continue;
      out.push({
        rowId,
        defects: flags.defects,
        needsReview: flags.needsReview,
        row,
      });
    }
    out.sort((a, b) => {
      const ta = a.row.cells.requirementId || "";
      const tb = b.row.cells.requirementId || "";
      if (ta !== tb) return ta.localeCompare(tb);
      return (a.row.cells.caseId || "").localeCompare(b.row.cells.caseId || "");
    });
    return out;
  }, [flagSummary, rowById]);

  const filtered = useMemo(() => {
    let list = attentionEntries;
    if (cardFilter === "needs_review") {
      list = list.filter((e) => e.needsReview);
    } else if (cardFilter) {
      list = list.filter((e) => e.defects.some((h) => h.flag === cardFilter));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          (e.row.cells.caseId || "").toLowerCase().includes(q) ||
          (e.row.cells.scenario || "").toLowerCase().includes(q) ||
          (e.row.cells.requirementId || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [attentionEntries, cardFilter, search]);

  useEffect(() => {
    if (narrowOverlay) {
      if (focusId && !filtered.some((e) => e.rowId === focusId)) setFocusId(null);
      return;
    }
    if (!focusId && filtered[0]) setFocusId(filtered[0].rowId);
    else if (focusId && !filtered.some((e) => e.rowId === focusId)) {
      setFocusId(filtered[0]?.rowId ?? null);
    }
  }, [filtered, focusId, narrowOverlay]);

  const attentionN = flagSummary.attentionCases;
  const defectN = flagSummary.defectCases;
  const reviewN = flagSummary.reviewCases;
  const focus = filtered.find((e) => e.rowId === focusId) || null;

  const toggleCheck = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    e?.stopPropagation?.();
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const onKeyList = (e: React.KeyboardEvent) => {
    const idx = filtered.findIndex((x) => x.rowId === focusId);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = filtered[Math.min(filtered.length - 1, Math.max(0, idx + 1))];
      if (next) setFocusId(next.rowId);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = filtered[Math.max(0, idx - 1)];
      if (next) setFocusId(next.rowId);
    } else if (e.key === " " && focusId) {
      e.preventDefault();
      toggleCheck(focusId);
    } else if (e.key === "Enter" && focusId) {
      e.preventDefault();
      onOpenInCases(focusId);
    } else if (e.key === "Escape") {
      setChecked(new Set());
    }
  };

  if (loading && attentionN === 0 && Object.keys(flagSummary.flagsByRowId).length === 0) {
    return (
      <div className="p-6 text-[13px] text-[#5b647a]" data-testid="sit-issues-loading">
        Loading issues…
      </div>
    );
  }

  if (attentionN === 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-6" data-testid="sit-issues-empty">
        <p className="text-[14px] font-medium text-[#374151]">No cases need attention</p>
        {draftCount > 0 ? (
          <p className="text-[12px] text-[#9ca3af]" data-testid="sit-issues-draft-line">
            {draftCount} Draft cases are not checked until they are set to Not run.
          </p>
        ) : null}
      </div>
    );
  }

  const showInCasesForCard = (filter: FlaggedFilter, count: number) => {
    const ids = attentionEntries
      .filter((e) => {
        if (filter === "needs_review") return e.needsReview;
        if (filter === "all") return e.defects.length > 0;
        return e.defects.some((d) => d.flag === filter);
      })
      .map((e) => e.rowId);
    if (ids.length !== count && process.env.NODE_ENV !== "production") {
      console.warn(`[sit-issues] Show in Cases count mismatch filter=${String(filter)} card=${count} ids=${ids.length}`);
    }
    onApplyFlaggedFilter?.(filter);
    onShowInCases(ids, filter);
  };

  const detail = focus ? (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4" data-testid="sit-issues-detail">
      {narrowOverlay ? (
        <button
          type="button"
          className="self-start text-[13px] font-medium text-[#8664F2]"
          data-testid="sit-issues-back"
          onClick={() => setFocusId(null)}
        >
          Back
        </button>
      ) : null}
      <div>
        <div className="font-mono text-[13px] font-semibold">{focus.row.cells.caseId}</div>
        <div className="text-[14px] font-medium">{focus.row.cells.scenario}</div>
        <div className="mt-1 text-[12px] text-[#6b7280]">
          {(focus.row.cells.origin || "ai").toUpperCase()} · {focus.row.cells.requirementId}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold text-[#5b647a]">Why this is flagged</div>
        <ul className="m-0 space-y-3 p-0">
          {focus.defects.map((h, i) => (
            <li
              key={`${h.flag}-${i}`}
              className="rounded-[8px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2"
              data-testid={`sit-issues-reason-${DEFECT_TO_DEAD[h.flag]}`}
            >
              <span className="inline-block rounded-full border border-[#fde68a] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#92400e]">
                {DEFECT_FLAG_LABEL[h.flag]}
              </span>
              <p className="mt-1 text-[13px] text-[#78350f]">{h.reason}</p>
              <p className="mt-1 text-[12px] text-[#92400e]">Suggested fix: {suggestedFix(h.flag)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {h.flag === "noAC" && onLinkAc ? (
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#8664F2] px-2 py-1 text-[12px] font-medium text-[#8664F2]"
                    data-testid="sit-issues-link-ac"
                    onClick={() => setLinkPickerOpen(true)}
                  >
                    Link to AC
                  </button>
                ) : null}
                {h.flag === "duplicate" ? (
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#e2e6ef] px-2 py-1 text-[12px]"
                    data-testid="sit-issues-compare"
                    onClick={() => onOpenInCases(focus.rowId)}
                  >
                    Compare
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-[6px] border border-[#e2e6ef] px-2 py-1 text-[12px] disabled:opacity-50"
                  data-testid="sit-issues-improve"
                  disabled={!!improveDisabledReason || !onImprove}
                  title={improveDisabledReason || "Improve with AI"}
                  onClick={() => onImprove?.([focus.rowId])}
                >
                  Improve with AI
                </button>
              </div>
            </li>
          ))}
          {focus.needsReview ? (
            <li
              className="rounded-[8px] border border-[#ddd6fe] bg-[#f5f3ff] px-3 py-2"
              data-testid="sit-issues-reason-needs_review"
            >
              <span className="inline-block rounded-full border border-[#ddd6fe] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#5b21b6]">
                Needs review
              </span>
              <p className="mt-1 text-[13px] text-[#5b21b6]">
                Priority or severity has not been assessed by a human yet.
              </p>
              <p className="mt-1 text-[12px] text-[#6b7280]">Suggested fix: Review Priority and Severity, then mark assessed.</p>
            </li>
          ) : null}
        </ul>
      </div>
      <div data-testid="sit-issues-preview">
        <div className="mb-1 text-[12px] font-semibold text-[#5b647a]">Case preview</div>
        <div className="rounded-[8px] border border-[#eef0f5] bg-white p-2 text-[12px]">
          <div className="font-semibold text-[#6b7280]">Preconditions</div>
          <pre className="whitespace-pre-wrap font-[inherit]">{focus.row.cells.preconditions || "(none)"}</pre>
          <div className="mt-2 font-semibold text-[#6b7280]">Steps</div>
          <pre className="whitespace-pre-wrap font-[inherit]">{focus.row.cells.steps || "(none)"}</pre>
          <div className="mt-2 font-semibold text-[#6b7280]">Expected</div>
          <pre className="whitespace-pre-wrap font-[inherit]">{focus.row.cells.expected || "(none)"}</pre>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-[8px] bg-[#8664F2] px-3 py-1.5 text-[13px] font-medium text-white"
          data-testid="sit-issues-open-cases"
          onClick={() => onOpenInCases(focus.rowId)}
        >
          Open in Cases
        </button>
        <button
          type="button"
          className="rounded-[8px] border border-[#e2e6ef] px-3 py-1.5 text-[13px]"
          data-testid="sit-issues-edit-cases"
          disabled={!canEdit}
          onClick={() => onEditInCases(focus.rowId)}
        >
          Edit in Cases
        </button>
      </div>
      {linkPickerOpen ? (
        <div
          className="rounded-[8px] border border-[#ddd6fe] bg-[#f5f3ff] p-3"
          data-testid="sit-issues-link-ac-picker"
        >
          <div className="mb-2 text-[13px] font-semibold text-[#5b21b6]">Link to AC</div>
          {acTexts && Object.keys(acTexts).length ? (
            <ul className="m-0 space-y-1 p-0">
              {Object.entries(acTexts).map(([id, text]) => (
                <li key={id}>
                  <button
                    type="button"
                    className="w-full rounded-[6px] border border-[#e2e6ef] bg-white px-2 py-1.5 text-left text-[13px] hover:border-[#8664F2]"
                    data-testid={`sit-issues-link-ac-opt-${id}`}
                    onClick={() => {
                      onLinkAc?.(focus.rowId, id);
                      setLinkPickerOpen(false);
                    }}
                  >
                    <span className="font-mono font-semibold">{id}</span>
                    {text ? (
                      <span className="text-[#374151]">: {text}</span>
                    ) : (
                      <span className="text-[#9ca3af]"> (AC text not available)</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[#6b7280]">
              No acceptance criteria text on this ticket. Link by id only is unavailable until ACs exist.
            </p>
          )}
          <button
            type="button"
            className="mt-2 text-[12px] text-[#6b7280]"
            onClick={() => setLinkPickerOpen(false)}
          >
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="p-6 text-[13px] text-[#9ca3af]">Select a case</div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="sit-issues-screen" onKeyDown={onKeyList}>
      <div className="border-b border-[#eef0f5] px-4 py-3">
        <div className="text-[14px] font-semibold text-[#1F1F1F]" data-testid="sit-issues-headline">
          {attentionN} cases need attention: {defectN} with defects, {reviewN} awaiting review
        </div>
        {draftCount > 0 ? (
          <p className="mt-1 text-[12px] text-[#9ca3af]" data-testid="sit-issues-draft-line">
            {draftCount} Draft cases are not checked until they are set to Not run.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2" data-testid="sit-issues-cards">
          {DEFECT_FLAG_ORDER.map((flag) => {
            const n = flagSummary.byDefect[flag] || 0;
            const active = cardFilter === flag;
            const dead = DEFECT_TO_DEAD[flag];
            return (
              <div
                key={flag}
                data-testid={`sit-issues-card-${dead}`}
                className={`min-w-[120px] rounded-[10px] border px-3 py-2 text-left ${
                  active ? "border-[#d97706] bg-[#fffbeb]" : "border-[#e2e6ef] bg-white"
                }`}
              >
                <button type="button" className="w-full text-left" onClick={() => setCardFilter(active ? null : flag)}>
                  <div className="text-[16px] font-semibold text-[#92400e]">{n}</div>
                  <div className="text-[12px] font-semibold">{DEFECT_FLAG_LABEL[flag]}</div>
                  <div className="text-[12px] text-[#6b7280]">{CATEGORY_MEANING[flag]}</div>
                  <div className="mt-1 text-[11px] text-[#9ca3af]">{n} cases</div>
                </button>
                {n > 0 ? (
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-medium text-[#8664F2]"
                    data-testid={`sit-issues-show-in-cases-${dead}`}
                    onClick={() => showInCasesForCard(flag, n)}
                  >
                    Show in Cases
                  </button>
                ) : null}
              </div>
            );
          })}
          <div
            data-testid="sit-issues-card-needs_review"
            className={`min-w-[120px] rounded-[10px] border px-3 py-2 text-left ${
              cardFilter === "needs_review" ? "border-[#8664F2] bg-[#f3f0ff]" : "border-[#e2e6ef] bg-white"
            }`}
          >
            <button
              type="button"
              className="w-full text-left"
              onClick={() => setCardFilter(cardFilter === "needs_review" ? null : "needs_review")}
            >
              <div className="text-[16px] font-semibold text-[#5b21b6]">{reviewN}</div>
              <div className="text-[12px] font-semibold">Needs review</div>
              <div className="text-[12px] text-[#6b7280]">Priority or severity not assessed</div>
              <div className="mt-1 text-[11px] text-[#9ca3af]">{reviewN} cases</div>
            </button>
            {reviewN > 0 ? (
              <button
                type="button"
                className="mt-2 text-[12px] font-medium text-[#8664F2]"
                data-testid="sit-issues-show-in-cases-needs_review"
                onClick={() => showInCasesForCard("needs_review", reviewN)}
              >
                Show in Cases
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {checked.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-[#eef0f5] bg-[#f8fafc] px-4 py-2 text-[13px]"
          data-testid="sit-issues-selection-bar"
        >
          <span>{checked.size} selected:</span>
          <button
            type="button"
            className="font-medium text-[#8664F2]"
            data-testid="sit-issues-show-in-cases"
            onClick={() => onShowInCases([...checked])}
          >
            Show in Cases
          </button>
          <button
            type="button"
            className="font-medium text-[#8664F2] disabled:opacity-50"
            data-testid="sit-issues-bulk-improve"
            disabled={!!improveDisabledReason || !onImprove}
            title={improveDisabledReason || undefined}
            onClick={() => onImprove?.([...checked].slice(0, 5))}
          >
            Improve with AI
          </button>
          <button
            type="button"
            className="text-[#6b7280]"
            data-testid="sit-issues-clear-selection"
            onClick={() => setChecked(new Set())}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className={`flex min-h-0 flex-1 ${narrowOverlay ? "flex-col" : "flex-row"}`}>
        {!(narrowOverlay && focusId) ? (
          <div
            className={`${narrowOverlay ? "w-full" : "w-[42%]"} flex min-h-0 flex-col border-r border-[#eef0f5]`}
            data-testid="sit-issues-list"
          >
            <div className="flex gap-2 border-b border-[#eef0f5] px-3 py-2">
              <input
                className="flex-1 rounded-[8px] border border-[#e2e6ef] px-2 py-1 text-[13px]"
                placeholder="Search cases"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="sit-issues-search"
              />
            </div>
            <ul className="m-0 min-h-0 flex-1 list-none overflow-auto p-0" tabIndex={0}>
              {filtered.map((e) => {
                const active = e.rowId === focusId;
                const short = e.defects[0] ? DEFECT_FLAG_LABEL[e.defects[0].flag] : e.needsReview ? "Needs review" : "";
                const extra = e.defects.length > 1 ? ` +${e.defects.length - 1}` : "";
                return (
                  <li key={e.rowId}>
                    <div
                      className={`flex cursor-pointer items-start gap-2 border-b border-[#f3f4f6] px-3 py-2 ${
                        active ? "bg-[#f3f0ff] ring-2 ring-inset ring-[#8664F2]" : "hover:bg-[#fafafa]"
                      }`}
                      data-testid={`sit-issues-row-${e.row.cells.caseId}`}
                      onClick={() => setFocusId(e.rowId)}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 accent-[#8664F2]"
                        checked={checked.has(e.rowId)}
                        onChange={(ev) => toggleCheck(e.rowId, ev)}
                        onClick={(ev) => ev.stopPropagation()}
                        aria-label={`Select ${e.row.cells.caseId}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12px] font-semibold">{e.row.cells.caseId}</div>
                        <div className="truncate text-[13px]">{e.row.cells.scenario}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="rounded bg-[#ede9fe] px-1.5 py-0.5 text-[12px] text-[#5b21b6]">
                            {e.row.cells.requirementId}
                          </span>
                          <span className="rounded-full border border-[#fde68a] bg-[#fffbeb] px-1.5 py-0.5 text-[12px] text-[#92400e]">
                            {short}
                            {extra}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {(!narrowOverlay || focusId) && (
          <div className={`${narrowOverlay ? "w-full" : "w-[58%]"} min-h-0`}>{detail}</div>
        )}
      </div>
    </div>
  );
}
