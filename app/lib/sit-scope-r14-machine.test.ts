/**
 * R14-02: state-machine over random mutations; invariants after every step.
 * Also proves the legacy stale-cache path fails after Add.
 */
import { describe, expect, it } from "vitest";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import {
  buildScopeSummary,
  checkScopeInvariants,
  ticketKeyOf,
} from "./sit-scope";
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
});
