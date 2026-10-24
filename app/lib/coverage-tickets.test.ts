import { describe, expect, it } from "vitest";
import { COVERAGE_EPICS } from "./coverage-tickets";

describe("coverage tickets (Jira epics and stories, project DW)", () => {
  it("lists 4 epics and 13 tickets with unique keys", () => {
    expect(COVERAGE_EPICS).toHaveLength(4);
    const tickets = COVERAGE_EPICS.flatMap((e) => e.tickets);
    expect(tickets).toHaveLength(13);
    expect(new Set(tickets.map((t) => t.key)).size).toBe(13);
    expect(COVERAGE_EPICS.every((e) => e.tickets.length > 0)).toBe(true);
  });
  it("sample figures are consistent: passed never exceeds tests, percentages within 0-100", () => {
    for (const t of COVERAGE_EPICS.flatMap((e) => e.tickets)) {
      expect(t.passed).toBeLessThanOrEqual(t.tests);
      expect(t.coverage).toBeGreaterThanOrEqual(0);
      expect(t.coverage).toBeLessThanOrEqual(100);
      expect(t.quality).toBeLessThanOrEqual(100);
    }
  });
});
