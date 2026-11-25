import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R7-04 / R11-02 Flagged dropdown replaces drawer + top Quality", () => {
  const finder = fs.readFileSync(path.join(__dirname, "../sit-dead-finder.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("uses Flagged dropdown portal, not drawer/scrim/open panel", () => {
    expect(finder).toMatch(/sit-flagged-dropdown|sit-quality-dropdown/);
    expect(finder).toMatch(/createPortal/);
    expect(finder).toMatch(/Flagged \$\{attentionN\}|Flagged \$\{/);
    expect(finder).not.toMatch(/sit-quality-open-panel/);
    expect(finder).not.toMatch(/sit-quality-scrim/);
    expect(finder).not.toMatch(/Open panel/);
    expect(finder).toMatch(/cases need attention/);
    expect(finder).toMatch(/sit-quality-opt-all-cases/);
    expect(finder).not.toMatch(/sit-needs-review-btn/);
  });

  it("chip lives in filter row via QualityActiveChip; Flagged lives in Cases row", () => {
    expect(finder).toMatch(/function QualityActiveChip/);
    expect(finder).toMatch(/function FlaggedFilterDropdown/);
    expect(view).toMatch(/QualityActiveChip/);
    expect(view).toMatch(/FlaggedFilterDropdown/);
    expect(view).not.toMatch(/QualityDrawerPanel/);
    expect(view).not.toMatch(/qualityPush/);
    expect(view).not.toMatch(/DeadTestFinderToolbar/);
  });
});
