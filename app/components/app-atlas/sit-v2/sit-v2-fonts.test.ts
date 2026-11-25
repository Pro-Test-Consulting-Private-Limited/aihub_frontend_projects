import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("A4 no native selects in SIT v2 tab", () => {
  it("grid and view do not render native <select>", () => {
    for (const file of ["sit-v2-grid.tsx", "sit-v2-view.tsx", "sit-v2-picker.tsx", "sit-v2-generate-dialog.tsx"]) {
      const src = fs.readFileSync(path.join(__dirname, file), "utf8");
      expect(src, file).not.toMatch(/<select[\s>]/);
      expect(src, file).not.toMatch(/<\/select>/);
    }
  });

  it("SitV2Select is used for filters and pills", () => {
    const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
    const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
    expect(view).toMatch(/SitV2Select/);
    expect(grid).toMatch(/SitV2Select/);
    expect(fs.existsSync(path.join(__dirname, "sit-v2-select.tsx"))).toBe(true);
  });
});
