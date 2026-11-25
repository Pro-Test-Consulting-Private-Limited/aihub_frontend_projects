import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Round 3 grid UX batch U2/U5/U7/U9/U11/U13", () => {
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");

  it("U2: no Open drawer; row menu on ID; table fills width", () => {
    expect(grid).not.toMatch(/Open drawer/);
    expect(grid).toMatch(/sit-row-menu/);
    expect(grid).toMatch(/sit-id-cell/);
    expect(grid).toMatch(/table-fixed/);
    expect(grid).toMatch(/w-full/);
  });

  it("U5: no line-clamp / 7.5rem mid-line cut; Show more at line boundary", () => {
    expect(grid).not.toMatch(/line-clamp-2/);
    expect(grid).not.toMatch(/max-h-\[7\.5rem\]/);
    expect(grid).toMatch(/sit-show-more/);
    expect(grid).toMatch(/StepsClamp/);
  });

  it("U7: labelled Priority / Severity", () => {
    expect(grid).toMatch(/Priority \/ Severity/);
    expect(grid).toMatch(/Priority \$\{val\}/);
  });

  it("U9: single Add in toolbar view", () => {
    expect(view).toMatch(/sit-add-test-case/);
    expect(grid).not.toMatch(/sit-add-test-case/);
  });

  it("U11: ID whitespace-nowrap + select-all checkbox", () => {
    expect(grid).toMatch(/whitespace-nowrap/);
    expect(grid).toMatch(/Select all/);
  });

  it("U13: status list without inner scrollbar", () => {
    expect(grid).toMatch(/listClassName="max-h-none overflow-visible"/);
  });
});
