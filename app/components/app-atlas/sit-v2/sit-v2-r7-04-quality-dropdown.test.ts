import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R7-04 quality dropdown replaces drawer", () => {
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("uses dropdown portal, not drawer/scrim/open panel", () => {
    expect(finder).toMatch(/sit-quality-dropdown/);
    expect(finder).toMatch(/createPortal/);
    expect(finder).toMatch(/Quality \$\{flagged\}/);
    expect(finder).not.toMatch(/sit-quality-open-panel/);
    expect(finder).not.toMatch(/sit-quality-scrim/);
    expect(finder).not.toMatch(/Open panel/);
    expect(finder).toMatch(/cases need attention/);
    expect(finder).toMatch(/sit-quality-opt-all-cases/);
  });

  it("chip lives in filter row via QualityActiveChip", () => {
    expect(finder).toMatch(/function QualityActiveChip/);
    expect(view).toMatch(/QualityActiveChip/);
    expect(view).not.toMatch(/QualityDrawerPanel/);
    expect(view).not.toMatch(/qualityPush/);
  });
});
