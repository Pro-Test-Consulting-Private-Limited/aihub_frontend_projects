import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { loadColumnLayout, SIT_DEFAULT_ORDER, SIT_DEFAULT_WIDTHS, SIT_MIN_WIDTHS } from "./sit-v2-prefs";

describe("R10-06 Result + Notes columns", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const prefs = fs.readFileSync(path.join(__dirname, "sit-v2-prefs.ts"), "utf8");
  const exp = fs.readFileSync(path.join(__dirname, "../../../lib/sit-export.ts"), "utf8");

  it("adds Notes column and Result header; keeps status testids", () => {
    expect(SIT_DEFAULT_ORDER).toContain("notes");
    expect(SIT_DEFAULT_WIDTHS.notes).toBe(200);
    expect(SIT_MIN_WIDTHS.notes).toBe(140);
    expect(SIT_DEFAULT_WIDTHS.status).toBe(200);
    expect(SIT_MIN_WIDTHS.status).toBe(170);
    expect(grid).toMatch(/\bResult\b/);
    expect(grid).toMatch(/sit-col-header-status/);
    expect(grid).toMatch(/sit-status-select/);
    expect(grid).toMatch(/sit-actual-result/);
    expect(grid).toMatch(/sit-notes-cell/);
    expect(grid).toMatch(/commitExecutionData/);
    expect(grid).toMatch(/actualResult/);
    expect(grid).toMatch(/userNote/);
    expect(prefs).toMatch(/notes/);
  });

  it("export includes Actual Result and Notes after Status", () => {
    expect(exp).toMatch(/Actual Result/);
    expect(exp).toMatch(/"Notes"/);
    expect(exp).toMatch(/actualResult/);
    expect(exp).toMatch(/userNote/);
  });

  it("saved layouts without notes get notes inserted after expected", () => {
    // Simulate localStorage load path via JSON parse logic mirrored by calling with mocked storage
    const key = "sit_v2_column_layout::test-canvas::anon";
    const legacy = {
      order: ["module", "feature", "prioSev", "scenario", "preconditions", "steps", "expected"],
      widths: { status: 130 },
      splitPrioSev: false,
      hidden: [],
    };
    const g = globalThis as { window?: Window & typeof globalThis; localStorage?: Storage };
    const store: Record<string, string> = { [key]: JSON.stringify(legacy) };
    g.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: () => null,
      length: 0,
    } as Storage;
    g.window = g as unknown as Window & typeof globalThis;
    const layout = loadColumnLayout("test-canvas", "anon");
    expect(layout.order).toContain("notes");
    const ei = layout.order.indexOf("expected");
    expect(layout.order[ei + 1]).toBe("notes");
    expect(layout.widths.notes).toBe(200);
  });
});
