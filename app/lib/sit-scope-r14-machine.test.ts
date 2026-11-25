/**
 * R14-02: state-machine over random mutations; invariants after every step.
 * Also proves the legacy stale-cache path fails after Add.
 */
import { describe, expect, it } from "vitest";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import {
  buildScopeSummary,
  checkScopeInvariants,
  mergeStreamIntoScope,
  ticketKeyOf,
  workingSetKeys,
} from "./sit-scope";
import type { SitWorkbook } from "@/app/interfaces/appatlas";
import { legacyAllVsPillSum } from "./sit-scope-r14-legacy";

function mk(
  id: string,
  opts: {
    ticket?: string;
    origin?: string;
    edited?: string;
    status?: string;
    deleted?: string;
    req?: string;
    issue?: string;
  } = {},
): SitSheetRow {
  const ticket = opts.ticket ?? "DW-7";
  return {
    id,
    cells: {
      caseId: id,
      requirementId: opts.req !== undefined ? opts.req : ticket,
      issueKey: opts.issue !== undefined ? opts.issue : ticket,
      deleted: opts.deleted ?? "0",
      origin: opts.origin ?? "ai",
      edited: opts.edited ?? "0",
      executionStatus: opts.status ?? "Not run",
      scenario: id,
      steps: "1. a\n2. b\n3. c\n4. d",
      expected: "- outcome visible here yes",
    },
  };
}

