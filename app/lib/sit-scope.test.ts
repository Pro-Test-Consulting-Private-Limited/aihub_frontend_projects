import { describe, expect, it } from "vitest";
import type { SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import {
  compareTicketKeys,
  liveCaseCount,
  mergeWorkbooksForKeys,
  sortTicketKeys,
  workingSetKeys,
} from "./sit-scope";

function row(id: string, ticket: string): SitSheetRow {
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
  it("FAILING-BEFORE-FIX document: latest workbook alone under-counts All", () => {
    const w7 = wb("w7", ["DW-7"], Array.from({ length: 7 }, (_, i) => row(`DW-7-${i}`, "DW-7")), 300);
    const w9 = wb("w9", ["DW-9"], Array.from({ length: 12 }, (_, i) => row(`DW-9-${i}`, "DW-9")), 200);
    const w10 = wb("w10", ["DW-10"], Array.from({ length: 7 }, (_, i) => row(`DW-10-${i}`, "DW-10")), 100);
    // Bug pattern: UI used only newest workbook (w7) for All → 7
    const newestOnly = w7.sheets[0]!.rows.filter((r) => r.cells.deleted !== "1");
    expect(newestOnly.length).toBe(7);
    // Fix: merge across working set
    const merged = mergeWorkbooksForKeys([w7, w9, w10], ["DW-7", "DW-9", "DW-10"]);
    expect(merged.rows.length).toBe(26);
    expect(liveCaseCount(merged.rows, "DW-7")).toBe(7);
    expect(liveCaseCount(merged.rows, "DW-9")).toBe(12);
    expect(liveCaseCount(merged.rows, "DW-10")).toBe(7);
    expect(liveCaseCount(merged.rows)).toBe(26);
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

describe("R12-02 popup count equals live rows for ticket", () => {
  it("liveCaseCount matches rows for each ticket and sum equals All", () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => row(`A-${i}`, "DW-7")),
      ...Array.from({ length: 12 }, (_, i) => row(`B-${i}`, "DW-9")),
      ...Array.from({ length: 7 }, (_, i) => row(`C-${i}`, "DW-10")),
      row("human-1", "DW-10"), // human-added
    ];
    expect(liveCaseCount(rows, "DW-7")).toBe(7);
    expect(liveCaseCount(rows, "DW-9")).toBe(12);
    expect(liveCaseCount(rows, "DW-10")).toBe(8);
    expect(liveCaseCount(rows, "DW-7") + liveCaseCount(rows, "DW-9") + liveCaseCount(rows, "DW-10")).toBe(
      liveCaseCount(rows),
    );
  });
});
