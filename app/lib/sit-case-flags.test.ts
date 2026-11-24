import { describe, expect, it, vi } from "vitest";
import type { SitSheetRow } from "@/app/interfaces/appatlas";
import {
  caseMatchesFlaggedFilter,
  filterRowsByCaseFlags,
  getCaseFlags,
  migrateFlaggedFilter,
  summarizeCaseFlags,
  warnFlagCountMismatch,
  type CaseFlags,
} from "./sit-case-flags";
import { filterRowsByDeadFlag } from "@/app/components/app-atlas/sit-dead-finder";
import type { SitDeadAudit } from "@/app/interfaces/appatlas";

function row(id: string, cells: Record<string, string> = {}): SitSheetRow {
  return {
    id,
    cells: {
      caseId: id,
      requirementId: "SYN-1",
      origin: "ai",
      assessmentSource: "Model",
      steps: "1. a\n2. b\n3. c\n4. d",
      expected: "- Asserted outcome here yes",
      acIds: "AC1",
      executionStatus: "Not run",
      deleted: "0",
      ...cells,
    },
  };
}

describe("R11-01 getCaseFlags source of truth", () => {
  it("marks needsReview when assessmentSource is Not assessed or empty", () => {
    const a = row("A", { assessmentSource: "Not assessed" });
    const b = row("B", { assessmentSource: "" });
    const c = row("C", { assessmentSource: "Model" });
    const all = [a, b, c];
    expect(getCaseFlags(a, all, null).needsReview).toBe(true);
    expect(getCaseFlags(b, all, null).needsReview).toBe(true);
    expect(getCaseFlags(c, all, null).needsReview).toBe(false);
  });

  it("does not mark human rows as needsReview", () => {
    const h = row("H", { origin: "human", assessmentSource: "Not assessed" });
    expect(getCaseFlags(h, [h], null).needsReview).toBe(false);
  });

  it("detects thin, noExpected, noAC, conflict, duplicate", () => {
    const thin = row("T", { steps: "1. a\n2. b" });
    const empty = row("E", { expected: "" });
    const noAc = row("N", { acIds: "", expected: "- Asserted outcome here yes" });
    const conflict = row("X", {
      preconditions:
        "- User is signed in with a valid session\n- User is not signed in and has no active session",
    });
    const dupA = row("D1", {
      steps: "1. Click Login\n2. Type email\n3. Type password\n4. Click Submit\n5. Verify Dashboard",
      expected: "- User lands on Dashboard\n- Session cookie is set",
    });
    const dupB = row("D2", {
      steps: "1. Click Login\n2. Type email\n3. Type password\n4. Click Submit\n5. Verify Dashboard",
      expected: "- User lands on Dashboard\n- Session cookie is set",
    });
    const all = [thin, empty, noAc, conflict, dupA, dupB];
    expect(getCaseFlags(thin, all, null).defects.map((d) => d.flag)).toContain("thin");
    expect(getCaseFlags(empty, all, null).defects.map((d) => d.flag)).toContain("noExpected");
    expect(getCaseFlags(noAc, all, null).defects.map((d) => d.flag)).toContain("noAC");
    expect(getCaseFlags(conflict, all, null).defects.map((d) => d.flag)).toContain("conflict");
    expect(getCaseFlags(dupB, all, null).defects.map((d) => d.flag)).toContain("duplicate");
  });

  it("does not flag intentional Duplicate-menu copies as duplicate defects", () => {
    const src = row("S1", {
      steps: "1. Click Login\n2. Type email\n3. Type password\n4. Click Submit\n5. Verify Dashboard",
      expected: "- User lands on Dashboard\n- Session cookie is set",
      scenario: "Login with valid credentials",
      origin: "ai",
    });
    const copy = row("S2", {
      steps: "1. Click Login\n2. Type email\n3. Type password\n4. Click Submit\n5. Verify Dashboard",
      expected: "- User lands on Dashboard\n- Session cookie is set",
      scenario: "Login with valid credentials (copy)",
      origin: "human",
    });
    expect(getCaseFlags(copy, [src, copy], null).defects.map((d) => d.flag)).not.toContain("duplicate");
  });

  it("skips Draft and deleted rows", () => {
    const d = row("D", { executionStatus: "Draft", assessmentSource: "Not assessed", steps: "1. a" });
    expect(getCaseFlags(d, [d], null)).toEqual({ defects: [], needsReview: false });
  });

  it("summarizeCaseFlags: defect/review/attention are distinct unions", () => {
    const reviewOnly = row("R", {
      assessmentSource: "Not assessed",
      steps: "1. review\n2. only\n3. path\n4. done",
      expected: "- Review only outcome is visible",
    });
    const thin = row("T", {
      steps: "1. thinA\n2. thinB",
      assessmentSource: "Model",
      expected: "- Thin outcome is visible here",
    });
    const both = row("B", {
      steps: "1. bothA\n2. bothB",
      assessmentSource: "Not assessed",
      expected: "- Both outcome is visible here",
    });
    const clean = row("C", {
      assessmentSource: "Model",
      steps: "1. clean\n2. path\n3. here\n4. done",
      expected: "- Clean outcome is visible here",
    });
    const s = summarizeCaseFlags([reviewOnly, thin, both, clean], null);
    expect(s.reviewCases).toBe(2);
    expect(s.defectCases).toBe(2);
    expect(s.attentionCases).toBe(3);
    expect(s.byDefect.thin).toBe(2);
  });
});

