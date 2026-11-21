import { describe, expect, it } from "vitest";
import { guardFormula, toCsv, casesForExport, type ExportCaseRow } from "./sit-export";
import type { SitWorkbook } from "@/app/interfaces/appatlas";

describe("sit-export", () => {
  it("guards formula injection", () => {
    expect(guardFormula("=1+1")).toBe("'=1+1");
    expect(guardFormula("+cmd")).toBe("'+cmd");
    expect(guardFormula("-1")).toBe("'-1");
    expect(guardFormula("@sum")).toBe("'@sum");
    expect(guardFormula("normal")).toBe("normal");
  });

  it("CSV includes BOM and quotes multi-line steps and rupee", () => {
    const rows: ExportCaseRow[] = [
      {
        id: "TC-1",
        jiraKey: "DW-1",
        module: "Wallet",
        feature: "Pay",
        priority: "High",
        severity: "High",
        scenarioType: "Positive",
        scenarioTitle: "Pay ₹100",
        preconditions: "Logged in",
        steps: "1. Enter amount\n2. Pay",
        expected: "Toast shows ₹100 paid",
        status: "Not run",
        origin: "ai",
        edited: "no",
        acIds: "AC1",
        version: "1",
        statusBy: "",
        statusAt: "",
      },
    ];
    const csv = toCsv(rows);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Pay ₹100");
    expect(csv).toMatch(/"1\. Enter amount\r?\n2\. Pay"/);
  });

  it("casesForExport respects scope selected", () => {
    const wb = {
      id: "w1",
      sheets: [
        {
          id: "tc",
          name: "Test Cases",
          kind: "test-cases" as const,
          columns: [],
          rows: [
            { id: "a", cells: { caseId: "1", requirementId: "DW-1", scenario: "A", deleted: "0" } },
            { id: "b", cells: { caseId: "2", requirementId: "DW-2", scenario: "B", deleted: "0" } },
          ],
        },
      ],
    } as unknown as SitWorkbook;
    const rows = casesForExport(wb, { scope: "selected", selectedKeys: ["DW-2"] });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.jiraKey).toBe("DW-2");
  });
});
