/**
 * Round 11: single source of truth for SIT case defect flags and needs-review.
 * Counts and filters must use these helpers; do not re-implement predicates elsewhere.
 */

import type { SitSheetRow } from "@/app/interfaces/appatlas";

/** Defect flags shown in Issues / Flagged filter (plain names). */
export type CaseDefectFlag = "duplicate" | "noExpected" | "noAC" | "thin" | "conflict";

export type CaseFlagHit = { flag: CaseDefectFlag; reason: string };

export type CaseFlags = {
  defects: CaseFlagHit[];
  /** Priority/Severity not assessed by a human (AI triage state). */
  needsReview: boolean;
};

/** Flagged filter values persisted in UI state / URL / localStorage. */
export type FlaggedFilter =
  | null
  | "all"
  | "needs_review"
  | CaseDefectFlag
  /** Legacy DeadFlag ids still accepted and migrated. */
  | "duplicate_case"
  | "empty_oracle"
  | "orphan_ticket"
  | "thin_case"
  | "contradiction"
  | "not_assessed"
  | "generic_expected"
  | "template_case";

export const DEFECT_FLAG_ORDER: CaseDefectFlag[] = [
  "duplicate",
  "noExpected",
  "noAC",
  "thin",
  "conflict",
];

export const DEFECT_FLAG_LABEL: Record<CaseDefectFlag, string> = {
  duplicate: "Duplicate",
  noExpected: "No expected",
  noAC: "No AC",
  thin: "Thin",
  conflict: "Conflict",
};

/** Map new defect ids <-> legacy DeadFlag ids used in older saved views. */
export const DEFECT_TO_DEAD: Record<CaseDefectFlag, string> = {
  duplicate: "duplicate_case",
  noExpected: "empty_oracle",
  noAC: "orphan_ticket",
  thin: "thin_case",
  conflict: "contradiction",
};

export const DEAD_TO_DEFECT: Record<string, CaseDefectFlag> = {
  duplicate_case: "duplicate",
  empty_oracle: "noExpected",
  orphan_ticket: "noAC",
  thin_case: "thin",
  contradiction: "conflict",
};

const EMPTY_MIN = 12;
const DUP_THRESHOLD = 0.85;

function emptyish(s: string | undefined): boolean {
  return (s || "").trim().length < EMPTY_MIN;
}

function stepCount(steps: string): number {
  return (steps || "")
    .split(/\n/)
    .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
    .filter(Boolean).length;
}

function normalizeTokens(text: string): Set<string> {
  const n = (text || "")
    .toLowerCase()
    .replace(/\{\{\s*[^}]+\s*\}\}/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return new Set(n.split(" ").filter((t) => t.length > 1));
}

