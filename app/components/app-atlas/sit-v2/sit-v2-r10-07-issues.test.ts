import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R10-07 Issues screen", () => {
  const issues = fs.readFileSync(path.join(__dirname, "sit-v2-issues-screen.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const dead = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");

  it("has Cases/Issues switch and Issues screen markers", () => {
    expect(view).toMatch(/sit-mode-issues/);
    expect(view).toMatch(/SitV2IssuesScreen/);
    expect(view).toMatch(/sit-selected-issues-chip/);
    expect(issues).toMatch(/sit-issues-screen/);
    expect(issues).toMatch(/sit-issues-cards/);
    expect(issues).toMatch(/Why this is flagged/);
    expect(dead).toMatch(/sit-quality-open-issues/);
  });
});
