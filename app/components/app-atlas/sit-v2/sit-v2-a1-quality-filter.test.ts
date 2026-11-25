import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * R6 A1 tests for the quality drawer were replaced by R7-04 dropdown tests
 * (see sit-v2-r7-04-quality-dropdown.test.ts). Kept: QualityFilter type + empty Show all.
 */
describe("R6 A1 quality filter contracts (retained after R7-04)", () => {
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");

  it("exposes QualityFilter and filter chip clear", () => {
    expect(finder).toMatch(/QualityFilter/);
    expect(finder).toMatch(/sit-quality-filter-chip/);
    expect(finder).toMatch(/sit-quality-filter-chip-clear/);
  });

  it("grid empty state offers Show all cases", () => {
    expect(grid).toMatch(/sit-grid-empty-show-all/);
  });
});
