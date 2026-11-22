import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R6 A1 quality filter contracts", () => {
  const finder = fs.readFileSync(
    path.join(__dirname, "../sit-dead-finder.tsx"),
    "utf8",
  );
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");

  it("exposes toggle clear controls and filter chip", () => {
    expect(finder).toMatch(/sit-quality-filter-chip/);
    expect(finder).toMatch(/sit-quality-show-all/);
    expect(finder).toMatch(/sit-quality-filter-chip-clear/);
    expect(finder).toMatch(/QualityFilter/);
    expect(finder).toMatch(/onFlag\("all"\)/);
  });

  it("grid empty state offers Show all cases", () => {
    expect(grid).toMatch(/sit-grid-empty-show-all/);
  });

  it("view wires push drawer at 1440 and QualityDrawerPanel", () => {
    expect(view).toMatch(/qualityPush/);
    expect(view).toMatch(/QualityDrawerPanel/);
    expect(view).toMatch(/viewportW >= 1440/);
  });
});
