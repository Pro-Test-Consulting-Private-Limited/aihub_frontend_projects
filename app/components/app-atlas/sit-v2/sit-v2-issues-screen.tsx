"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeadFlag, DeadFlagHit, SitDeadAudit, SitSheetRow } from "@/app/interfaces/appatlas";
import {
  QUALITY_CHIP_SHORT_LABEL,
  QUALITY_GROUP_LABEL,
  QUALITY_GROUP_ORDER,
  qualityCount,
  qualityIssueCount,
} from "../sit-dead-finder";

const CATEGORY_MEANING: Partial<Record<DeadFlag, string>> = {
  duplicate_case: "Same steps and expected as another case",
  thin_case: "Fewer than 4 steps",
  contradiction: "Preconditions conflict",
  empty_oracle: "Expected result missing or too short",
  orphan_ticket: "Not linked to an acceptance criterion",
};

function suggestedFix(flag: DeadFlag): string {
  switch (flag) {
    case "duplicate_case":
      return "Compare with the peer case and keep one, or differentiate steps.";
    case "thin_case":
      return "Add steps until there are at least 4, naming real UI controls.";
    case "contradiction":
      return "Remove conflicting precondition bullets so the setup is consistent.";
    case "empty_oracle":
      return "Add clear expected result bullets tied to Verify steps.";
    case "orphan_ticket":
      return "Link an acceptance criterion from this ticket.";
    default:
      return "Review and fix the flagged content.";
  }
}

export type IssuesScreenProps = {
  audit: SitDeadAudit | null;
  loading?: boolean;
  rows: SitSheetRow[];
  draftCount: number;
  canEdit: boolean;
  onOpenInCases: (rowId: string) => void;
  onShowInCases: (rowIds: string[]) => void;
  onEditInCases: (rowId: string) => void;
  /** R10-08: map ACn → text for the focused ticket */
  acTexts?: Record<string, string>;
  onLinkAc?: (rowId: string, acId: string) => void;
  /** R10-09 hook */
  onImprove?: (rowIds: string[]) => void;
  improveDisabledReason?: string | null;
};