function rnd(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe("R14 state machine invariants", () => {
  it("legacy path fails after add; summary path holds across random mutations", () => {
    const keys = ["DW-7", "DW-9", "DW-10", "DW-11"];
    let rows: SitSheetRow[] = [
      mk("1", { ticket: "DW-7" }),
      mk("2", { ticket: "DW-9", origin: "human", status: "Draft" }),
      mk("3", { ticket: "DW-10", edited: "1" }),
      mk("4", { ticket: "DW-11", status: "Passed" }),
      mk("5", { req: "", issue: "", ticket: "" }),
      mk("6", { req: " dw-7 ", issue: "" }),
      mk("7", { ticket: "SYN-99" }),
      mk("8", { ticket: "DW-10", deleted: "1" }),
    ];

    const cache = buildScopeSummary(rows, keys).byTicket;
    rows = [...rows, mk("add-legacy", { ticket: "DW-11", origin: "human", status: "Draft" })];
    const legacy = legacyAllVsPillSum(
      rows.filter((r) => r.cells.deleted !== "1"),
      cache,
      keys,
    );
    expect(legacy.diff).toBeGreaterThan(0);

    const rand = rnd(42);
    const ops = [
      "add",
      "dup",
      "edit",
      "softDelete",
      "undo",
      "bulkDelete",
      "bulkUndo",
      "stream",
    ] as const;

    let deletedStack: SitSheetRow[] = [];
    for (let step = 0; step < 80; step++) {
      const op = ops[Math.floor(rand() * ops.length)]!;
      const live = () => rows.filter((r) => r.cells.deleted !== "1");
      if (op === "add") {
        const k = keys[Math.floor(rand() * keys.length)]!;
        rows = [...rows, mk(`a-${step}`, { ticket: k, origin: rand() > 0.5 ? "human" : "ai", status: "Draft" })];
      } else if (op === "dup") {
        const L = live();
        if (L.length) {
          const src = L[Math.floor(rand() * L.length)]!;
          rows = [
            ...rows,
            mk(`d-${step}`, {
              ticket: ticketKeyOf(src) || "DW-7",
              origin: "human",
              status: "Draft",
            }),
          ];
        }
      } else if (op === "edit") {
        const L = live();
        if (L.length) {
          const src = L[Math.floor(rand() * L.length)]!;
          rows = rows.map((r) =>
            r.id === src.id
              ? {
                  ...r,
                  cells: {
                    ...r.cells,
                    scenario: `${r.cells.scenario} edited`,
                    edited: r.cells.origin === "human" ? "0" : "1",
                  },
                }
              : r,
          );
        }
      } else if (op === "softDelete") {
        const L = live();
        if (L.length) {
          const src = L[Math.floor(rand() * L.length)]!;
          deletedStack.push(src);
          rows = rows.map((r) =>
            r.id === src.id ? { ...r, cells: { ...r.cells, deleted: "1" } } : r,
          );
        }
      } else if (op === "undo") {
        const src = deletedStack.pop();
        if (src) {
          rows = rows.map((r) =>
            r.id === src.id ? { ...r, cells: { ...r.cells, deleted: "0" } } : r,
          );
        }
      } else if (op === "bulkDelete") {
        const L = live().slice(0, 2);
        deletedStack.push(...L);
        const ids = new Set(L.map((r) => r.id));
        rows = rows.map((r) =>
          ids.has(r.id) ? { ...r, cells: { ...r.cells, deleted: "1" } } : r,
        );
      } else if (op === "bulkUndo") {
        while (deletedStack.length) {
          const src = deletedStack.pop()!;
          rows = rows.map((r) =>
            r.id === src.id ? { ...r, cells: { ...r.cells, deleted: "0" } } : r,
          );
        }
      } else if (op === "stream") {
        const batch = [
          mk(`s-${step}-a`, { ticket: "DW-7" }),
          mk(`s-${step}-b`, { ticket: "DW-9", origin: "human" }),
        ];
        rows = [...rows, ...batch];
      }

      const summary = buildScopeSummary(live(), keys);
      const breaks = checkScopeInvariants(summary);
      expect(breaks, `step ${step} op ${op}: ${JSON.stringify(breaks)}`).toEqual([]);
      expect(summary.bySource.total).toBe(summary.total);
    }
  });

  it("R16 stream events never shrink working keys and keep invariants", () => {
    const keys = ["DW-6", "DW-7", "DW-9"];
    let baseRows: SitSheetRow[] = [
      ...Array.from({ length: 11 }, (_, i) => mk(`DW-7-${i}`, { ticket: "DW-7" })),
      ...Array.from({ length: 8 }, (_, i) => mk(`DW-9-${i}`, { ticket: "DW-9" })),
    ];
    let streamWb: SitWorkbook | null = null;
    let genKeys: string[] = [];
    let workingKeys = workingSetKeys(keys, []);

    const assertStep = (label: string) => {
      const merged = mergeStreamIntoScope(baseRows, keys, streamWb, genKeys);
      for (const k of workingKeys) {
        expect(merged.workingKeys, label).toContain(k);
      }
      workingKeys = merged.workingKeys;
      const summary = buildScopeSummary(merged.rows, merged.workingKeys);
      expect(checkScopeInvariants(summary), label).toEqual([]);
      expect(summary.byTicket["DW-7"]).toBe(11);
      expect(summary.byTicket["DW-9"]).toBe(8);
    };

    // stream-start
    genKeys = ["DW-6"];
    streamWb = {
      id: "pending",
      canvasId: "c",
      confirmedId: "",
      sourceIssueKeys: ["DW-6"],
      sourceSummaries: {},
      status: "running",
      error: null,
      generator: "huggingface",
      sheets: [{ id: "tc", name: "Test Cases", kind: "test-cases", columns: [], rows: [] }],
      createdBy: { id: "u", name: "u" },
      createdAt: 1,
      updatedAt: 1,
    } as SitWorkbook;
    assertStep("stream-start");

    // stream-row
    streamWb = {
      ...streamWb,
      sheets: [
        {
          id: "tc",
          name: "Test Cases",
          kind: "test-cases",
          columns: [],
          rows: [mk("DW-6-01", { ticket: "DW-6" })],
        },
      ],
    };
    assertStep("stream-row");

    // stream-workbook (append seed with foreign tickets must not steal DW-7/9)
    streamWb = {
      ...streamWb,
      id: "stream-final",
      sourceIssueKeys: ["DW-6"],
      sheets: [
        {
          id: "tc",
          name: "Test Cases",
          kind: "test-cases",
          columns: [],
          rows: [
            ...baseRows,
            mk("DW-6-01", { ticket: "DW-6" }),
            mk("DW-6-02", { ticket: "DW-6" }),
          ],
        },
      ],
    };
    assertStep("stream-workbook");

    // stream-done / cancel / error: clear stream
    streamWb = null;
    genKeys = [];
    assertStep("stream-done");
    workingKeys = workingSetKeys(keys, []);
    streamWb = {
      id: "partial",
      canvasId: "c",
      confirmedId: "",
      sourceIssueKeys: ["DW-6"],
      sourceSummaries: {},
      status: "running",
      error: null,
      generator: "huggingface",
      sheets: [
        {
          id: "tc",
          name: "Test Cases",
          kind: "test-cases",
          columns: [],
          rows: [mk("DW-6-x", { ticket: "DW-6" })],
        },
      ],
      createdBy: { id: "u", name: "u" },
      createdAt: 1,
      updatedAt: 1,
    } as SitWorkbook;
    genKeys = ["DW-6"];
    assertStep("stream-error-mid");
    streamWb = null;
    genKeys = [];
    assertStep("stream-cancel");
  });
});
