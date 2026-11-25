/** Deterministic Eisenhower triage  -  mirrors backend/src/sit-eisenhower.ts */

export type EisenhowerQ = "Q1" | "Q2" | "Q3" | "Q4" | "Untriaged";

export const EXECUTION_STATUSES = ["Draft", "Passed", "Failed", "Blocked", "Skipped", "Stale"] as const;
export type SitExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const EISENHOWER_LABEL: Record<Exclude<EisenhowerQ, "Untriaged">, string> = {
  Q1: "Do first",
  Q2: "Schedule",
  Q3: "Delegate",
  Q4: "Later / drop",
};

/** What each quadrant means for a tester / release window. */
export const EISENHOWER_MEANING: Record<Exclude<EisenhowerQ, "Untriaged">, string> = {
  Q1: "Urgent and important  -  run or fix before ship",
  Q2: "Important but not urgent  -  plan for next sprint",
  Q3: "Urgent but low impact  -  automate or handle after core",
  Q4: "Neither urgent nor important  -  defer or drop (noise)",
};

export const EISENHOWER_AXES: Record<Exclude<EisenhowerQ, "Untriaged">, string> = {
  Q1: "Important · Urgent",
  Q2: "Important · Not urgent",
  Q3: "Not important · Urgent",
  Q4: "Not important · Not urgent",
};

export const EISENHOWER_CHIP: Record<EisenhowerQ, string> = {
  Q1: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
  Q2: "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]",
  Q3: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
  Q4: "border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]",
  Untriaged: "border-[#E5E7EB] bg-white text-[#9CA3AF]",
};

export function deriveEisenhower(cells: {
  priority?: string;
  severity?: string;
  testType?: string;
  eisenhowerOverride?: string;
}): { q: EisenhowerQ; urgent: boolean; important: boolean; source: "override" | "derived" | "untriaged"; why: string[] } {
  const override = (cells.eisenhowerOverride || "").trim().toUpperCase();
  if (override === "Q1" || override === "Q2" || override === "Q3" || override === "Q4") {
    return {
      q: override,
      urgent: override === "Q1" || override === "Q3",
      important: override === "Q1" || override === "Q2",
      source: "override",
      why: ["Human override"],
    };
  }

  const priority = (cells.priority || "").trim();
  const severity = (cells.severity || "").trim();
  const testType = (cells.testType || "").trim();
  if (!priority && !severity) {
    return { q: "Untriaged", urgent: false, important: false, source: "untriaged", why: ["Not assessed"] };
  }

  const why: string[] = [];
  let important = severity === "High" || severity === "Medium";
  if (severity === "High") why.push("High severity → important");
  else if (severity === "Medium") why.push("Medium severity → important");
  else if (severity === "Low") why.push("Low severity → not important");

  if (/Business Rule|Security|Concurrency/i.test(testType) && !important) {
    important = true;
    why.push(`${testType} type bumps importance`);
  }

  const urgent = priority === "High";
  if (priority === "High") why.push("High priority → urgent");
  else if (priority) why.push(`${priority} priority → not urgent`);

  const q: EisenhowerQ = important && urgent ? "Q1" : important && !urgent ? "Q2" : !important && urgent ? "Q3" : "Q4";
  return { q, urgent, important, source: "derived", why };
}

/** Dominant quadrant for a ticket rollup (highest count among Q1-Q4). */
export function dominantQuadrant(byQuadrant: Record<string, number> | undefined): EisenhowerQ {
  const qs: Exclude<EisenhowerQ, "Untriaged">[] = ["Q1", "Q2", "Q3", "Q4"];
  let best: EisenhowerQ = "Untriaged";
  let n = 0;
  for (const q of qs) {
    const c = byQuadrant?.[q] || 0;
    if (c > n) {
      n = c;
      best = q;
    }
  }
  if (!n && (byQuadrant?.Untriaged || 0) > 0) return "Untriaged";
  return best;
}

const prioCount = (p: Record<string, number> | undefined, keys: string[]) =>
  keys.reduce((n, k) => n + (p?.[k] || 0), 0);

/**
 * Prefer API byQuadrant. If Q1–Q4 are empty but Priority/Severity were assessed,
 * synthesize a triage grid so Matrix mode still shows counts (never a fake all-zero board).
 */
export function resolveQuadrants(opts: {
  byQuadrant?: Record<string, number>;
  byPriority?: Record<string, number>;
  bySeverity?: Record<string, number>;
  notAssessed?: number;
  tests: number;
}): Record<string, number> {
  const q = { ...(opts.byQuadrant || {}) };
  const qTriaged = (q.Q1 || 0) + (q.Q2 || 0) + (q.Q3 || 0) + (q.Q4 || 0);
  if (qTriaged > 0) return q;

  const p = opts.byPriority || {};
  const s = opts.bySeverity || {};
  let highP = prioCount(p, ["High", "Highest", "Critical"]);
  let medP = prioCount(p, ["Medium", "Normal"]);
  let lowP = prioCount(p, ["Low", "Lowest"]);
  const assessedP = highP + medP + lowP;
  if (!assessedP) {
    const u = q.Untriaged || opts.notAssessed || (opts.tests > 0 ? opts.tests : 0);
    return u ? { Untriaged: u } : {};
  }

  let highS = prioCount(s, ["High", "Highest", "Critical"]);
  let medS = prioCount(s, ["Medium", "Normal"]);
  let lowS = prioCount(s, ["Low", "Lowest"]);
  if (highS + medS + lowS === 0) {
    // Severity not rolled up separately — mirror priority so High stays "important".
    highS = highP;
    medS = medP;
    lowS = lowP;
  }

  let important = highS + medS;
  let Q1 = Math.min(highP, important);
  highP -= Q1;
  important -= Q1;
  const Q3 = highP;
  const notUrgent = medP + lowP;
  const Q2 = Math.min(notUrgent, important);
  const Q4 = Math.max(0, notUrgent - Q2);
  const untriaged = opts.notAssessed || q.Untriaged || 0;
  return { Q1, Q2, Q3, Q4, ...(untriaged ? { Untriaged: untriaged } : {}) };
}
