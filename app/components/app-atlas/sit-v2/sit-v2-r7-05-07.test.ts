import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R7-05 flag chip / R7-06 expand / R7-07 clamp", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const expand = fs.readFileSync(path.join(__dirname, "sit-v2-expand-panel.tsx"), "utf8");
  const chip = fs.readFileSync(path.join(__dirname, "sit-quality-flag-chip.tsx"), "utf8");

  it("R7-05 unified flag chip replaces thin-only chip in grid", () => {
    expect(chip).toMatch(/sit-quality-flag-chip/);
    expect(grid).toMatch(/SitQualityFlagChip/);
    expect(grid).not.toMatch(/sit-thin-chip/);
  });

  it("R7-06 expand panel has Covers, Activity tabs History/AI, Quality section", () => {
    expect(expand).toMatch(/sit-expand-covers/);
    expect(expand).toMatch(/sit-expand-activity/);
    expect(expand).toMatch(/SitQualityReasons/);
    expect(expand).not.toMatch(/Coverage/);
    expect(expand).not.toMatch(/No open questions/);
    expect(expand).not.toMatch(/No human content edits recorded/);
  });

  it("R7-07 clamp has no maxHeight mid-line cut", () => {
    expect(grid).toMatch(/sit-steps-clamp/);
    expect(grid).not.toMatch(/maxHeight/);
  });
});
