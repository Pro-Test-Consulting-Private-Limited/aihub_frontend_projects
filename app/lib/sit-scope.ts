/**
 * Round 12: working-set scope helpers (All vs single ticket, pill order, merge).
 */

import type { SitSheetRow, SitTicket, SitWorkbook } from "@/app/interfaces/appatlas";

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
  return sortTicketKeys(Array.from(new Set([...selectedKeys, ...workbookKeys])));
}

export function rowsForTicket(rows: SitSheetRow[], ticketKey: string): SitSheetRow[] {
  return rows.filter(
    (r) =>
      r.cells.deleted !== "1" &&
      (r.cells.requirementId === ticketKey || r.cells.issueKey === ticketKey),
  );
}

export function liveCaseCount(rows: SitSheetRow[], ticketKey?: string): number {
  const list = ticketKey ? rowsForTicket(rows, ticketKey) : rows.filter((r) => r.cells.deleted !== "1");
  return list.length;
}

export type MergedScope = {
  rows: SitSheetRow[];
  sourceIssueKeys: string[];
  workbookIds: string[];
  /** row id → owning workbook id (for patch/delete). */
  rowWorkbookId: Record<string, string>;
  /** ticket key → live case count from merged rows. */
  countsByTicket: Record<string, number>;
};

/**
 * Merge workbooks for the working set: for each ticket key, take rows from the
 * newest workbook that contains that key (by updatedAt/createdAt). Dedupe by row id.
 */
export function mergeWorkbooksForKeys(workbooks: SitWorkbook[], keys: string[]): MergedScope {
  if (!keys.length) {
    return { rows: [], sourceIssueKeys: [], workbookIds: [], rowWorkbookId: {}, countsByTicket: {} };
  }
  const keySet = new Set(keys);
  const sorted = [...workbooks].sort((a, b) => {
    const ta = a.updatedAt || a.createdAt || 0;
    const tb = b.updatedAt || b.createdAt || 0;
    return tb - ta;
  });
  const chosen = new Map<string, SitWorkbook>(); // ticket -> workbook
  for (const wb of sorted) {
    const rows = wb.sheets.find((s) => s.kind === "test-cases")?.rows || [];
    for (const key of keySet) {
      if (chosen.has(key)) continue;
      if (rowsForTicket(rows, key).length) chosen.set(key, wb);
    }
  }
  const rowById = new Map<string, SitSheetRow>();
  const rowWorkbookId: Record<string, string> = {};
  const workbookIds = new Set<string>();
  const countsByTicket: Record<string, number> = {};
  for (const key of sortTicketKeys([...chosen.keys()])) {
    const wb = chosen.get(key)!;
    workbookIds.add(wb.id);
    const ticketRows = rowsForTicket(wb.sheets.find((s) => s.kind === "test-cases")?.rows || [], key);
    countsByTicket[key] = ticketRows.length;
    for (const row of ticketRows) {
      if (!rowById.has(row.id)) {
        rowById.set(row.id, row);
        rowWorkbookId[row.id] = wb.id;
      }
    }
  }
  // Tickets in the working set with zero cases still appear with count 0.
  for (const key of keys) {
    if (countsByTicket[key] == null) countsByTicket[key] = 0;
  }
  return {
    rows: [...rowById.values()],
    sourceIssueKeys: sortTicketKeys([...chosen.keys()]),
    workbookIds: [...workbookIds],
    rowWorkbookId,
    countsByTicket,
  };
}

/** Build a display workbook shell from a seed workbook + merged rows. */
export function workbookWithMergedRows(seed: SitWorkbook | null, merged: ReturnType<typeof mergeWorkbooksForKeys>): SitWorkbook | null {
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
  const map = new Map(epicsTickets.map((t) => [t.key, t]));
  return keys.map((k) => map.get(k)).filter(Boolean) as SitTicket[];
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
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function savePersistedSelectedKeys(keys: string[]) {
  try {
    localStorage.setItem(SIT_SELECTED_KEYS, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}

export function loadPersistedScope(validKeys: string[]): string | "all" {
  try {
    const raw = localStorage.getItem(SIT_SCOPE_PILL) || "all";
    if (raw === "all") return "all";
    if (validKeys.includes(raw)) return raw;
    return "all";
  } catch {
    return "all";
  }
}

export function savePersistedScope(scope: string | "all") {
  try {
    localStorage.setItem(SIT_SCOPE_PILL, scope);
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
