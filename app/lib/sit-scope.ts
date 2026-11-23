/**
 * Round 12/14: working-set scope helpers.
 * Round 14: every displayed count comes from buildScopeSummary over a rows array.
 * No separate liveCounts cache.
 */

import type { SitSheetRow, SitTicket, SitWorkbook } from "@/app/interfaces/appatlas";
import { getCaseProvenance } from "@/app/lib/sit-case-provenance";

/** Natural ticket key order: DW-7 before DW-10 before DW-11 (numeric segment aware). */
export function compareTicketKeys(a: string, b: string): number {
  const ra = a.match(/^([A-Za-z]+)-?(\d+)$/);
  const rb = b.match(/^([A-Za-z]+)-?(\d+)$/);
  if (ra && rb && ra[1]!.toLowerCase() === rb[1]!.toLowerCase()) {
    const na = Number(ra[2]);
    const nb = Number(rb[2]);
    if (na !== nb) return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortTicketKeys(keys: string[]): string[] {
  return [...keys].sort(compareTicketKeys);
}

/** Working set keys: selected tickets union keys that already have cases (workbook keys). */
export function workingSetKeys(selectedKeys: string[], workbookKeys: string[] = []): string[] {
  return sortTicketKeys(Array.from(new Set([...selectedKeys, ...workbookKeys].map(normalizeTicketKey).filter(Boolean))));
}

/** Trim + uppercase. Empty string if missing. */
export function normalizeTicketKey(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase();
}

/**
 * Single ticket key for a row: trimmed uppercase requirementId, else issueKey.
 * Used by pills, merge, filters, export, flags, provenance grouping.
 */
export function ticketKeyOf(row: { cells?: Record<string, string | undefined> } | null | undefined): string {
  const cells = row?.cells || {};
  const req = normalizeTicketKey(cells.requirementId);
  if (req) return req;
  return normalizeTicketKey(cells.issueKey);
}

export function liveRows(rows: SitSheetRow[]): SitSheetRow[] {
  return rows.filter((r) => r.cells.deleted !== "1");
}

export function rowsForTicket(rows: SitSheetRow[], ticketKey: string): SitSheetRow[] {
  const want = normalizeTicketKey(ticketKey);
  return liveRows(rows).filter((r) => ticketKeyOf(r) === want);
}

/** @deprecated Prefer buildScopeSummary. Kept as thin wrapper for older call sites. */
export function liveCaseCount(rows: SitSheetRow[], ticketKey?: string): number {
  if (ticketKey) return rowsForTicket(rows, ticketKey).length;
  return liveRows(rows).length;
}

export type ScopeStatusCounts = {
  Draft: number;
  "Not run": number;
  Passed: number;
  Failed: number;
  Partial: number;
  Blocked: number;
  Skipped: number;
  Stale: number;
};

export type ScopeSummary = {
  /** Non-deleted rows in the input array. */
  total: number;
  /** Counts for each working-set key (0 if none). */
  byTicket: Record<string, number>;
  /** Rows whose ticketKeyOf is empty or not in workingKeys. */
  unassigned: number;
  bySource: { total: number; ai: number; human: number };
  edited: number;
  byStatus: ScopeStatusCounts;
  workingKeys: string[];
  /** Sum of byTicket values. */
  ticketPillSum: number;
};

const EMPTY_STATUS = (): ScopeStatusCounts => ({
  Draft: 0,
  "Not run": 0,
  Passed: 0,
  Failed: 0,
  Partial: 0,
  Blocked: 0,
  Skipped: 0,
  Stale: 0,
});

/**
 * One-pass summary over a rows array. All UI counts for that scope must come from here.
 */
export function buildScopeSummary(rows: SitSheetRow[], workingKeys: string[] = []): ScopeSummary {
  const keys = sortTicketKeys(workingKeys.map(normalizeTicketKey).filter(Boolean));
  const keySet = new Set(keys);
  const byTicket: Record<string, number> = {};
  for (const k of keys) byTicket[k] = 0;

  let unassigned = 0;
  let ai = 0;
  let human = 0;
  let edited = 0;
  const byStatus = EMPTY_STATUS();
  let total = 0;

  for (const r of rows) {
    if (r.cells.deleted === "1") continue;
    total++;
    const key = ticketKeyOf(r);
    if (!key || !keySet.has(key)) unassigned++;
    else byTicket[key] = (byTicket[key] || 0) + 1;

    const prov = getCaseProvenance(r.cells);
    if (prov.origin === "human") human++;
    else ai++;
    if (prov.edited) edited++;

    const st = r.cells.executionStatus || "Not run";
    if (st in byStatus) byStatus[st as keyof ScopeStatusCounts]++;
    else byStatus["Not run"]++;
  }

  const ticketPillSum = keys.reduce((n, k) => n + (byTicket[k] || 0), 0);
  return {
    total,
    byTicket,
    unassigned,
    bySource: { total: ai + human, ai, human },
    edited,
    byStatus,
    workingKeys: keys,
    ticketPillSum,
  };
}

export type ScopeInvariantBreak = { id: string; detail: string };

/** I-a, I-b, I-c for a summary. Showing X/Y and DOM asserts live in Playwright. */
export function checkScopeInvariants(summary: ScopeSummary): ScopeInvariantBreak[] {
  const breaks: ScopeInvariantBreak[] = [];
  if (summary.total !== summary.ticketPillSum + summary.unassigned) {
    breaks.push({
      id: "I-a",
      detail: `All ${summary.total} != pills ${summary.ticketPillSum} + unassigned ${summary.unassigned}`,
    });
  }
  if (summary.bySource.total !== summary.bySource.ai + summary.bySource.human) {
    breaks.push({
      id: "I-b",
      detail: `sources ${summary.bySource.total} != ai ${summary.bySource.ai} + human ${summary.bySource.human}`,
    });
  }
  if (summary.bySource.total !== summary.total) {
    breaks.push({
      id: "I-b-total",
      detail: `source total ${summary.bySource.total} != All ${summary.total}`,
    });
  }
  const statusSum = Object.values(summary.byStatus).reduce((a, b) => a + b, 0);
  if (statusSum !== summary.total) {
    breaks.push({
      id: "I-c",
      detail: `status sum ${statusSum} != All ${summary.total}`,
    });
  }
  return breaks;
}

/**
 * Dev-only: console.error when invariants break. Returns breaks for Playwright hooks.
 */
export function reportScopeInvariantBreaks(summary: ScopeSummary, label = "sit-scope"): ScopeInvariantBreak[] {
  const breaks = checkScopeInvariants(summary);
  if (breaks.length && typeof console !== "undefined") {
    for (const b of breaks) {
      console.error(`[${label}] invariant ${b.id}: ${b.detail}`);
    }
  }
  return breaks;
}

export type MergedScope = {
  rows: SitSheetRow[];
  sourceIssueKeys: string[];
  workbookIds: string[];
  /** row id to owning workbook id (for patch/delete). */
  rowWorkbookId: Record<string, string>;
};

/**
 * Merge workbooks for the working set: for each ticket key, take rows from the
 * newest workbook that contains that key (by updatedAt/createdAt). Dedupe by row id.
 * Does not produce display counts: use buildScopeSummary(merged.rows, keys).
 */
export function mergeWorkbooksForKeys(workbooks: SitWorkbook[], keys: string[]): MergedScope {
  const normKeys = sortTicketKeys(keys.map(normalizeTicketKey).filter(Boolean));
  if (!normKeys.length) {
    return { rows: [], sourceIssueKeys: [], workbookIds: [], rowWorkbookId: {} };
  }
  const keySet = new Set(normKeys);
  const sorted = [...workbooks].sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || 0;
    const tb = b.updatedAt || b.createdAt || 0;
    return tb - ta;
  });
  const chosen = new Map<string, SitWorkbook>();
  for (const wb of sorted) {
    const rows = wb.sheets.find((s) => s.kind === "test-cases")?.rows || [];
    for (const key of keySet) {
      if (chosen.has(key)) continue;
      if (rowsForTicket(rows, key).length) chosen.set(key, wb);
    }
  }
  // Also pick newest workbook that may hold unassigned / foreign keys when present in any wb
  // that is already chosen, or newest multi-key wb: unassigned rows come along with chosen wbs.
  const rowById = new Map<string, SitSheetRow>();
  const rowWorkbookId: Record<string, string> = {};
  const workbookIds = new Set<string>();
  for (const key of sortTicketKeys([...chosen.keys()])) {
    const wb = chosen.get(key)!;
    workbookIds.add(wb.id);
    const all = wb.sheets.find((s) => s.kind === "test-cases")?.rows || [];
    for (const row of liveRows(all)) {
      const rk = ticketKeyOf(row);
      // Include rows for this key, and unassigned / foreign rows only from the newest chosen workbook overall
      if (rk === key) {
        if (!rowById.has(row.id)) {
          rowById.set(row.id, row);
          rowWorkbookId[row.id] = wb.id;
        }
      }
    }
  }
  // Unassigned / foreign: from newest workbook among chosen (or newest hist) so legacy orphans surface
  const newestChosen =
    sorted.find((w) => workbookIds.has(w.id)) ||
    sorted[0] ||
    null;
  if (newestChosen) {
    workbookIds.add(newestChosen.id);
    const all = newestChosen.sheets.find((s) => s.kind === "test-cases")?.rows || [];
    for (const row of liveRows(all)) {
      const rk = ticketKeyOf(row);
      if (!rk || !keySet.has(rk)) {
        if (!rowById.has(row.id)) {
          rowById.set(row.id, row);
          rowWorkbookId[row.id] = newestChosen.id;
        }
      }
    }
  }
  return {
    rows: [...rowById.values()],
    sourceIssueKeys: sortTicketKeys([...chosen.keys()]),
    workbookIds: [...workbookIds],
    rowWorkbookId,
  };
}

