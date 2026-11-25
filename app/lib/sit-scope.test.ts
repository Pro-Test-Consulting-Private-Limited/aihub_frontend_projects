import { describe, expect, it } from "vitest";
import type { SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import {
  buildScopeSummary,
  checkScopeInvariants,
  compareTicketKeys,
  liveCaseCount,
  mergeWorkbooksForKeys,
  sortTicketKeys,
  ticketBelongsToProject,
  ticketKeyOf,
  workingSetKeys,
} from "./sit-scope";
import { legacyAllVsPillSum } from "./sit-scope-r14-legacy";

function row(id: string, ticket: string, extra: Record<string, string> = {}): SitSheetRow {
  return {
    id,
    cells: {
      caseId: id,
      requirementId: ticket,
      issueKey: ticket,
      deleted: "0",
      scenario: id,
      steps: "1. a\n2. b\n3. c\n4. d",
      expected: "- ok result here yes",
      origin: "ai",
      assessmentSource: "Model",
      executionStatus: "Not run",
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
    confirmedId: id,
    sourceIssueKeys: keys,
    sourceSummaries: {},
    status: "ready",
    error: null,
    generator: "huggingface",
    sheets: [{ id: "tc", name: "Test Cases", kind: "test-cases", columns: [], rows }],
    createdBy: { id: "u", name: "u" },
    createdAt: updatedAt,
    updatedAt,
  } as SitWorkbook;
}

describe("R12-01 All scope aggregates across workbooks", () => {
  it("merge across working set", () => {
    const w7 = wb("w7", ["DW-7"], Array.from({ length: 7 }, (_, i) => row(`DW-7-${i}`, "DW-7")), 300);
    const w9 = wb("w9", ["DW-9"], Array.from({ length: 12 }, (_, i) => row(`DW-9-${i}`, "DW-9")), 200);
    const w10 = wb("w10", ["DW-10"], Array.from({ length: 7 }, (_, i) => row(`DW-10-${i}`, "DW-10")), 100);
    const merged = mergeWorkbooksForKeys([w7, w9, w10], ["DW-7", "DW-9", "DW-10"]);
    expect(merged.rows.length).toBe(26);
    const s = buildScopeSummary(merged.rows, ["DW-7", "DW-9", "DW-10"]);
    expect(s.byTicket["DW-7"]).toBe(7);
    expect(s.byTicket["DW-9"]).toBe(12);
    expect(s.byTicket["DW-10"]).toBe(7);
    expect(s.total).toBe(26);
    expect(checkScopeInvariants(s)).toEqual([]);
  });

  it("pill order is natural numeric", () => {
    expect(sortTicketKeys(["DW-11", "DW-7", "DW-10", "DW-9", "DW-15", "DW-12"])).toEqual([
      "DW-7",
      "DW-9",
      "DW-10",
      "DW-11",
      "DW-12",
      "DW-15",
    ]);
    expect(compareTicketKeys("DW-7", "DW-10")).toBeLessThan(0);
  });

  it("working set unions selected and workbook keys, sorted", () => {
    expect(workingSetKeys(["DW-10", "DW-7"], ["DW-9", "DW-7"])).toEqual(["DW-7", "DW-9", "DW-10"]);
  });
});

describe("R14 ticketKeyOf", () => {
  it("trims and uppercases requirementId, falls back to issueKey", () => {
    expect(ticketKeyOf({ cells: { requirementId: " dw-11 ", issueKey: "" } })).toBe("DW-11");
    expect(ticketKeyOf({ cells: { requirementId: "", issueKey: "dw-9" } })).toBe("DW-9");
    expect(ticketKeyOf({ cells: { requirementId: "", issueKey: "" } })).toBe("");
  });
});

describe("project-scoped foreign keys", () => {
  it("ticketBelongsToProject keeps DW-* for project DW and rejects WALLET-*", () => {
    expect(ticketBelongsToProject("DW-6", "DW")).toBe(true);
    expect(ticketBelongsToProject("dw-14", "DW")).toBe(true);
    expect(ticketBelongsToProject("WALLET-101", "DW")).toBe(false);
    expect(ticketBelongsToProject("WALLET-101", null)).toBe(true);
  });

  it("buildScopeSummary folds foreign keys into Unassigned when projectKey is set", () => {
    const rows = [
      row("a", "DW-6"),
      row("b", "DW-6"),
      row("c", "WALLET-101"),
      row("d", "", { requirementId: "", issueKey: "" }),
    ];
    const s = buildScopeSummary(rows, ["DW-6", "WALLET-101"], "DW");
    expect(s.byTicket["DW-6"]).toBe(2);
    expect(s.byTicket["WALLET-101"]).toBeUndefined();
    expect(s.workingKeys).toEqual(["DW-6"]);
    expect(s.unassigned).toBe(2);
    expect(s.total).toBe(4);
    expect(checkScopeInvariants(s)).toEqual([]);
  });
});

describe("R14-01 Step0 legacy cache fails I-a after Add", () => {
  it("FAILING on old path: All moves, pill cache does not", () => {
    const keys = ["DW-7", "DW-11"];
    const before = [row("a", "DW-7"), row("b", "DW-11"), row("c", "DW-11")];
    const cache = buildScopeSummary(before, keys).byTicket;
    const after = [...before, row("d", "DW-11", { origin: "human", executionStatus: "Draft" })];
    const legacy = legacyAllVsPillSum(after, cache, keys);
    expect(legacy.diff).toBe(1);
    expect(legacy.all).toBe(4);
    expect(legacy.pillSum).toBe(3);
    const fixed = buildScopeSummary(after, keys);
    expect(checkScopeInvariants(fixed)).toEqual([]);
    expect(fixed.total).toBe(fixed.ticketPillSum + fixed.unassigned);
  });
});

describe("R14-02 state machine invariants", () => {
  function mutate(
    rows: SitSheetRow[],
    op: string,
    ticket = "DW-7",
  ): SitSheetRow[] {
    const live = rows.filter((r) => r.cells.deleted !== "1");
    if (op === "add") {
      return [
        ...rows,
        row(`new-${Math.random()}`, ticket, { origin: "human", executionStatus: "Draft" }),
      ];
    }
    if (op === "duplicate" && live[0]) {
      const src = live[0];
      return [
        ...rows,
        row(`dup-${Math.random()}`, ticketKeyOf(src) || ticket, { ...src.cells, caseId: "dup" }),
      ];
    }
    if (op === "softDelete" && live[0]) {
      return rows.map((r) => (r.id === live[0]!.id ? { ...r, cells: { ...r.cells, deleted: "1" } } : r));
    }
    if (op === "undo" && rows.some((r) => r.cells.deleted === "1")) {
      const gone = rows.find((r) => r.cells.deleted === "1");
      return rows.map((r) => (r.id === gone!.id ? { ...r, cells: { ...r.cells, deleted: "0" } } : r));
    }
    if (op === "bulkDelete") {
      return rows.map((r, i) => (i < 2 ? { ...r, cells: { ...r.cells, deleted: "1" } } : r));
    }
    if (op === "stream") {
      return [
        ...rows,
        row(`stream-${Math.random()}`, "DW-9", { origin: "ai" }),
        row(`stream2-${Math.random()}`, "DW-10", { origin: "ai" }),
      ];
    }
    if (op === "edit" && live[0]) {
      return rows.map((r) =>
        r.id === live[0]!.id
          ? { ...r, cells: { ...r.cells, scenario: "edited", edited: "1" } }
          : r,
      );
    }
    if (op === "emptyKey") {
      return [...rows, row(`orphan-${Math.random()}`, "", { requirementId: "", issueKey: "" })];
    }
    if (op === "weirdKey") {
      return [...rows, row(`weird-${Math.random()}`, " dw-7 ", { requirementId: " dw-7 ", issueKey: "" })];
    }
    return rows;
  }

  it("holds I-a I-b I-c after every mutation", () => {
    const keys = ["DW-7", "DW-9", "DW-10", "DW-11"];
    let rows: SitSheetRow[] = [
      ...Array.from({ length: 3 }, (_, i) => row(`A-${i}`, "DW-7")),
      ...Array.from({ length: 2 }, (_, i) => row(`B-${i}`, "DW-9", { origin: "human" })),
      row("C-0", "DW-10", { executionStatus: "Draft" }),
      row("D-0", "DW-11", { edited: "1" }),
      row("pad", "dw-7", { requirementId: " dw-7 " }),
      row("foreign", "SYN-1"),
      row("empty", "", { requirementId: "", issueKey: "" }),
    ];
    const ops = [
      "add",
      "duplicate",
      "edit",
      "softDelete",
      "undo",
      "bulkDelete",
      "undo",
      "stream",
      "emptyKey",
      "weirdKey",
      "add",
      "softDelete",
    ];
    for (const op of ops) {
      rows = mutate(rows, op, "DW-11");
      const s = buildScopeSummary(rows, keys);
      const breaks = checkScopeInvariants(s);
      expect(breaks, `after ${op}: ${JSON.stringify(breaks)}`).toEqual([]);
      expect(s.total).toBe(s.bySource.ai + s.bySource.human);
    }
  });
});

describe("R12-02 popup count equals live rows for ticket", () => {
  it("buildScopeSummary matches rows for each ticket and sum equals All", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => row(`A-${i}`, "DW-7")),
      ...Array.from({ length: 12 }, (_, i) => row(`B-${i}`, "DW-9")),
      ...Array.from({ length: 7 }, (_, i) => row(`C-${i}`, "DW-10")),
      row("human-1", "DW-10"),
    ];
    const s = buildScopeSummary(rows, ["DW-7", "DW-9", "DW-10"]);
    expect(s.byTicket["DW-7"]).toBe(7);
    expect(s.byTicket["DW-9"]).toBe(12);
    expect(s.byTicket["DW-10"]).toBe(8);
    expect(s.ticketPillSum).toBe(s.total);
    expect(liveCaseCount(rows)).toBe(27);
  });
});
