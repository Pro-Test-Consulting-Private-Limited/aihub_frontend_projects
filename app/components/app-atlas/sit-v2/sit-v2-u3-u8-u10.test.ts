import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Round 3 U3 / U8 / U10", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const expand = fs.readFileSync(path.join(__dirname, "sit-v2-expand-panel.tsx"), "utf8");
  const prefs = fs.readFileSync(path.join(__dirname, "sit-v2-prefs.ts"), "utf8");

  it("U3: chevron expands inline panel; R7-06 Covers/History/AI (Coverage tab removed)", () => {
    expect(grid).toMatch(/sit-row-chevron/);
    expect(grid).toMatch(/SitV2ExpandPanel/);
    expect(grid).not.toMatch(/sit-row-drawer/);
    expect(expand).toMatch(/sit-expand-covers/);
    expect(expand).toMatch(/History/);
    expect(expand).toMatch(/AI original/);
    expect(expand).not.toMatch(/\["coverage", "Coverage"\]/);
    expect(expand).toMatch(/Revert all to AI|Revert this field to AI/);
    expect(grid).toMatch(/sit-row-context-menu/);
  });

  it("U10 R4 B2: origin filter carries counts; no duplicate counts bar", () => {
    expect(view).toMatch(/sit-origin-filter-chips/);
    expect(view).not.toMatch(/sit-counts-bar/);
  });

  it("U8: column resize, reorder, reset, split prio/sev, localStorage layout", () => {
    expect(grid).toMatch(/sit-col-resize-/);
    expect(grid).toMatch(/draggable/);
    expect(prefs).toMatch(/loadColumnLayout/);
    expect(prefs).toMatch(/resetColumnLayout/);
    expect(prefs).toMatch(/moveColumnInOrder/);
    expect(view).toMatch(/sit-reset-layout/);
    expect(view).toMatch(/sit-split-prio-sev/);
    expect(view).toMatch(/Reset layout/);
  });

  it("U10: origin chips + status bar; no long dotted sentence; no coloured left borders", () => {
    expect(view).toMatch(/sit-origin-filter-chips/);
    expect(view).toMatch(/sit-status-bar/);
    expect(view).toMatch(/of \{total\} run/);
    expect(view).not.toMatch(/AI - .*edited - .*human/);
    expect(grid).not.toMatch(/border-l-\[3px\]/);
    expect(grid).not.toMatch(/border-l-4/);
  });
});