export function SitV2IssuesScreen({
  audit,
  loading,
  rows,
  draftCount,
  canEdit,
  onOpenInCases,
  onShowInCases,
  onEditInCases,
  acTexts,
  onLinkAc,
  onImprove,
  improveDisabledReason,
}: IssuesScreenProps) {
  const [cardFilter, setCardFilter] = useState<DeadFlag | "needs_review" | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [narrowOverlay, setNarrowOverlay] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      const narrow = window.innerWidth < 1280;
      setNarrowOverlay(narrow);
      // Entering narrow: drop focus so the list is visible until the user picks a row.
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

  const flaggedEntries = useMemo(() => {
    if (!audit) return [];
    const out: { rowId: string; hits: DeadFlagHit[]; row: SitSheetRow }[] = [];
    for (const [rowId, hits] of Object.entries(audit.flagsByRowId || {})) {
      const quality = hits.filter((h) => QUALITY_GROUP_ORDER.includes(h.flag));
      if (!quality.length) continue;
      const row = rowById.get(rowId);
      if (!row || row.cells.deleted === "1") continue;
      out.push({ rowId, hits: quality, row });
    }
    out.sort((a, b) => {
      const ta = a.row.cells.requirementId || "";
      const tb = b.row.cells.requirementId || "";
      if (ta !== tb) return ta.localeCompare(tb);
      return (a.row.cells.caseId || "").localeCompare(b.row.cells.caseId || "");
    });
    return out;
  }, [audit, rowById]);

  const filtered = useMemo(() => {
    let list = flaggedEntries;
    if (cardFilter && cardFilter !== "needs_review") {
      list = list.filter((e) => e.hits.some((h) => h.flag === cardFilter));
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
  }, [flaggedEntries, cardFilter, search]);

  useEffect(() => {
    // Narrow: keep list until the user selects a row (overlay + Back).
    if (narrowOverlay) {
      if (focusId && !filtered.some((e) => e.rowId === focusId)) setFocusId(null);
      return;
    }
    if (!focusId && filtered[0]) setFocusId(filtered[0].rowId);
    else if (focusId && !filtered.some((e) => e.rowId === focusId)) {
      setFocusId(filtered[0]?.rowId ?? null);
    }
  }, [filtered, focusId, narrowOverlay]);

  const flaggedN = qualityCount(audit);
  const issuesN = qualityIssueCount(audit);
  const needsReview = audit?.needsReviewRows ?? audit?.summary?.needs_review ?? 0;
  const focus = filtered.find((e) => e.rowId === focusId) || null;

  const cardCounts = useMemo(() => {
    const c: Partial<Record<DeadFlag, number>> = {};
    for (const flag of QUALITY_GROUP_ORDER) {
      const ids = new Set<string>();
      for (const e of flaggedEntries) {
        if (e.hits.some((h) => h.flag === flag)) ids.add(e.rowId);
      }
      c[flag] = ids.size;
    }
    return c;
  }, [flaggedEntries]);

  const toggleCheck = (id: string) => {
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

  if (loading && !audit) {
    return (
      <div className="p-6 text-[13px] text-[#5b647a]" data-testid="sit-issues-loading">
        Loading issues…
      </div>
    );
  }

  if (!audit || flaggedN === 0) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-6" data-testid="sit-issues-empty">
        <p className="text-[14px] font-medium text-[#374151]">No quality issues found</p>
        {draftCount > 0 ? (
          <p className="text-[12px] text-[#9ca3af]" data-testid="sit-issues-draft-line">
            {draftCount} Draft cases are not checked until they are set to Not run.
          </p>
        ) : null}
      </div>
    );
  }

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
          {focus.hits.map((h, i) => (
            <li
              key={`${h.flag}-${i}`}
              className="rounded-[8px] border border-[#fde68a] bg-[#fffbeb] px-3 py-2"
              data-testid={`sit-issues-reason-${h.flag}`}
            >
              <span className="inline-block rounded-full border border-[#fde68a] bg-white px-2 py-0.5 text-[12px] font-semibold text-[#92400e]">
                {QUALITY_CHIP_SHORT_LABEL[h.flag] || QUALITY_GROUP_LABEL[h.flag] || h.flag}
              </span>
              <p className="mt-1 text-[13px] text-[#78350f]">{h.reason}</p>
              <p className="mt-1 text-[12px] text-[#92400e]">Suggested fix: {suggestedFix(h.flag)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {h.flag === "orphan_ticket" && onLinkAc ? (
                  <button
                    type="button"
                    className="rounded-[6px] border border-[#8664F2] px-2 py-1 text-[12px] font-medium text-[#8664F2]"
                    data-testid="sit-issues-link-ac"
                    onClick={() => setLinkPickerOpen(true)}
                  >
                    Link to AC
                  </button>
                ) : null}
                {h.flag === "duplicate_case" ? (
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
          {flaggedN} cases need attention ({issuesN} issues)
        </div>
        {draftCount > 0 ? (
          <p className="mt-1 text-[12px] text-[#9ca3af]" data-testid="sit-issues-draft-line">
            {draftCount} Draft cases are not checked until they are set to Not run.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2" data-testid="sit-issues-cards">
          {QUALITY_GROUP_ORDER.map((flag) => {
            const n = cardCounts[flag] || 0;
            const active = cardFilter === flag;
            return (
              <button
                key={flag}
                type="button"
                data-testid={`sit-issues-card-${flag}`}
                className={`min-w-[120px] rounded-[10px] border px-3 py-2 text-left ${
                  active ? "border-[#d97706] bg-[#fffbeb]" : "border-[#e2e6ef] bg-white"
                }`}
                onClick={() => setCardFilter(active ? null : flag)}
              >
                <div className="text-[16px] font-semibold text-[#92400e]">{n}</div>
                <div className="text-[12px] font-semibold">{QUALITY_CHIP_SHORT_LABEL[flag]}</div>
                <div className="text-[12px] text-[#6b7280]">{CATEGORY_MEANING[flag]}</div>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="sit-issues-card-needs_review"
            className={`min-w-[120px] rounded-[10px] border px-3 py-2 text-left ${
              cardFilter === "needs_review" ? "border-[#8664F2] bg-[#f3f0ff]" : "border-[#e2e6ef] bg-white"
            }`}
            onClick={() => setCardFilter(cardFilter === "needs_review" ? null : "needs_review")}
          >
            <div className="text-[16px] font-semibold text-[#5b21b6]">{needsReview}</div>
            <div className="text-[12px] font-semibold">Needs review</div>
            <div className="text-[12px] text-[#6b7280]">Priority or severity not assessed</div>
          </button>
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
                const short = e.hits[0] ? QUALITY_CHIP_SHORT_LABEL[e.hits[0].flag] : "";
                const extra = e.hits.length > 1 ? ` +${e.hits.length - 1}` : "";
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
                        onChange={() => toggleCheck(e.rowId)}
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
