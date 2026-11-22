import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("R7-03 count strip in toolbar", () => {
  const view = fs.readFileSync(path.join(__dirname, "sit-v2-view.tsx"), "utf8");
  const grid = fs.readFileSync(path.join(__dirname, "sit-v2-grid.tsx"), "utf8");

  it("toolbar shows Showing N of M cases left of Columns", () => {
    expect(view).toMatch(/sit-toolbar-showing-count/);
    expect(view).toMatch(/Showing \{toolbarShownCount\} of \{toolbarTotalCount\} cases/);
  });

  it("grid no longer has the footer strip count", () => {
    expect(grid).not.toMatch(/sit-grid-footer-count/);
  });
});
