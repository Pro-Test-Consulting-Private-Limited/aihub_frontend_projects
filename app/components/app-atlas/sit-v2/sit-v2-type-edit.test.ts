import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Round 4 A2/A3 scenario type edit", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const select = fs.readFileSync(path.join(__dirname, "sit-v2-select.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("sends cells.testType (and top-level alias) not bare wrong-only shape", () => {
    expect(grid).toMatch(/cells:\s*\{\s*testType:\s*t\s*\}/);
    expect(grid).toMatch(/sit-scenario-type-chip/);
    expect(grid).toMatch(/sit-scenario-title-editor/);
    expect(grid).toMatch(/textarea/);
  });

  it("SitV2Select uses a portal popover and mousedown preventDefault", () => {
    expect(select).toMatch(/createPortal/);
    expect(select).toMatch(/data-sit-select-popover/);
    expect(select).toMatch(/preventDefault/);
  });

  it("error banner offers Retry without raw API-only UX", () => {
    expect(view).toMatch(/Could not save/);
    expect(view).toMatch(/sit-save-retry/);
    expect(view).toMatch(/console\.error/);
  });
});
