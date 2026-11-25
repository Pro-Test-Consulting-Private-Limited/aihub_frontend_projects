import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R7-01 quality counts unique cases", () => {
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");

  it("qualityCount prefers flaggedRows / unique rows, not sum of group totals", () => {
    expect(finder).toMatch(/function qualityCount/);
    // Must not solely sum QUALITY_GROUP_ORDER summary counts for the headline
    expect(finder).toMatch(/flaggedRows|unique/);
    // Guard: the old pattern summing summary groups for the headline should be gone
    const start = finder.indexOf("function qualityCount");
    const end = finder.indexOf("function qualityIssueCount");
    const fn = finder.slice(start, end);
    expect(fn).not.toMatch(/for \(const f of QUALITY_GROUP_ORDER\) n \+= audit\.summary/);
    expect(fn).toMatch(/flaggedRows/);
  });

  it("exports issue count separately for dropdown header", () => {
    expect(finder).toMatch(/function qualityIssueCount/);
    expect(finder).toMatch(/export \{ qualityCount, qualityIssueCount/);
  });
});