/** Build a display workbook shell from a seed workbook + merged rows. */
export function workbookWithMergedRows(seed: SitWorkbook | null, merged: MergedScope): SitWorkbook | null {
  if (!merged.rows.length && !seed) return null;
  const base: SitWorkbook =
    seed ||
    ({
      id: "merged",
      canvasId: "",
      confirmedId: "",
      sourceIssueKeys: merged.sourceIssueKeys,
      sourceSummaries: {},
      status: "ready",
      error: null,
      generator: "huggingface",
      sheets: [],
      createdBy: { id: "", name: "" },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as SitWorkbook);
  const tc = base.sheets.find((s) => s.kind === "test-cases");
  const other = base.sheets.filter((s) => s.kind !== "test-cases");
  return {
    ...base,
    id: seed?.id || merged.workbookIds[0] || base.id,
    sourceIssueKeys: merged.sourceIssueKeys.length ? merged.sourceIssueKeys : base.sourceIssueKeys,
    sheets: [
      {
        id: tc?.id || "tc",
        name: tc?.name || "Test Cases",
        kind: "test-cases",
        columns: tc?.columns || [],
        rows: merged.rows,
      },
      ...other,
    ],
  };
}

export function ticketsFromKeys(epicsTickets: SitTicket[], keys: string[]): SitTicket[] {
  const map = new Map(epicsTickets.map((t) => [normalizeTicketKey(t.key), t]));
  return keys.map((k) => map.get(normalizeTicketKey(k))).filter(Boolean) as SitTicket[];
}

/** Persist helpers */
export const SIT_SELECTED_KEYS = "sit_v2_selected_keys";
export const SIT_SCOPE_PILL = "sit_v2_scope_pill";
export const SIT_MODE_KEY = "sit_v2_mode";

export function loadPersistedSelectedKeys(): string[] {
  try {
    const raw = localStorage.getItem(SIT_SELECTED_KEYS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).map(normalizeTicketKey).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function savePersistedSelectedKeys(keys: string[]) {
  try {
    localStorage.setItem(SIT_SELECTED_KEYS, JSON.stringify(keys.map(normalizeTicketKey)));
  } catch {
    /* ignore */
  }
}

export function loadPersistedScope(validKeys: string[]): string | "all" {
  try {
    const raw = localStorage.getItem(SIT_SCOPE_PILL) || "all";
    if (raw === "all") return "all";
    const n = normalizeTicketKey(raw);
    if (validKeys.map(normalizeTicketKey).includes(n)) return n;
    return "all";
  } catch {
    return "all";
  }
}

export function savePersistedScope(scope: string | "all") {
  try {
    localStorage.setItem(SIT_SCOPE_PILL, scope === "all" ? "all" : normalizeTicketKey(scope));
  } catch {
    /* ignore */
  }
}

export function loadPersistedMode(): "cases" | "issues" {
  try {
    const raw = localStorage.getItem(SIT_MODE_KEY);
    return raw === "issues" ? "issues" : "cases";
  } catch {
    return "cases";
  }
}

export function savePersistedMode(mode: "cases" | "issues") {
  try {
    localStorage.setItem(SIT_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}
