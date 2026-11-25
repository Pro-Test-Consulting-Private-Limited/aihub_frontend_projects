import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { placePopover } from "./sit-popover-place";

describe("R10-02 placePopover helper", () => {
  it("flips above when there is no room below", () => {
    const p = placePopover({
      trigger: { top: 820, bottom: 850, left: 100, right: 200, width: 100, height: 30, x: 100, y: 820, toJSON: () => ({}) },
      popWidth: 160,
      popHeight: 200,
      viewportW: 1280,
      viewportH: 900,
    });
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(900);
    expect(p.top).toBeLessThan(820);
  });

  it("shifts left when there is no room on the right", () => {
    const p = placePopover({
      trigger: { top: 100, bottom: 130, left: 1200, right: 1270, width: 70, height: 30, x: 1200, y: 100, toJSON: () => ({}) },
      popWidth: 200,
      popHeight: 180,
      viewportW: 1280,
      viewportH: 900,
    });
    expect(p.left + p.minWidth).toBeLessThanOrEqual(1280);
    expect(p.left).toBeLessThan(1200);
  });

  it("SitV2Select and quality dropdown use placePopover", () => {
    const select = fs.readFileSync(path.join(__dirname, "sit-v2-select.tsx"), "utf8");
    const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");
    expect(select).toMatch(/placePopover/);
    expect(finder).toMatch(/placePopover/);
  });
});
