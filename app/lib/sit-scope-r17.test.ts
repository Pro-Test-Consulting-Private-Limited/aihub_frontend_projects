/**
 * R17: view scope independent of Jira selection; Unassigned only for keyless rows.
 * These tests fail on pre-R17 applyMergedScope / buildScopeSummary behavior.
 */
import { describe, expect, it } from "vitest";
import type { SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import {
  buildScopeSummary,
  checkScopeInvariants,
  liveTicketKeysFromWorkbooks,
  mergeWorkbooksForKeys,
  viewWorkingKeys,
  workingSetKeys,
} from "@/app/lib/sit-scope";

function row(id: string, ticket: string, extra: Record<string, string> = {}): SitSheetRow {
  return {
    id,
    cells: {
      caseId: id,
      requirementId: ticket,
      issueKey: ticket,
      deleted: "0",
      origin: "ai",
      executionStatus: "Not run",
      scenario: id,
      ...extra,
    },
  };
}

function wb(
  id: string,
  keys: string[],
  rows: SitSheetRow[],
  updatedAt: number,
): SitWorkbook {
  return {
    id,
    canvasId: "c",
    confirmedId: "",
    sourceIssueKeys: keys,
    sourceSummaries: {},
    status: "ready",
    error: null,
    generator: "huggingface",
    sheets: [{ id: "tc", name: "Test Cases", kind: "test-cases", columns: [], rows }],
    createdBy: { id: "", name: "" },
    createdAt: updatedAt,
    updatedAt,
  } as SitWorkbook;
}

const mainRows = [
  ...Array.from({ length: 10 }, (_, i) => row(`DW-6-${i}`, "DW-6")),
  ...Array.from({ length: 16 }, (_, i) => row(`DW-7-${i}`, "DW-7")),
  ...Array.from({ length: 17 }, (_, i) => row(`DW-9-${i}`, "DW-9")),
  ...Array.from({ length: 22 }, (_, i) => row(`DW-11-${i}`, "DW-11")),
  ...Array.from({ length: 26 }, (_, i) => row(`DW-12-${i}`, "DW-12")),
  ...Array.from({ length: 22 }, (_, i) => row(`DW-14-${i}`, "DW-14")),
  row("UNASSIGNED-01", "", { requirementId: "", issueKey: "", origin: "human" }),
];

const hist = [
  wb("older", ["DW-6", "DW-7", "DW-9", "DW-11", "DW-12", "DW-14"], mainRows.slice(0, 50), 1),
  wb("main", ["DW-6", "DW-7", "DW-9", "DW-11", "DW-12", "DW-14"], mainRows, 2),
];

describe("R17 view keys (F1)", () => {
  it("selection [DW-6] still includes every live ticket key in viewWorkingKeys", () => {
    const keys = viewWorkingKeys(["DW-6"], hist);
    expect(keys).toEqual(["DW-6", "DW-7", "DW-9", "DW-11", "DW-12", "DW-14"]);
  });

  it("old selection-only workingSetKeys collapses; viewWorkingKeys does not", () => {
    const collapsed = workingSetKeys(["DW-6"], ["DW-6"]);
    expect(collapsed).toEqual(["DW-6"]);
    const view = viewWorkingKeys(["DW-6"], hist);
    expect(view.length).toBe(6);
  });

  it("merge with view keys shows ticket pills not Unassigned lump for real keys", () => {
    const keys = viewWorkingKeys(["DW-6"], hist);
    const merged = mergeWorkbooksForKeys(hist, keys);
    const s = buildScopeSummary(merged.rows, keys);
    expect(s.byTicket["DW-6"]).toBe(10);
    expect(s.byTicket["DW-7"]).toBe(16);
    expect(s.byTicket["DW-14"]).toBe(22);
    expect(s.unassigned).toBe(1);
    expect(s.total).toBe(114);
    expect(checkScopeInvariants(s)).toEqual([]);
  });

  it("empty selection still shows all live keys (M=6, N=0)", () => {
    const keys = viewWorkingKeys([], hist);
    expect(keys.length).toBe(6);
    expect(liveTicketKeysFromWorkbooks(hist)).toEqual(keys);
  });
});

describe("R17 Unassigned only keyless (F2)", () => {
  it("rows with real keys outside workingKeys are not Unassigned", () => {
    const rows = [row("a", "DW-6"), row("b", "DW-7"), row("c", "", { requirementId: "", issueKey: "" })];
    const s = buildScopeSummary(rows, ["DW-6"]);
    // DW-7 has a real key: must not inflate Unassigned
    expect(s.unassigned).toBe(1);
    expect(s.byTicket["DW-6"]).toBe(1);
    expect(s.byTicket["DW-7"] ?? 0).toBe(1);
    expect(s.total).toBe(s.ticketPillSum + s.unassigned);
  });
});
