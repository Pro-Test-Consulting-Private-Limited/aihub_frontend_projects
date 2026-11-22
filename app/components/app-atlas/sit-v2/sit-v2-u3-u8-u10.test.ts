import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Round 3 U3 / U8 / U10", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const expand = fs.readFileSync(path.join(__dirname, "sit-v2-expand-panel.tsx"), "utf8");
  const prefs = fs.readFileSync(path.join(__dirname, "sit-v2-prefs.ts"), "utf8");

  it("U3: chevron expands inline panel with tabs; no side drawer", () => {
    expect(grid).toMatch(/sit-row-chevron/);
    expect(grid).toMatch(/SitV2ExpandPanel/);
    expect(grid).not.toMatch(/sit-row-drawer/);
    expect(expand).toMatch(/Details/);
    expect(expand).toMatch(/Test data/);
    expect(expand).toMatch(/Coverage/);
    expect(expand).toMatch(/History/);
    expect(expand).toMatch(/Show original AI version/);
    expect(expand).toMatch(/Revert to AI version/);
    expect(grid).toMatch(/sit-row-context-menu/);
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
    expect(view).toMatch(/sit-counts-bar/);
    expect(view).toMatch(/sit-status-bar/);
    expect(view).toMatch(/of \{total\} run/);
    expect(view).not.toMatch(/AI - .*edited - .*human/);
    expect(grid).not.toMatch(/border-l-\[3px\]/);
    expect(grid).not.toMatch(/border-l-4/);
  });
});
