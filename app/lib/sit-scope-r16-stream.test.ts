/**
 * R16: mergeStreamIntoScope must keep non-generating tickets and never double-count
 * parent-seeded foreign rows from the stream workbook.
 */
import { describe, expect, it } from "vitest";
import type { SitSheetRow, SitWorkbook } from "@/app/interfaces/appatlas";
import {
  buildScopeSummary,
  checkScopeInvariants,
  mergeStreamIntoScope,
  ticketKeyOf,
  workingSetKeys,
} from "./sit-scope";

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

function wb(id: string, keys: string[], rows: SitSheetRow[]): SitWorkbook {
  return {
    id,
    canvasId: "c",
    confirmedId: id,
    sourceIssueKeys: keys,
    sourceSummaries: {},
    status: "running",
    error: null,
    generator: "huggingface",
    sheets: [{ id: "tc", name: "Test Cases", kind: "test-cases", columns: [], rows }],
    createdBy: { id: "u", name: "u" },
    createdAt: 1,
    updatedAt: 2,
  } as SitWorkbook;
}

describe("R16 mergeStreamIntoScope", () => {
  const baseKeys = ["DW-6", "DW-7", "DW-9"];
  const baseRows = [
    ...Array.from({ length: 11 }, (_, i) => row(`DW-7-${i}`, "DW-7")),
    ...Array.from({ length: 8 }, (_, i) => row(`DW-9-${i}`, "DW-9")),
  ];

  it("base 3 tickets plus stream for one (S1/S2 shape)", () => {
    const stream = wb("stream1", ["DW-6"], [row("DW-6-01", "DW-6")]);
    const merged = mergeStreamIntoScope(baseRows, baseKeys, stream, ["DW-6"]);
    expect(merged.workingKeys).toEqual(["DW-6", "DW-7", "DW-9"]);
    const s = buildScopeSummary(merged.rows, merged.workingKeys);
    expect(s.byTicket["DW-7"]).toBe(11);
    expect(s.byTicket["DW-9"]).toBe(8);
    expect(s.byTicket["DW-6"]).toBe(1);
    expect(s.total).toBe(20);
    expect(checkScopeInvariants(s)).toEqual([]);
    expect(merged.streamRowWorkbookId["DW-6-01"]).toBe("stream1");
  });

  it("stream for two tickets", () => {
    const stream = wb("s2", ["DW-6", "DW-7"], [row("DW-6-01", "DW-6"), row("DW-7-new", "DW-7")]);
    const merged = mergeStreamIntoScope(baseRows, baseKeys, stream, ["DW-6", "DW-7"]);
    expect(merged.workingKeys).toEqual(["DW-6", "DW-7", "DW-9"]);
    const s = buildScopeSummary(merged.rows, merged.workingKeys);
    expect(s.byTicket["DW-9"]).toBe(8);
    expect(s.byTicket["DW-6"]).toBe(1);
    expect(s.byTicket["DW-7"]).toBe(1);
    expect(merged.rows.some((r) => r.id.startsWith("DW-7-") && r.id !== "DW-7-new")).toBe(false);
  });

  it("append seed with ALL parent rows must not double count or take foreign tickets", () => {
    const parentSeed = [
      ...baseRows,
      row("DW-6-old", "DW-6"),
      row("DW-6-01", "DW-6"),
    ];
    const stream = wb("append", ["DW-6"], parentSeed);
    const merged = mergeStreamIntoScope(baseRows, baseKeys, stream, ["DW-6"]);
    expect(merged.workingKeys).toEqual(["DW-6", "DW-7", "DW-9"]);
    const s = buildScopeSummary(merged.rows, merged.workingKeys);
    expect(s.byTicket["DW-7"]).toBe(11);
    expect(s.byTicket["DW-9"]).toBe(8);
    expect(s.byTicket["DW-6"]).toBe(2);
    expect(s.total).toBe(21);
    expect(checkScopeInvariants(s)).toEqual([]);
    const dw7FromStream = merged.rows.filter((r) => ticketKeyOf(r) === "DW-7");
    expect(dw7FromStream.every((r) => !merged.streamRowWorkbookId[r.id])).toBe(true);
  });

  it("new mode stream with zero rows keeps other tickets", () => {
    const stream = wb("empty", ["DW-6"], []);
    const merged = mergeStreamIntoScope(baseRows, baseKeys, stream, ["DW-6"]);
    expect(merged.workingKeys).toEqual(["DW-6", "DW-7", "DW-9"]);
    const s = buildScopeSummary(merged.rows, merged.workingKeys);
    expect(s.byTicket["DW-6"]).toBe(0);
    expect(s.byTicket["DW-7"]).toBe(11);
    expect(s.total).toBe(19);
  });

  it("null stream returns base; keys include generating", () => {
    const merged = mergeStreamIntoScope(baseRows, ["DW-7", "DW-9"], null, ["DW-6"]);
    expect(merged.workingKeys).toEqual(["DW-6", "DW-7", "DW-9"]);
    expect(merged.rows.length).toBe(19);
  });

  it("stream for a ticket not in base", () => {
    const stream = wb("s", ["DW-15"], [row("DW-15-01", "DW-15")]);
    const merged = mergeStreamIntoScope(baseRows, ["DW-7", "DW-9"], stream, ["DW-15"]);
    expect(merged.workingKeys).toEqual(["DW-7", "DW-9", "DW-15"]);
    expect(buildScopeSummary(merged.rows, merged.workingKeys).byTicket["DW-15"]).toBe(1);
  });

  it("keys superset property after every stream step", () => {
    let keys = workingSetKeys(["DW-6", "DW-7", "DW-9"], []);
    const before = [...keys];
    for (const n of [0, 1, 2]) {
      const rows = Array.from({ length: n }, (_, i) => row(`DW-6-${i}`, "DW-6"));
      const merged = mergeStreamIntoScope(baseRows, before, wb(`s${n}`, ["DW-6"], rows), ["DW-6"]);
      for (const k of before) expect(merged.workingKeys).toContain(k);
      keys = merged.workingKeys;
    }
  });

  it("dedupe by row id prefers stream row", () => {
    const shared = row("shared-1", "DW-6", { scenario: "from-base" });
    const base = [...baseRows, shared];
    const streamRow = row("shared-1", "DW-6", { scenario: "from-stream" });
    const merged = mergeStreamIntoScope(base, baseKeys, wb("s", ["DW-6"], [streamRow]), ["DW-6"]);
    const hit = merged.rows.find((r) => r.id === "shared-1");
    expect(hit?.cells.scenario).toBe("from-stream");
  });

  it("naive replace with stream workbook fails S2 invariants (failing-before)", () => {
    const stream = wb("stream1", ["DW-6"], [row("DW-6-01", "DW-6")]);
    const naiveKeys = workingSetKeys(["DW-6"], stream.sourceIssueKeys);
    const naiveSummary = buildScopeSummary(
      stream.sheets.find((s) => s.kind === "test-cases")!.rows,
      naiveKeys,
    );
    expect(naiveKeys).toEqual(["DW-6"]);
    expect(naiveSummary.total).toBe(1);
    expect(naiveSummary.byTicket["DW-7"] ?? 0).toBe(0);
    const fixed = mergeStreamIntoScope(baseRows, baseKeys, stream, ["DW-6"]);
    expect(fixed.workingKeys.length).toBe(3);
    expect(buildScopeSummary(fixed.rows, fixed.workingKeys).total).toBe(20);
  });
});
