import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R10-01 scenario flag chips short labels + layout", () => {
  const chip = fs.readFileSync(path.join(__dirname, "sit-quality-flag-chip.tsx"), "utf8");
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");

  it("exports SHORT chip labels Duplicate Thin Conflict No expected No AC", () => {
    expect(chip).toMatch(/QUALITY_CHIP_SHORT_LABEL|SHORT_FLAG_LABEL|chipShortLabel/);
    expect(chip + finder).toMatch(/No AC/);
    expect(chip + finder).toMatch(/Conflict/);
    expect(chip + finder).toMatch(/No expected/);
    // long wording remains for tooltips / Issues / expand
    expect(finder).toMatch(/Not linked to an acceptance criterion/);
  });

  it("grid places flag chips on a wrapping row under the type chip, title full width", () => {
    expect(grid).toMatch(/data-testid=\"sit-scenario-flag-row\"/);
    expect(grid).toMatch(/data-testid=\"sit-scenario-title\"/);
    expect(grid).toMatch(/data-testid=\"sit-scenario-cell\"/);
    // title uses full width under the flag row
    expect(grid).toMatch(/w-full[\s\S]{0,120}sit-scenario-title/);
  });
});