describe("R11-03 Needs review empty grid root cause", () => {
  it("filterRowsByCaseFlags returns needsReview rows when badge would show N>0", () => {
    const rows = Array.from({ length: 16 }, (_, i) =>
      row(`NR-${i}`, { assessmentSource: "Not assessed" }),
    );
    const summary = summarizeCaseFlags(rows, null);
    expect(summary.reviewCases).toBe(16);
    const filtered = filterRowsByCaseFlags(rows, summary, "needs_review");
    expect(filtered.length).toBe(16);
    expect(filtered.length).toBe(summary.reviewCases);
  });

  it("R11-03 fix: filterRowsByDeadFlag uses cells when audit omits needs_review hits", () => {
    // BE auditSitWorkbook increments needsReviewRows but does NOT push needs_review into flagsByRowId.
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(`NR-${i}`, { assessmentSource: "Not assessed" }),
    );
    const audit: SitDeadAudit = {
      workbookId: "wb",
      generator: "test",
      flagsByRowId: {}, // empty — same as live BE for needs-review-only rows
      summary: {
        stub_workbook: 0,
        template_case: 0,
        not_assessed: 5,
        orphan_ticket: 0,
        empty_oracle: 0,
        generic_expected: 0,
        duplicate_case: 0,
        thin_case: 0,
        contradiction: 0,
        needs_review: 5,
      },
      flaggedRows: 0,
      needsReviewRows: 5,
    };
    // Before R11 this returned 0 while needsReviewRows was 5.
    expect(filterRowsByDeadFlag(rows, audit, "needs_review").length).toBe(5);
    expect(audit.needsReviewRows).toBe(5);

    const summary = summarizeCaseFlags(rows, null);
    expect(filterRowsByCaseFlags(rows, summary, "needs_review").length).toBe(5);
  });

  it("warnFlagCountMismatch fires when badge>0 and filter yields 0", () => {
    const spy = vi.fn();
    expect(warnFlagCountMismatch("needs_review", 16, 0, spy)).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(warnFlagCountMismatch("needs_review", 16, 16, spy)).toBe(false);
  });
});

describe("R11-02 migrateFlaggedFilter", () => {
  it("maps legacy DeadFlag and quality values without yielding null crash paths", () => {
    expect(migrateFlaggedFilter("empty_oracle")).toBe("noExpected");
    expect(migrateFlaggedFilter("orphan_ticket")).toBe("noAC");
    expect(migrateFlaggedFilter("thin_case")).toBe("thin");
    expect(migrateFlaggedFilter("contradiction")).toBe("conflict");
    expect(migrateFlaggedFilter("duplicate_case")).toBe("duplicate");
    expect(migrateFlaggedFilter("not_assessed")).toBe("needs_review");
    expect(migrateFlaggedFilter("needs_review")).toBe("needs_review");
    expect(migrateFlaggedFilter("all")).toBe("all");
    expect(migrateFlaggedFilter("bogus")).toBe(null);
  });

  it("caseMatchesFlaggedFilter accepts legacy ids via migrate", () => {
    const flags: CaseFlags = {
      defects: [{ flag: "thin", reason: "x" }],
      needsReview: true,
    };
    expect(caseMatchesFlaggedFilter(flags, "thin_case")).toBe(true);
    expect(caseMatchesFlaggedFilter(flags, "needs_review")).toBe(true);
    expect(caseMatchesFlaggedFilter(flags, "all")).toBe(true);
    expect(caseMatchesFlaggedFilter(flags, "noExpected")).toBe(false);
  });
});