function jaccard(a: string, b: string): number {
  const A = normalizeTokens(a);
  const B = normalizeTokens(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function classifySessionPhrase(line: string): "signed_in" | "signed_out" | "none" {
  const t = line.toLowerCase();
  if (/not signed in|no active session|not logged|signed out|unauthenticated/.test(t)) return "signed_out";
  if (/^user is signed in|^user is logged in|with a valid session/.test(t) && !/not /.test(t)) {
    return "signed_in";
  }
  return "none";
}

function preconditionStepContradiction(cells: Record<string, string>): string | null {
  const prec = (cells.preconditions || "").toLowerCase();
  const steps = (cells.steps || "").toLowerCase();
  const scenario = (cells.scenario || "").toLowerCase();
  const precLines = (cells.preconditions || "")
    .split(/\n/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  const classes = precLines.map(classifySessionPhrase);
  const signedOut =
    classes.includes("signed_out") ||
    /not signed in|no active session|not logged|signed out|unauthenticated/.test(prec);
  const signedIn = classes.includes("signed_in");
  if (signedOut && /user is on (the )?(profile|dashboard|login)|profile page is open|login screen/.test(prec)) {
    return "signed-out preconditions vs in-app screen start state";
  }
  if (signedOut && /(click|tap).*(profile|dashboard|logout)/.test(steps)) {
    return "signed-out preconditions vs in-app click";
  }
  if (signedOut && /click.*logout/.test(steps) && !/open https?:\/\//.test(steps)) {
    return "logout step while signed out";
  }
  if (signedIn && /unregistered|not registered|invalid (user|account)/.test(`${scenario}\n${steps}`)) {
    return "signed-in start vs unregistered/login test";
  }
  if (/user logs out|user is logged out/.test(prec) && /log\s*out|sign\s*out/.test(`${scenario}\n${steps}`)) {
    return "logout listed as precondition while also a step";
  }
  if (signedOut && signedIn) {
    return "preconditions claim both signed in and signed out";
  }
  return null;
}

function isDraftOrDeleted(cells: Record<string, string>): boolean {
  return (cells.executionStatus || "").trim() === "Draft" || cells.deleted === "1";
}

function isHuman(cells: Record<string, string>): boolean {
  return (cells.origin || "ai").toLowerCase() === "human";
}

function parseAcIds(cells: Record<string, string>): string[] {
  return String(cells.acIds || cells.ac || "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Normalized filter after migrating legacy DeadFlag / quality ids. */
export type NormalizedFlaggedFilter = null | "all" | "needs_review" | CaseDefectFlag;

/**
 * Migrate legacy filter values (Quality / Needs review / DeadFlag ids) to FlaggedFilter.
 * Never returns an unknown value that would empty the grid.
 */
export function migrateFlaggedFilter(raw: unknown): NormalizedFlaggedFilter {
  if (raw == null || raw === "" || raw === false) return null;
  const s = String(raw);
  if (s === "all" || s === "needs_review") return s;
  if (s === "not_assessed" || s === "generic_expected" || s === "template_case") return "needs_review";
  if ((DEFECT_FLAG_ORDER as string[]).includes(s)) return s as CaseDefectFlag;
  if (DEAD_TO_DEFECT[s]) return DEAD_TO_DEFECT[s]!;
  return null;
}

/**
 * Pure per-case flags. Duplicate detection uses allCases (same requirement scope).
 * acList: known AC ids on the active ticket/canvas; when null, AC presence is checked only.
 */
export function getCaseFlags(
  row: SitSheetRow,
  allCases: SitSheetRow[],
  acList: string[] | Set<string> | null = null,
): CaseFlags {
  const cells = row.cells || {};
  if (isDraftOrDeleted(cells)) {
    return { defects: [], needsReview: false };
  }

  const human = isHuman(cells);
  const caseId = cells.caseId || row.id.slice(0, 8);
  const defects: CaseFlagHit[] = [];

  const src = (cells.assessmentSource || "").trim();
  const needsReview = !human && (src === "Not assessed" || !src);

  // Empty expected — human + AI
  if (emptyish(cells.expected)) {
    defects.push({
      flag: "noExpected",
      reason: `${caseId} has no expected result (or it is too short to assert anything).`,
    });
  }

  if (!human) {
    const known = acList
      ? acList instanceof Set
        ? acList
        : new Set(acList)
      : null;
    const req = (cells.requirementId || "").trim();
    if (known && req && !known.has(req)) {
      defects.push({
        flag: "noAC",
        reason: `${caseId} is not linked to an acceptance criterion on the current canvas map (requirement ${req}).`,
      });
    }
    const acIds = parseAcIds(cells);
    if (!acIds.length && !emptyish(cells.expected) && !defects.some((d) => d.flag === "noAC")) {
      defects.push({
        flag: "noAC",
        reason: `${caseId} does not cover any acceptance criterion.`,
      });
    }

    const sc = stepCount(cells.steps || "");
    if (sc > 0 && sc < 4) {
      defects.push({
        flag: "thin",
        reason: `${caseId} has only ${sc} step${sc === 1 ? "" : "s"}. Needs at least 4.`,
      });
    }

    const contra = preconditionStepContradiction(cells);
    if (contra) {
      defects.push({
        flag: "conflict",
        reason: `${caseId}: ${contra}`,
      });
    }
  }

  // Duplicates: same requirement, steps+expected Jaccard >= 0.85 vs an earlier peer
  const req = (cells.requirementId || "").trim();
  const combined = `${cells.steps || ""}\n${cells.expected || ""}`;
  for (const peer of allCases) {
    if (peer.id === row.id) break; // only compare to earlier rows (stable, matches BE)
    if (isDraftOrDeleted(peer.cells || {})) continue;
    const peerReq = (peer.cells.requirementId || "").trim();
    if (req && peerReq && req !== peerReq) continue;
    const peerCombined = `${peer.cells.steps || ""}\n${peer.cells.expected || ""}`;
    const score = jaccard(combined, peerCombined);
    if (score >= DUP_THRESHOLD) {
      const peerId = peer.cells.caseId || peer.id.slice(0, 8);
      defects.push({
        flag: "duplicate",
        reason: `${caseId} is ${Math.round(score * 100)}% similar to ${peerId}: similar steps and expected result`,
      });
      break;
    }
  }

  return { defects, needsReview };
}

export type FlagSummary = {
  flagsByRowId: Record<string, CaseFlags>;
  /** Distinct cases with at least one defect. */
  defectCases: number;
  /** Distinct cases with needsReview. */
  reviewCases: number;
  /** Distinct union of defect + review. */
  attentionCases: number;
  /** Distinct case count per defect category. */
  byDefect: Record<CaseDefectFlag, number>;
};

/** Build flag index + counts over a case list (ticket scope). Search/type filters must not be applied first. */
export function summarizeCaseFlags(
  cases: SitSheetRow[],
  acList: string[] | Set<string> | null = null,
): FlagSummary {
  const active = cases.filter((r) => !isDraftOrDeleted(r.cells || {}));
  const flagsByRowId: Record<string, CaseFlags> = {};
  const byDefect: Record<CaseDefectFlag, number> = {
    duplicate: 0,
    noExpected: 0,
    noAC: 0,
    thin: 0,
    conflict: 0,
  };
  const defectIds = new Set<string>();
  const reviewIds = new Set<string>();

  for (const row of active) {
    const flags = getCaseFlags(row, active, acList);
    flagsByRowId[row.id] = flags;
    if (flags.defects.length) {
      defectIds.add(row.id);
      const seen = new Set<CaseDefectFlag>();
      for (const d of flags.defects) {
        if (seen.has(d.flag)) continue;
        seen.add(d.flag);
        byDefect[d.flag]++;
      }
    }
    if (flags.needsReview) reviewIds.add(row.id);
  }

  const attention = new Set([...defectIds, ...reviewIds]);
  return {
    flagsByRowId,
    defectCases: defectIds.size,
    reviewCases: reviewIds.size,
    attentionCases: attention.size,
    byDefect,
  };
}

export function caseMatchesFlaggedFilter(flags: CaseFlags | undefined, filter: FlaggedFilter): boolean {
  if (!filter) return true;
  const f = migrateFlaggedFilter(filter);
  if (!f) return true;
  if (!flags) return false;
  if (f === "all") return flags.defects.length > 0;
  if (f === "needs_review") return flags.needsReview;
  return flags.defects.some((d) => d.flag === f);
}

export function filterRowsByCaseFlags<T extends SitSheetRow>(
  rows: T[],
  summary: FlagSummary | null,
  filter: FlaggedFilter,
): T[] {
  if (!filter || !summary) return rows;
  return rows.filter((r) => caseMatchesFlaggedFilter(summary.flagsByRowId[r.id], filter));
}

/** Dev/test guard: badge count vs filtered row count must agree when filter is set. */
export function warnFlagCountMismatch(
  filter: FlaggedFilter,
  badgeCount: number,
  filteredCount: number,
  log: (msg: string) => void = console.warn,
): boolean {
  const f = migrateFlaggedFilter(filter);
  if (!f) return false;
  if (badgeCount > 0 && filteredCount === 0) {
    log(
      `[sit-case-flags] count/filter mismatch: filter=${String(f)} badge=${badgeCount} filtered=${filteredCount}`,
    );
    return true;
  }
  return false;
}
