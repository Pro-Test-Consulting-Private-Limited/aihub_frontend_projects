import { describe, expect, it } from "vitest";
import { COVERAGE_PAGES } from "./coverage-pages";

describe("coverage pages (from the Digital Wallet spec)", () => {
  it("lists the spec's 14 screens in three groups, each with at least one element", () => {
    expect(COVERAGE_PAGES).toHaveLength(14);
    expect(new Set(COVERAGE_PAGES.map((p) => p.group))).toEqual(new Set(["Public", "Customer", "Admin"]));
    expect(COVERAGE_PAGES.every((p) => p.elements.length > 0 && p.url.startsWith("/"))).toBe(true);
    expect(new Set(COVERAGE_PAGES.map((p) => p.url)).size).toBe(14);
  });
  it("sample figures are consistent: passed never exceeds tests, percentages within 0-100", () => {
    for (const p of COVERAGE_PAGES) {
      expect(p.passed).toBeLessThanOrEqual(p.tests);
      expect(p.coverage).toBeGreaterThanOrEqual(0);
      expect(p.coverage).toBeLessThanOrEqual(100);
      expect(p.quality).toBeLessThanOrEqual(100);
    }
  });
});
